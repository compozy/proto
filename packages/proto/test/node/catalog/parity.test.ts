import { beforeAll as prepareApp, afterAll as disposeApp } from "vitest";
import { appFixture, appFiles } from "../app-fixture.ts";
import { rmSync } from "node:fs";
import { parseArgs } from "citty";
import { expect, it } from "vitest";
import { resolve } from "node:path";
import { catalog, exclusions } from "../../../src/capabilities/catalog.ts";
import { commandDefinition, runCli } from "../../../src/cli/main.ts";
import { loadProject } from "../../../src/node/project.ts";
import { mcpTools, executeTool, createMcpServer } from "../../../src/mcp.ts";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
it("IT-015 every catalog operation has CLI and MCP or an explicit exclusion", () => {
  expect(exclusions).toHaveLength(1);
  for (const capability of catalog) {
    expect(commandDefinition(capability).meta?.name).toBe(capability.cli);
    if (capability.mcp) {
      const tool = mcpTools.find(t => t.name === capability.mcp);
      expect(tool).toBeDefined();
      if (capability.store) expect(tool?.inputSchema.properties).toHaveProperty("remote");
    } else expect(capability.exclusion).toBeTruthy();
  }
  expect(mcpTools).toHaveLength(22);
});
it("IT-015 MCP results equal CLI JSON through the actual SDK transport", async () => {
  const project = await loadProject(fixtureApp);
  const server = await createMcpServer(project);
  const client = new Client({ name: "proto-test", version: "1" });
  const [left, right] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(left), client.connect(right)]);
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(mcpTools.map(t => t.name));
    const cliError = await runCli(["url", "--json"], { project });
    const mcpError = await client.callTool({ name: "proto_url", arguments: {} });
    expect(mcpError.isError).toBe(true);
    expect(JSON.parse((mcpError.content as { text: string }[])[0]!.text)).toEqual(cliError.data);
    for (const command of ["list", "flow list", "flow coverage", "url"]) {
      const args = command === "url" ? { slug: "login-form" } : {};
      const capability = catalog.find(c => c.cli === command)!;
      const cli = await runCli(
        [...command.split(" "), ...(command === "url" ? ["login-form"] : []), "--json"],
        { project }
      );
      const result = await client.callTool({ name: capability.mcp!, arguments: args });
      expect(JSON.parse((result.content as { text: string }[])[0]!.text)).toEqual(cli.data);
      expect(await executeTool(capability.mcp!, args, project)).toEqual(cli.data);
    }
  } finally {
    await client.close();
    await server.close();
  }
});
it("IT-015 proto mcp serves the catalog over real stdio", async () => {
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command: "bun",
    args: [resolve(import.meta.dirname, "../../../src/cli/main.ts"), "mcp", "--app", fixtureApp],
    stderr: "pipe",
  });
  const client = new Client({ name: "proto-stdio-test", version: "1" });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(
      mcpTools.map(tool => tool.name)
    );
    const result = await client.callTool({ name: "proto_list", arguments: {} });
    expect(JSON.parse((result.content as { text: string }[])[0]!.text)).toHaveProperty(
      "prototypes"
    );
  } finally {
    await client.close();
    await transport.close();
  }
}, 15000);

it("UT-050: dev --open is a boolean CLI option", () => {
  const command = commandDefinition(catalog.find(c => c.cli === "dev")!);
  expect(parseArgs(["--open"], command.args)).toMatchObject({ open: true });
});

let fixtureApp: string;
prepareApp(() => {
  fixtureApp = appFixture("proto-transport-", appFiles);
});
disposeApp(() => {
  if (fixtureApp) rmSync(fixtureApp, { recursive: true, force: true });
});
