/**
 * Error registry (`_spec.md` § Error Registry): one table, code → CLI exit, HTTP status and
 * message. The CLI, MCP and the review router read it; `_dx.md` § Errors is generated from it.
 * Pure: no Node, no DOM.
 */

export type ErrorSpec = {
  /** CLI exit code: 1 problems/user error · 2 usage · 3 missing dependency · 4 remote/auth. */
  exit: 1 | 2 | 3 | 4 | null;
  /** HTTP status when the router or server can answer with it. */
  status: number | null;
  message: string;
};

export const errors = {
  invalid_config: { exit: 1, status: null, message: "proto.config.ts is invalid." },
  not_a_vite_app: { exit: 1, status: null, message: "No Vite config found; pass --app <dir>." },
  app_required: { exit: 2, status: null, message: "Several apps found; pass --app <dir>." },
  port_in_use: { exit: 1, status: null, message: "The port is in use; pass --port." },
  slug_taken: { exit: 1, status: null, message: "A prototype with this slug already exists." },
  comment_not_found: { exit: 1, status: 404, message: "Comment not found." },
  message_not_owned: { exit: 1, status: 403, message: "Only the author can edit this message." },
  attachment_too_large: { exit: 1, status: 413, message: "Images are limited to 5 MB." },
  attachment_type: { exit: 1, status: 415, message: "Only PNG, JPEG, WebP or GIF images." },
  attachment_limit: { exit: 1, status: 422, message: "At most 6 images per message." },
  attachment_expired: { exit: 1, status: 410, message: "The upload expired; attach it again." },
  key_busy: { exit: 1, status: 409, message: "The review key is busy; retry." },
  cross_origin_write: {
    exit: null,
    status: 403,
    message: "Writes must come from the gallery's own origin.",
  },
  ambiguous_credentials: {
    exit: 4,
    status: 400,
    message: "Send a session or a bearer credential, not both.",
  },
  auth_required: { exit: 4, status: 401, message: "Sign in to review." },
  credential_revoked: { exit: 4, status: 401, message: "The credential was revoked." },
  invalid_credential: { exit: 4, status: 401, message: "The credential is not valid." },
  scope_denied: {
    exit: 4,
    status: 403,
    message: "Approval happens in the browser; credentials cannot approve.",
  },
  insecure_remote: {
    exit: 4,
    status: null,
    message: "Remote URLs must use HTTPS (loopback excepted).",
  },
  redirect_refused: {
    exit: 4,
    status: null,
    message: "The remote answered with a redirect; credentials are never re-sent.",
  },
  schema_mismatch: {
    exit: null,
    status: 503,
    message: "The review database schema does not match; run postgresStorage(sql).migrate().",
  },
  playwright_missing: {
    exit: 3,
    status: null,
    message: "Playwright Chromium is not installed. Run: bunx playwright install chromium",
  },
  migration_conflict: {
    exit: 1,
    status: null,
    message: "A target key exists with different content.",
  },
  migration_unverified: { exit: 1, status: null, message: "Migration verification failed." },
  migration_source_changed: {
    exit: 1,
    status: null,
    message: "The source changed during the run; put it in read-only mode, then re-run.",
  },
  source_not_read_only: {
    exit: 1,
    status: null,
    message:
      "The source accepted a write probe. Set PROTOTYPES_READ_ONLY=1 and drain requests first.",
  },
  invalid_source: {
    exit: 1,
    status: 422,
    message: "Source paths must stay inside the app's source roots.",
  },
  host_not_allowed: {
    exit: null,
    status: 403,
    message: "Open the gallery at 127.0.0.1 or add the host to dev.allowedHosts.",
  },
} as const satisfies Record<string, ErrorSpec>;

export type ErrorCode = keyof typeof errors;

/** A failure with a registry code; the CLI maps it to an exit code, the router to a status. */
export class ProtoError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? errors[code].message);
    this.name = "ProtoError";
    this.code = code;
    this.details = details;
  }

  get exit() {
    return errors[this.code].exit;
  }

  get status() {
    return errors[this.code].status;
  }
}

export function isProtoError(value: unknown): value is ProtoError {
  return value instanceof ProtoError;
}

/** JSON error envelope of the router and the server: `{ error: { code, message, …details } }`. */
export type ErrorBody = { error: { code: ErrorCode; message: string } & Record<string, unknown> };

export function errorBody(error: ProtoError): ErrorBody {
  return { error: { ...error.details, code: error.code, message: error.message } };
}

/** Problems fail `check` and `build`; warnings never do. */
export const problemCodes = [
  "duplicate_slug",
  "reserved_slug",
  "invalid_slug",
  "invalid_meta",
  "duplicate_state",
  "markup",
  "unknown_spec",
  "unknown_role",
  "network_import",
  "production_boundary",
  "flow_outside_root",
  "invalid_flow_id",
  "missing_flow",
  "invalid_flow",
  "unknown_prototype",
  "unknown_state",
  "duplicate_node",
  "invalid_node",
  "unknown_node",
  "duplicate_edge",
  "unreachable",
  "dead_end",
] as const;
export type ProblemCode = (typeof problemCodes)[number];

export const warningCodes = ["canvas_missing", "uncovered_state", "specs_unavailable"] as const;
export type WarningCode = (typeof warningCodes)[number];
