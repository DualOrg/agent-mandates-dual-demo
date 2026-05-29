const baseUrl = process.env.DEMO_BASE_URL || "http://127.0.0.1:4173";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.operatorToken ? { "x-demo-operator-token": options.operatorToken } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

async function mcp(method, params = {}) {
  const result = await request("/mcp", {
    method: "POST",
    body: {
      jsonrpc: "2.0",
      id: `smoke-${method}`,
      method,
      params
    }
  });
  assert(result.response.ok, `MCP ${method} returns HTTP 200`);
  if (result.body.error) throw new Error(`MCP ${method} failed: ${result.body.error.message}`);
  return result.body.result;
}

function mcpJson(toolResult) {
  const text = toolResult?.content?.find((item) => item.type === "text")?.text;
  return text ? JSON.parse(text) : toolResult?.structuredContent;
}

const home = await fetch(baseUrl);
assert(home.ok, "home page loads");
assert((await home.text()).includes("DUAL Agent Mandates"), "home page includes cockpit title");

const status = await request("/api/dual/status");
assert(status.response.ok, "status endpoint returns 200");
assert(status.body.publicWrites === false, "status endpoint reports no public writes");
assert(!("apiKey" in status.body), "status endpoint does not expose API key");
assert(status.body.orgId === "69b935b4187e903f826bbe71", "status endpoint defaults to IanTest org");

const current = await request("/api/mandates/current");
assert(current.response.ok, "current mandate endpoint degrades safely");
assert(typeof current.body.available === "boolean", "current mandate endpoint reports availability");

const writeReadiness = await request("/api/mandates/write-readiness");
assert(writeReadiness.response.ok, "write readiness endpoint returns 200");
assert(writeReadiness.body.write?.publicWrites === false, "write readiness reports no public writes");
assert(writeReadiness.body.write?.exposedThroughMcp === false, "write readiness reports no MCP write exposure");
assert(Array.isArray(writeReadiness.body.requirements), "write readiness reports requirements");

const allowedEvaluation = await request("/api/mandates/evaluate", {
  method: "POST",
  body: {
    mandate: {
      mandate_id: "mandate-agent-commerce-001",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      authority_scope: "buyer-agent-commerce",
      jurisdiction: "AU-NSW",
      status: "active",
      spend_limit_usd: 250,
      human_approval_required: true,
      legal_verified: true
    },
    action: {
      action_type: "purchase",
      label: "Buy verified inventory token",
      amount_usd: 175,
      counterparty: "verified-seller.dual",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      jurisdiction: "AU-NSW"
    }
  }
});
assert(allowedEvaluation.response.ok, "evaluate endpoint returns 200");
assert(allowedEvaluation.body.evaluation?.result === "Approved", "evaluate endpoint approves in-scope action");
assert(allowedEvaluation.body.evaluation?.proof?.decision_hash, "evaluate endpoint returns a decision hash");
assert(allowedEvaluation.body.publicWrites === false, "evaluate endpoint never enables public writes");

const blockedEvaluation = await request("/api/mandates/evaluate", {
  method: "POST",
  body: {
    mandate: {
      mandate_id: "mandate-agent-commerce-001",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      authority_scope: "buyer-agent-commerce",
      jurisdiction: "AU-NSW",
      status: "active",
      spend_limit_usd: 250,
      human_approval_required: true,
      legal_verified: true
    },
    action: {
      action_type: "purchase",
      label: "Buy inventory outside mandate",
      amount_usd: 999,
      counterparty: "unverified-seller.dual",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      jurisdiction: "AU-NSW"
    }
  }
});
assert(blockedEvaluation.response.ok, "evaluate endpoint returns blocked decision as 200");
assert(blockedEvaluation.body.evaluation?.result === "Blocked", "evaluate endpoint blocks over-limit action");

const writePreview = await request("/api/mandates/preview", {
  method: "POST",
  body: {
    action: "sync",
    properties: {
      mandate_id: "mandate-agent-commerce-001",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      authority_scope: "buyer-agent-commerce",
      jurisdiction: "AU-NSW",
      status: "active",
      spend_limit_usd: 250,
      human_approval_required: true,
      legal_verified: true
    },
    auditEvent: {
      type: "ok",
      title: "Smoke preview",
      detail: "No write should execute."
    }
  }
});
assert(writePreview.response.ok, "write preview endpoint returns 200");
assert(writePreview.body.writable === false, "write preview does not execute writes");
assert(writePreview.body.publicWrites === false, "write preview reports no public writes");
assert(writePreview.body.operatorTokenRequiredForExecution === true, "write preview requires operator token for execution");
assert(writePreview.body.payloadPreview?.action?.update, "write preview returns update payload shape");

const mcpInfo = await request("/mcp");
assert(mcpInfo.response.ok, "MCP endpoint advertises itself over GET");
assert(mcpInfo.body.safety?.readOnly === true, "MCP endpoint advertises read-only safety");

const mcpInit = await mcp("initialize", {});
assert(mcpInit.protocolVersion === "2025-06-18", "MCP initialize returns current protocol version");
assert(mcpInit.serverInfo.name === "agent-mandates-dual-demo", "MCP initialize returns server name");

const mcpTools = await mcp("tools/list", {});
const mcpToolNames = mcpTools.tools.map((tool) => tool.name);
assert(mcpToolNames.includes("agent_mandates_get_status"), "MCP exposes status tool");
assert(mcpToolNames.includes("agent_mandates_get_current"), "MCP exposes current mandate tool");
assert(mcpToolNames.includes("agent_mandates_evaluate_action"), "MCP exposes action evaluation tool");
assert(mcpTools.tools.every((tool) => tool.annotations?.readOnlyHint === true), "MCP tools are read-only annotated");

const mcpStatus = mcpJson(await mcp("tools/call", {
  name: "agent_mandates_get_status",
  arguments: {}
}));
assert(mcpStatus.safety?.publicWrites === false, "MCP status does not expose public writes");

const mcpAllowed = mcpJson(await mcp("tools/call", {
  name: "agent_mandates_evaluate_action",
  arguments: {
    mandate: {
      mandate_id: "mandate-agent-commerce-001",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      authority_scope: "buyer-agent-commerce",
      jurisdiction: "AU-NSW",
      status: "active",
      spend_limit_usd: 250,
      human_approval_required: true,
      legal_verified: true
    },
    action: {
      action_type: "purchase",
      label: "Buy verified inventory token",
      amount_usd: 175,
      counterparty: "verified-seller.dual",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      jurisdiction: "AU-NSW"
    }
  }
}));
assert(mcpAllowed.evaluation?.result === "Approved", "MCP evaluation approves in-scope action");
assert(mcpAllowed.evaluation?.proof?.decision_hash, "MCP evaluation returns decision hash");
assert(mcpAllowed.publicWrites === false, "MCP evaluation remains read-only");

const mcpResources = await mcp("resources/list", {});
assert(mcpResources.resources.some((resource) => resource.uri === "agent-mandates://current"), "MCP exposes current mandate resource");
const currentResource = await mcp("resources/read", { uri: "agent-mandates://current" });
assert(currentResource.contents?.[0]?.mimeType === "application/json", "MCP current resource returns JSON content");

const rejectedSync = await request("/api/mandates/sync", {
  method: "POST",
  operatorToken: "wrong",
  body: {
    properties: {
      mandate_id: "mandate-agent-commerce-001",
      status: "active"
    }
  }
});
assert(rejectedSync.response.status === 403, "sync endpoint rejects missing or wrong operator token");

const rejectedMint = await request("/api/mandates/mint", {
  method: "POST",
  operatorToken: "wrong",
  body: {
    properties: {
      mandate_id: "mandate-agent-commerce-001",
      status: "active"
    }
  }
});
assert(rejectedMint.response.status === 403, "mint endpoint rejects missing or wrong operator token");

console.log("smoke test passed");
