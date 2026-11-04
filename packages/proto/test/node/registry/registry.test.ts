import {
  indexStoryFile,
  storyIdentity,
  indexStories,
  mockWarnings,
} from "../../../src/node/stories.ts";
import { keyKind, storyOfKey, storyKey, reviewKeys } from "../../../src/model/registry.ts";
import { keySchema } from "../../../src/model/review.ts";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findPrototypes } from "../../../src/node/discovery.ts";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const meta =
  '{ title: "Login", spec: "auth", states: [{id:"idle",label:"Idle"},{id:"loading",label:"Loading"},{id:"error",label:"Error"},{id:"done",label:"Done"}] }';
function discover(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "proto-registry-"));
  roots.push(root);
  for (const [file, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), code);
  }
  return findPrototypes(root, root, {
    title: "Test",
    specs: { auth: "Auth" },
    roles: { member: "Member" },
    siteUrl: null,
  });
}
const source = (value = meta, jsx = "<View />") =>
  `export const meta = definePrototype(${value}); export default () => ${jsx};`;
it("UT-001 metadata and UT-008 discovery never executes modules", () => {
  const r = discover({ "src/login-form.proto.tsx": 'throw Error("no");' + source() });
  expect(r.problems).toEqual([]);
  expect(r.entries[0]).toMatchObject({
    slug: "login-form",
    kind: "component",
    meta: { spec: "auth" },
  });
  expect(r.entries[0]?.meta?.states).toHaveLength(4);
});
it("UT-002 draft identity and UT-011 component index identity", () => {
  expect(
    discover({ "src/drafts/review-digest/index.proto.tsx": source(meta, "<div />") }).entries[0]
  ).toMatchObject({ slug: "review-digest", kind: "draft" });
  expect(discover({ "src/login/index.proto.tsx": source() }).entries[0]?.kind).toBe("component");
});
it("UT-003 duplicate identity names both files", () => {
  const result = discover({
    "src/login.proto.tsx": source(),
    "src/other/login.proto.tsx": source(),
  });
  expect(result.problems).toEqual([
    expect.objectContaining({
      code: "duplicate_slug",
      message: expect.stringMatching(/src\/login.*src\/other\/login/),
    }),
  ]);
});
it("UT-004 reserved and invalid slugs", () =>
  expect(
    discover({
      "src/flow-intro.proto.tsx": source(),
      "src/Intro_1.proto.tsx": source(),
    }).problems.map(p => p.code)
  ).toEqual(expect.arrayContaining(["reserved_slug", "invalid_slug"])));
it("UT-005 computed metadata is rejected with location", () =>
  expect(discover({ "src/login.proto.tsx": source("makeMeta()") }).problems[0]).toMatchObject({
    code: "invalid_meta",
    line: 1,
  }));
it("UT-006 duplicate states", () =>
  expect(
    discover({ "src/login.proto.tsx": source(meta.replace('id:"done"', 'id:"idle"')) }).problems[0]
      ?.code
  ).toBe("duplicate_state"));
it("UT-007 intrinsic markup has location and drafts allow markup", () => {
  expect(discover({ "src/login.proto.tsx": source(meta, "<div />") }).problems[0]).toMatchObject({
    code: "markup",
    line: 1,
  });
  expect(
    discover({ "src/drafts/login/index.proto.tsx": source(meta, "<div />") }).problems
  ).toEqual([]);
});
it("UT-009 unknown roles", () =>
  expect(
    discover({ "src/login.proto.tsx": source(meta.replace("title:", 'roles:["owner"],title:')) })
      .problems[0]?.code
  ).toBe("unknown_role"));
it("UT-010 unknown specs", () =>
  expect(
    discover({ "src/login.proto.tsx": source(meta.replace('"auth"', '"billing"')) }).problems[0]
      ?.code
  ).toBe("unknown_spec"));

it("IT-012 and UT-097 check refuses invalid registry and reports unavailable specs", async () => {
  const { loadProject } = await import("../../../src/node/project.ts");
  const { checkProject } = await import("../../../src/node/check.ts");
  const root = mkdtempSync(join(tmpdir(), "proto-check-"));
  roots.push(root);
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), '{"type":"module"}');
  writeFileSync(join(root, "proto.config.ts"), 'export default {title:"Check",specs:()=>null};');
  writeFileSync(join(root, "src/test.proto.tsx"), source("computed()"));
  const project = await loadProject(root);
  const result = await checkProject(project);
  expect(result.ok).toBe(false);
  expect(result.problems[0]?.code).toBe("invalid_meta");
  expect(result.warnings.map(w => w.code)).toContain("specs_unavailable");
});

it.each([
  { poll: true, extension: "proto.tsx" },
  { poll: false, extension: "story.tsx" },
])(
  "a watched project shares one fresh snapshot with $extension and poll=$poll",
  async ({ poll, extension }) => {
    // Invariant: live consumers share discovery work; add/change/remove invalidate that snapshot.
    // Owner: project registry lifecycle, with real polling/native watchers and configured patterns.
    const { loadProject } = await import("../../../src/node/project.ts");
    const root = mkdtempSync(join(tmpdir(), "proto-watch-"));
    roots.push(root);
    mkdirSync(join(root, "src"));
    writeFileSync(
      join(root, "proto.config.ts"),
      `export default ${JSON.stringify({
        title: "Watch",
        prototypes: `src/**/*.${extension}`,
        dev: { poll },
      })};`
    );
    const file = join(root, `src/login.${extension}`);
    writeFileSync(file, source());
    const project = await loadProject(root);
    const first: Awaited<ReturnType<typeof project.registry>>[] = [];
    const second: typeof first = [];
    const stopFirst = project.watch(registry => first.push(registry));
    const stopSecond = project.watch(registry => second.push(registry));
    try {
      const initial = await project.registry();
      expect(await project.registry()).toBe(initial);
      writeFileSync(file, source(meta.replace("Login", "Updated login")));
      await expect.poll(() => first.at(-1)?.prototypes[0]?.title).toBe("Updated login");
      expect(second.at(-1)).toBe(first.at(-1));
      expect(await project.registry()).toBe(first.at(-1));
      // Discovery reports misplaced flows too: the live cache must not hide those diagnostics.
      const misplaced = join(root, "src/misplaced.flow.ts");
      writeFileSync(misplaced, "export const flow = {};");
      await expect
        .poll(() => first.at(-1)?.problems.some(item => item.code === "flow_outside_root"))
        .toBe(true);
      rmSync(misplaced);
      await expect
        .poll(() => first.at(-1)?.problems.some(item => item.code === "flow_outside_root"))
        .toBe(false);
      // Directory-only native notifications must invalidate descendants in the shared snapshot.
      const outside = mkdtempSync(join(tmpdir(), "proto-moved-"));
      roots.push(outside);
      const folder = join(root, "src/components/moving");
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, `moving.${extension}`), source());
      await expect
        .poll(() => first.at(-1)?.prototypes.some(item => item.slug === "moving"))
        .toBe(true);
      renameSync(folder, join(outside, "moving"));
      await expect
        .poll(() => first.at(-1)?.prototypes.some(item => item.slug === "moving"))
        .toBe(false);
      renameSync(join(outside, "moving"), folder);
      await expect
        .poll(() => first.at(-1)?.prototypes.some(item => item.slug === "moving"))
        .toBe(true);
      rmSync(folder, { recursive: true });
      await expect
        .poll(() => first.at(-1)?.prototypes.some(item => item.slug === "moving"))
        .toBe(false);
      stopFirst();
      rmSync(file);
      await expect.poll(() => second.at(-1)?.prototypes.length).toBe(0);
      expect(first.at(-1)?.prototypes).toHaveLength(1);
      writeFileSync(file, source());
      await expect.poll(() => second.at(-1)?.prototypes[0]?.title).toBe("Login");
    } finally {
      stopFirst();
      stopSecond();
    }
    // Without a watcher, CLI callers still observe files changed between explicit reads.
    writeFileSync(file, source(meta.replace("Login", "Unwatched")));
    expect((await project.registry()).prototypes[0]?.title).toBe("Unwatched");
  }
);

// Invariant: CSF identities are static, deterministic and distinct from prototype review keys.
// Owner: registry discovery; this is the canonical Node registry suite.
describe("story registry", () => {
  const parse = (body: string, file = "src/button.stories.tsx") => indexStoryFile(body, file, "ui");
  it("indexes CSF3 without executing modules", () => {
    const result = parse(
      'throw Error("never execute"); const meta = { title: "UI/Button" } satisfies Meta; export default meta; export const Primary = {}; export const Disabled = {};'
    );
    expect(result.problems).toEqual([]);
    expect(result.entry).toMatchObject({
      slug: "ui-button",
      path: ["UI", "Button"],
      stories: [{ id: "ui-button--primary" }, { id: "ui-button--disabled" }],
    });
  });
  it.each([
    ["UI/Button", "Primary", "ui-button--primary"],
    ["UI/Button", "withIcon", "ui-button--with-icon"],
    ["A / B", "XMLParser", "a-b--xml-parser"],
    ["Forms/Input", "Input2", "forms-input--input-2"],
    ["Foo.Bar", "under_score", "foo-bar--under-score"],
    ["A+B", "HTTP2", "a-b--http-2"],
    ["Hello, World!", "isOK", "hello-world--is-ok"],
    ["X_Y", "Small", "x-y--small"],
    ["A--B", "UPPER_CASE", "a-b--upper-case"],
    [" A ", "one2Three", "a--one-2-three"],
  ])("matches Storybook identity %s/%s", (title, exportName, id) => {
    expect(storyIdentity({ title }, exportName).id).toBe(id);
  });
  it("respects explicit ids, export filters and export order", () => {
    const result = parse(
      'export default { title: "UI/Button", id: "stable-button", excludeStories: /^helper/ }; export const helper = {}; export const Primary = { name: "Visible", parameters: { __id: "explicit-id" } }; export const Secondary = {}; export const __namedExportsOrder = ["Secondary", "Primary"];'
    );
    expect(result.entry?.stories.map(story => story.id)).toEqual([
      "stable-button--secondary",
      "explicit-id",
    ]);
    expect(result.entry?.stories[1]?.name).toBe("Visible");
    expect(parse('export default { title: "UI/Button", parameters: { __id: "meta-only" } }; export const Primary = {}; export const Secondary = { parameters: { __id: "story-only" } };').entry?.stories.map(story => story.id)).toEqual(["ui-button--primary", "story-only"]);
    expect(
      parse('export default { title: "UI/Button" }; export const helper = {};').entry?.stories
    ).toHaveLength(1);
    expect(parse('export default { title: "UI/Button" };').entry).toBeNull();
  });
  it("reports syntax locations, derived titles and invalid component identities", () => {
    expect(parse("export default {};\n\n\nexport const Bad = { x: };").problems[0]).toMatchObject({
      code: "story_parse",
      line: 4,
    });
    expect(
      parse("export default { title: dynamic() }; export const Primary = {};").warnings
    ).toContainEqual(expect.objectContaining({ code: "story_title_dynamic" }));
    for (const title of ["你好", "x".repeat(200)])
      expect(
        parse(`export default { title: ${JSON.stringify(title)} }; export const Primary = {};`)
          .problems
      ).toContainEqual(expect.objectContaining({ code: "story_slug_invalid" }));
    expect(
      parse('export default { title: "X", id: "a--b" }; export const Primary = {};').problems[0]
        ?.code
    ).toBe("story_slug_invalid");
  });
  it("warns about inert module mocks in stories and preview", () => {
    for (const code of [
      'sb.mock("x")',
      'sb.mock(import("x"), { spy: true })',
      'import { mocked as alias } from "storybook/test"',
    ])
      expect(mockWarnings(code, "preview.ts", "ui")[0]).toMatchObject({
        code: "story_mock_unsupported",
        file: "preview.ts",
        root: "ui",
      });
  });
  it("isolates component keys and widens the review schema", () => {
    expect(keyKind("story--ui-button")).toBe("story");
    expect(storyOfKey("story--ui-button")).toBe("ui-button");
    expect(keyKind("story-foo")).toBe("prototype");
    expect(keyKind("flow-x")).toBe("flow");
    expect(keySchema.safeParse("story--").success).toBe(false);
    expect(keySchema.parse(storyKey("ui-button"))).toBe("story--ui-button");
    expect(
      reviewKeys({
        prototypes: [{ slug: "story-ui-button" }],
        flows: [],
        stories: [{ slug: "ui-button" }],
      })
    ).toEqual(["story--ui-button", "story-ui-button"]);
  });
  it("rejects duplicate slugs and ids across files and roots and diagnoses empty globs", () => {
    const app = mkdtempSync(join(tmpdir(), "proto-stories-index-"));
    roots.push(app);
    writeFileSync(join(app, "preview.ts"), "export const decorators = [];");
    writeFileSync(
      join(app, "one.stories.tsx"),
      'export default { title: "UI/Button" }; export const Primary = { parameters: { __id: "shared" } };'
    );
    writeFileSync(
      join(app, "two.stories.tsx"),
      'export default { title: "UI/Button" }; export const Secondary = { parameters: { __id: "shared" } };'
    );
    const root = { id: "ui", stories: "*.stories.tsx", preview: "preview.ts", vite: "vite.ts" };
    const indexed = indexStories(app, [root]);
    expect(indexed.entries).toEqual([]);
    expect(indexed.problems.map(problem => problem.code)).toEqual(
      expect.arrayContaining(["story_slug_duplicate", "story_id_duplicate"])
    );
    writeFileSync(join(app, "one.stories.tsx"), 'export default { title: "UI/Button", id: "one" }; export const Primary = {};');
    writeFileSync(join(app, "two.stories.tsx"), 'export default { title: "UI/Button", id: "two" }; export const Secondary = {};');
    const duplicateTitle = indexStories(app, [root]);
    expect(duplicateTitle.entries).toEqual([]);
    expect(duplicateTitle.problems).toContainEqual(expect.objectContaining({
      code: "story_slug_duplicate", message: "Slug two comes from two files.",
      chain: ["ui/one.stories.tsx", "ui/two.stories.tsx"],
    }));
    expect(indexStories(app, [{ ...root, stories: "none/*.tsx" }]).warnings[0]?.code).toBe(
      "story_glob_empty"
    );
    expect(indexStories(app, [{ ...root, preview: "absent.ts" }]).problems[0]?.code).toBe(
      "story_preview_missing"
    );
    expect(
      indexStories(app, [root, { ...root, id: "other" }]).problems.some(
        problem => problem.code === "story_id_duplicate"
      )
    ).toBe(true);
  });
});

it("keeps cache entries stable until file metadata changes or explicit invalidation", () => {
  const app = mkdtempSync(join(tmpdir(), "proto-stories-cache-"));
  roots.push(app);
  writeFileSync(join(app, "preview.ts"), "export {};");
  const file = join(app, "button.stories.tsx");
  writeFileSync(file, 'export default { title: "UI/Button" }; export const Primary = {};');
  const root = { id: "ui", preview: "preview.ts", vite: "vite.ts", stories: "*.stories.tsx" };
  const cache: import("../../../src/node/stories.ts").StoryCache = new Map();
  const first = indexStories(app, [root], cache);
  expect(indexStories(app, [root], cache).entries[0]).toBe(first.entries[0]);
  writeFileSync(join(app, "preview.ts"), 'sb.mock("boring-avatars");');
  writeFileSync(file, 'import { mocked } from "storybook/test"; export default { title: "UI/Button" }; export const Primary = {};');
  cache.clear();
  const warned = indexStories(app, [root], cache);
  expect(warned.warnings).toContainEqual(expect.objectContaining({ message: 'sb.mock("boring-avatars") is inert (1 file calls mocked())' }));
  expect(indexStories(app, [root], cache).warnings).toEqual(warned.warnings);
  // Invariant: one root summary is printable; file diagnostics remain addressable by the shell.
  // Owner: story index warnings, in the canonical registry suite.
  expect(warned.warnings.filter(warning => warning.code === "story_mock_unsupported" && !warning.file)).toEqual([
    expect.objectContaining({ root: "ui", message: 'sb.mock("boring-avatars") is inert (1 file calls mocked())' }),
  ]);
  expect(warned.warnings.filter(warning => warning.file).map(warning => warning.file)).toEqual(["preview.ts", "button.stories.tsx"]);
  writeFileSync(file, 'export default { title: "UI/Button" }; export const Secondary = {};');
  expect(indexStories(app, [root], cache).entries[0]?.stories[0]?.id).toBe("ui-button--secondary");
  expect(indexStories(app, [root], cache).warnings.filter(warning => !warning.file)).toEqual([
    expect.objectContaining({ message: 'sb.mock("boring-avatars") is inert' }),
  ]);
  rmSync(file);
  expect(indexStories(app, [root], cache).entries).toEqual([]);
  expect(cache.size).toBe(0);
});

it("reads CSF2 assignments and inherited play without executing either", () => {
  const parsed = indexStoryFile(
    'export default { title: "UI/Button", play() {} }; export const Named = () => null; Named.storyName = "Legacy"; Named.parameters = { __id: "stable" };',
    "button.stories.tsx",
    "ui"
  );
  expect(parsed.entry?.stories[0]).toMatchObject({ id: "stable", play: true });
});

// IT-023 invariant: one refresh publishes its newest snapshot even when a concurrent read wins.
// Owner: project refresh orchestration; the registry read is the filesystem I/O boundary.
it("publishes the newest generation once after a concurrent registry read during refresh", async () => {
  const { loadProject } = await import("../../../src/node/project.ts");
  const app = mkdtempSync(join(tmpdir(), "proto-stories-generation-"));
  roots.push(app);
  writeFileSync(join(app, "proto.config.ts"), 'export default { title: "No stories" };');
  expect(await (await loadProject(app)).registry()).not.toHaveProperty("storyRoots");
  writeFileSync(
    join(app, "proto.config.ts"),
    'export default { title: "Stories", stories: { roots: [{ id: "ui", stories: "*.stories.tsx", preview: "preview.ts", vite: "vite.ts" }] } };'
  );
  writeFileSync(join(app, "preview.ts"), "export {};");
  const file = join(app, "button.stories.tsx");
  writeFileSync(file, 'export default { title: "UI/Button" }; export const Primary = {};');
  const project = await loadProject(app);
  const readRegistry = project.registry.bind(project);
  const seen: string[] = [];
  let notify: () => void = () => {};
  let entered: () => void = () => {};
  let release: () => void = () => {};
  const next = new Promise<void>(resolve => {
    notify = resolve;
  });
  const refreshing = new Promise<void>(resolve => {
    entered = resolve;
  });
  const released = new Promise<void>(resolve => {
    release = resolve;
  });
  const onChange = (registry: Awaited<ReturnType<typeof project.registry>>) => {
    seen.push(registry.stories![0]!.stories[0].id);
    notify();
  };
  let stop = project.watch(onChange);
  // Delay one real filesystem result so another real read can complete before it.
  const read = vi.spyOn(project, "registry").mockImplementationOnce(async () => {
    const older = await readRegistry();
    entered();
    await released;
    return older;
  });
  try {
    project.invalidateStories("ui", [file]);
    await refreshing;
    // Reconnecting the last subscriber drops the observed cache without requesting another refresh.
    stop();
    writeFileSync(file, 'export default { title: "UI/Button" }; export const Secondary = {};');
    stop = project.watch(onChange);
    const newer = await project.registry();
    const revision = project.revision;
    release();
    await next;
    // Flush the refresh continuation; a stale result must neither publish nor replace the newer one.
    await Promise.resolve();
    expect(seen).toEqual(["ui-button--secondary"]);
    expect((await project.registry()).stories).toEqual(newer.stories);
    expect(project.revision).toBe(revision);
  } finally {
    release();
    read.mockRestore();
    stop();
  }
});

// Invariant: check reports story index diagnostics without importing the story or root Vite config.
// Owner: project registry/check contract; graph code would throw if accidentally loaded.
it("stories UT-021: check reports root and file without loading stories", async () => {
  const { storiesFixture } = await import("../app-fixture.ts");
  const { loadProject } = await import("../../../src/node/project.ts");
  const { checkProject } = await import("../../../src/node/check.ts");
  const fixture = storiesFixture();
  try {
    // The prototype config must remain usable: only the separate story pipeline throws.
    writeFileSync(join(fixture.app, "story-vite.ts"), 'throw new Error("story Vite loaded");');
    writeFileSync(join(fixture.app, "preview.tsx"), 'import "./missing-preview-dependency"; throw new Error("preview loaded");');
    writeFileSync(join(fixture.app, "src/button.stories.tsx"), 'import "./missing-story-dependency"; export default { title: "Clean" }; export const Default = {};');
    writeFileSync(join(fixture.app, "proto.canvas.tsx"), 'export function Canvas({ children }) { return children; }');
    const project = await loadProject(fixture.app);
    project.config.stories!.roots[0]!.vite = "story-vite.ts";
    expect(await checkProject(project)).toMatchObject({ ok: true, problems: [] });
    rmSync(join(fixture.app, "preview.tsx"));
    const result = await checkProject(await loadProject(fixture.app));
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual(expect.objectContaining({ code: "story_preview_missing", root: "app", file: "preview.tsx" }));
    expect(result).not.toHaveProperty("error");
  } finally { rmSync(fixture.root, { recursive: true, force: true }); }
});
