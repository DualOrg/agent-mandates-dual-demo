import {
  evaluateMandateAction,
  normalizeMandateProperties,
  readBody,
  readCurrentObject,
  readiness
} from "./_dual.js";

const protocolVersion = "2025-06-18";
const serverInfo = {
  name: "agent-mandates-dual-demo",
  version: "0.1.0"
};

const tools = [
  tool("agent_mandates_get_status", "Read Agent Mandates DUAL readiness and safety state. Returns no secrets.", {
    type: "object",
    additionalProperties: false,
    properties: {}
  }),
  tool("agent_mandates_get_current", "Read the canonical DUAL-backed mandate object when configured.", {
    type: "object",
    additionalProperties: false,
    properties: {}
  }),
  tool("agent_mandates_evaluate_action", "Evaluate a proposed agent action against the canonical DUAL-backed mandate. This is read-only and never writes.", {
    type: "object",
    additionalProperties: false,
    required: ["action"],
    properties: {
      action: {
        type: "object",
        additionalProperties: true,
        required: ["action_type", "amount_usd"],
        properties: {
          action_type: { type: "string", description: "Requested action, such as purchase, quote, transfer, or paper-trade." },
          label: { type: "string", description: "Human-readable action label." },
          amount_usd: { type: "number", description: "Requested USD amount or notional." },
          counterparty: { type: "string", description: "Seller, venue, service, or counterparty." },
          agent_wallet: { type: "string", description: "Agent wallet or identifier making the request." },
          jurisdiction: { type: "string", description: "Jurisdiction for the action request." },
          authority_scope: { type: "string", description: "Optional action-supplied scope hint." }
        }
      },
      mandate: {
        type: "object",
        additionalProperties: true,
        description: "Optional local mandate override. Production normally uses DUAL readback instead."
      },
      properties: {
        type: "object",
        additionalProperties: true,
        description: "Alias for mandate override."
      }
    }
  })
];

const resources = [
  resource("agent-mandates://status", "Agent Mandates status", "Readiness, safety, and DUAL readback state."),
  resource("agent-mandates://current", "Current mandate", "Canonical DUAL mandate object readback."),
  resource("agent-mandates://template", "Mandate template", "MCP-facing summary of the Agent Mandates v1 schema.")
];

const prompts = [
  {
    name: "agent_mandates_decision_brief",
    description: "Guide an agent to check delegated authority before consequential action.",
    arguments: []
  }
];

export default async function handler(request, response) {
  setMcpHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end?.();
    return;
  }

  if (request.method === "GET") {
    response.status(200).json({
      ok: true,
      endpoint: "/mcp",
      protocolVersion,
      serverInfo,
      auth: { required: false, type: "none" },
      safety: {
        readOnly: true,
        publicWrites: false,
        operatorWritesExposed: false
      },
      tools: tools.map((item) => item.name),
      resources: resources.map((item) => item.uri)
    });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "method_not_allowed", message: "MCP endpoint accepts POST requests." });
    return;
  }

  let message = null;
  try {
    message = await readBody(request);
    if (!message || message.jsonrpc !== "2.0" || !message.method) {
      throw Object.assign(new Error("Invalid JSON-RPC request."), { code: -32600 });
    }
    if (message.id === undefined && String(message.method).startsWith("notifications/")) {
      response.status(202).end?.();
      return;
    }
    const result = await handleMethod(message.method, message.params || {});
    response.status(200).json({ jsonrpc: "2.0", id: message.id ?? null, result });
  } catch (error) {
    response.status(200).json({
      jsonrpc: "2.0",
      id: message?.id ?? null,
      error: {
        code: error.code && Number.isInteger(error.code) ? error.code : -32603,
        message: error.message || "MCP server error.",
        data: {
          code: error.name || "mcp_error",
          detail: error.detail || error.readiness || null
        }
      }
    });
  }
}

async function handleMethod(method, params) {
  if (method === "initialize") {
    return {
      protocolVersion,
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      serverInfo,
      auth: {
        required: false,
        type: "none",
        detail: "This MCP exposes read-only mandate status, readback, and action evaluation. It does not expose operator-gated DUAL writes."
      },
      instructions: "Use agent_mandates_evaluate_action before consequential autonomous action. Treat Approved as allowed, Blocked as deny-before-execution, and Requires approval as a human escalation."
    };
  }
  if (method === "tools/list") return { tools };
  if (method === "resources/list") return { resources };
  if (method === "prompts/list") return { prompts };
  if (method === "tools/call") return toolContent(await callTool(params.name, params.arguments || {}));
  if (method === "resources/read") return readResource(params.uri);
  if (method === "prompts/get") return getPrompt(params.name);
  throw Object.assign(new Error(`Unsupported MCP method: ${method}`), { code: -32601 });
}

async function callTool(name, args) {
  switch (name) {
    case "agent_mandates_get_status":
      return {
        ok: true,
        status: readiness(),
        safety: {
          readOnly: true,
          publicWrites: false,
          operatorWritesExposed: false
        }
      };
    case "agent_mandates_get_current":
      return { ok: true, current: await safeCurrentMandate() };
    case "agent_mandates_evaluate_action":
      return evaluateAction(args);
    default:
      throw Object.assign(new Error(`Unknown Agent Mandates MCP tool: ${name}`), { code: -32602 });
  }
}

async function evaluateAction(args = {}) {
  const status = readiness();
  let source = "request";
  let object = null;
  let properties = normalizeMandateProperties(args.mandate || args.properties || {});

  if (status.readbackReady) {
    try {
      const current = await readCurrentObject();
      if (current.available && current.properties) {
        source = "dual_readback";
        object = current.object;
        properties = normalizeMandateProperties(current.properties);
      }
    } catch (error) {
      if (!args.mandate && !args.properties) throw error;
      source = "request_fallback";
    }
  }

  const evaluation = evaluateMandateAction(properties, args.action || args.request || args, { source, object });
  return {
    ok: true,
    evaluated: true,
    writable: false,
    publicWrites: false,
    status,
    evaluation
  };
}

async function safeCurrentMandate() {
  if (!readiness().readbackReady) {
    return { available: false, reason: readiness().detail, status: readiness() };
  }
  return readCurrentObject();
}

async function readResource(uri) {
  if (uri === "agent-mandates://status") {
    return resourceContent(uri, {
      ok: true,
      status: readiness(),
      safety: {
        readOnly: true,
        publicWrites: false,
        operatorWritesExposed: false
      }
    });
  }
  if (uri === "agent-mandates://current") {
    return resourceContent(uri, { ok: true, current: await safeCurrentMandate() });
  }
  if (uri === "agent-mandates://template") {
    return resourceContent(uri, {
      ok: true,
      schemaVersion: "io.dual.agent_mandate.demo.v1",
      fields: [
        "principal_wallet",
        "agent_wallet",
        "authority_scope",
        "jurisdiction",
        "status",
        "spend_limit_usd",
        "human_approval_required",
        "policy_hash",
        "mandate_hash",
        "last_event_hash",
        "last_decision_result",
        "last_request_amount_usd",
        "updated_at"
      ]
    });
  }
  throw Object.assign(new Error(`Unknown Agent Mandates MCP resource: ${uri}`), { code: -32602 });
}

function getPrompt(name) {
  if (name !== "agent_mandates_decision_brief") {
    throw Object.assign(new Error(`Unknown Agent Mandates MCP prompt: ${name}`), { code: -32602 });
  }
  return {
    description: "Agent Mandates decision brief",
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: "Before a consequential action, call agent_mandates_evaluate_action with the proposed action. Continue only for Approved, block on Blocked, and ask a human for Requires approval. Include the decision hash and object id in your audit trail."
      }
    }]
  };
}

function toolContent(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

function resourceContent(uri, payload) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function tool(name, description, inputSchema) {
  return {
    name,
    description,
    inputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    },
    "x-dual": {
      requiresAuthentication: false,
      readOnly: true,
      publicWrites: false,
      operatorWritesExposed: false
    }
  };
}

function resource(uri, name, description) {
  return { uri, name, description, mimeType: "application/json" };
}

function setMcpHeaders(response) {
  response.setHeader?.("Cache-Control", "no-store");
  response.setHeader?.("X-Content-Type-Options", "nosniff");
  response.setHeader?.("MCP-Protocol-Version", protocolVersion);
  response.setHeader?.("Access-Control-Allow-Origin", "*");
  response.setHeader?.("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader?.("Access-Control-Allow-Headers", "content-type, accept, mcp-protocol-version, mcp-session-id");
}
