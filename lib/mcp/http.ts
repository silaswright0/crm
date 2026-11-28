import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mcpTokens, users, workspaces } from "@/lib/db/schema";
import { mcpTools } from "@/lib/mcp/catalog";
import { callTool, ToolError, toolNames } from "@/lib/mcp/handlers";

const PROTOCOL = "2025-03-26";

type RpcId = string | number | null;

type RpcMessage = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

for (const tool of mcpTools) {
  if (!toolNames.has(tool.name)) {
    throw new Error(`Missing MCP handler ${tool.name}`);
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function workspaceForToken(header: string | null) {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1] ?? "";
  if (!token.startsWith("ml_")) return { ok: false as const, error: "A bearer token is required.", status: 401 as const };

  const [row] = await db
    .select({
      workspaceId: workspaces.id,
      plan: workspaces.plan,
      userWorkspaceId: users.workspaceId,
    })
    .from(mcpTokens)
    .innerJoin(workspaces, eq(mcpTokens.workspaceId, workspaces.id))
    .innerJoin(users, and(eq(mcpTokens.userId, users.id), eq(users.workspaceId, workspaces.id)))
    .where(eq(mcpTokens.tokenHash, tokenHash(token)));

  if (!row || row.userWorkspaceId !== row.workspaceId) {
    return { ok: false as const, error: "That token does not open a book.", status: 401 as const };
  }
  if (row.plan !== "pro") {
    return { ok: false as const, error: "Pro is the plan that opens this door.", status: 403 as const };
  }
  return { ok: true as const, workspaceId: row.workspaceId };
}

function rpcBody(id: RpcId, payload: Record<string, unknown>) {
  return { jsonrpc: "2.0", id, ...payload };
}

function reply(request: Request, id: RpcId, payload: Record<string, unknown>, status = 200) {
  const body = rpcBody(id, payload);
  const accept = request.headers.get("accept") ?? "";
  const json = accept.includes("application/json") || !accept.includes("text/event-stream");
  if (!json) {
    return new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, {
      status,
      headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
    });
  }
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function rpcError(request: Request, id: RpcId, code: number, message: string, status = 200) {
  return reply(request, id, { error: { code, message } }, status);
}

function asId(value: unknown): RpcId {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function handleOne(request: Request, message: RpcMessage, workspaceId: string) {
  const id = asId(message.id);
  const hasId = Object.prototype.hasOwnProperty.call(message, "id");
  if (!hasId) return new Response(null, { status: 202 });
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(request, id, -32600, "Invalid request.");
  }

  const method = message.method;
  const params = message.params;

  if (method === "initialize") {
    const clientVersion =
      isRecord(params) && typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL;
    return reply(request, id, {
      result: {
        protocolVersion: clientVersion.startsWith("202") ? clientVersion : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "MusterLog", version: "0.1.0" },
        instructions:
          "This token opens one workspace. send_mail sends immediately and stores the letter only after the mail server accepts it. Stage and webhook rules wait whole days and hours, up to 90 days, and due letters leave on the hour.",
      },
    });
  }

  if (method === "ping" || method === "logging/setLevel") {
    return reply(request, id, { result: {} });
  }

  if (method === "tools/list") {
    return reply(request, id, {
      result: {
        tools: mcpTools.map((tool) => ({
          name: tool.name,
          description: tool.detail,
          inputSchema: tool.inputSchema,
        })),
      },
    });
  }

  if (method === "tools/call") {
    if (!isRecord(params) || typeof params.name !== "string") {
      return rpcError(request, id, -32602, "A tool name is required.");
    }
    const args = params.arguments === undefined ? {} : params.arguments;
    if (!isRecord(args)) return rpcError(request, id, -32602, "Tool arguments must be an object.");
    const tool = mcpTools.find((item) => item.name === params.name);
    if (!tool) {
      return reply(request, id, {
        result: { content: [{ type: "text", text: "That tool is not on this server." }], isError: true },
      });
    }
    try {
      const data = await callTool(workspaceId, tool.name, args);
      if (tool.writes) revalidatePath("/", "layout");
      return reply(request, id, {
        result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] },
      });
    } catch (error) {
      if (error instanceof ToolError) {
        return reply(request, id, {
          result: { content: [{ type: "text", text: error.message }], isError: true },
        });
      }
      console.error(error);
      return reply(request, id, {
        result: { content: [{ type: "text", text: "The book could not do that." }], isError: true },
      });
    }
  }

  return rpcError(request, id, -32601, "Method not found.");
}

export async function handleMcp(request: Request) {
  const auth = await workspaceForToken(request.headers.get("authorization"));
  if (!auth.ok) return rpcError(request, null, -32001, auth.error, auth.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(request, null, -32700, "Parse error.", 400);
  }

  if (Array.isArray(body)) {
    const responses = [];
    for (const item of body) {
      if (!isRecord(item)) {
        responses.push(rpcBody(null, { error: { code: -32600, message: "Invalid request." } }));
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(item, "id")) continue;
      const response = await handleOne(request, item, auth.workspaceId);
      const textBody = await response.text();
      if (!textBody) continue;
      const parsed = JSON.parse(textBody) as unknown;
      if (isRecord(parsed) && parsed.jsonrpc === "2.0") responses.push(parsed);
      else if (textBody.includes("data: ")) {
        const data = textBody.split("data: ").pop()?.trim();
        if (data) responses.push(JSON.parse(data));
      }
    }
    if (responses.length === 0) return new Response(null, { status: 202 });
    return Response.json(responses, { headers: { "cache-control": "no-store" } });
  }

  if (!isRecord(body)) return rpcError(request, null, -32600, "Invalid request.", 400);
  return handleOne(request, body, auth.workspaceId);
}
