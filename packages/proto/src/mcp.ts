import { z } from "zod";
import { catalog, argumentSchema, executeCapability } from "./capabilities/catalog.ts";
import { ProtoError, errorBody } from "./model/errors.ts";
import type { ProtoProject } from "./node/project.ts";
export const mcpTools = catalog
  .filter(c => c.mcp)
  .map(c => ({
    name: c.mcp!,
    description: `${c.cli}: ${c.authority}`,
    inputSchema: z.toJSONSchema(c.store ? argumentSchema : argumentSchema.omit({ remote: true }), {
      io: "input",
    }),
  }));
export async function executeTool(name: string, input: unknown, project: ProtoProject) {
  const capability = catalog.find(c => c.mcp === name);
  if (!capability) throw new Error(`Unknown tool ${name}`);
  return executeCapability(capability, argumentSchema.parse(input), {
    root: project.root,
    project,
    transport: "mcp",
  });
}
export async function createMcpServer(project: ProtoProject) {
  const [{ Server }, { ListToolsRequestSchema, CallToolRequestSchema }] = await Promise.all([
    import("@modelcontextprotocol/sdk/server/index.js"),
    import("@modelcontextprotocol/sdk/types.js"),
  ]);
  const server = new Server({ name: "proto", version: "0.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const result = await executeTool(
        request.params.name,
        request.params.arguments ?? {},
        project
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              error instanceof ProtoError
                ? errorBody(error)
                : { error: { message: error instanceof Error ? error.message : String(error) } }
            ),
          },
        ],
      };
    }
  });
  return server;
}
export async function startMcp(project: ProtoProject) {
  try {
    const [{ StdioServerTransport }, server] = await Promise.all([
      import("@modelcontextprotocol/sdk/server/stdio.js"),
      createMcpServer(project),
    ]);
    await server.connect(new StdioServerTransport());
    return server;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      const missing = new Error("Install optional peer @modelcontextprotocol/sdk to run proto mcp");
      missing.name = "MissingDependencyError";
      throw missing;
    }
    throw error;
  }
}
