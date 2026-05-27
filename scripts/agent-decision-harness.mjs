const mcpUrl = process.env.MCP_URL
  || (process.env.DEMO_BASE_URL ? `${process.env.DEMO_BASE_URL.replace(/\/+$/, "")}/mcp` : "https://agent-mandates-dual-demo.vercel.app/mcp");

const demoMandate = {
  mandate_id: "mandate-agent-commerce-001",
  principal_wallet: "69b92d49d5a95a6018672003",
  agent_wallet: "agent-mandates-demo-agent-wallet-001",
  authority_scope: "buyer-agent-commerce",
  jurisdiction: "AU-NSW",
  status: "active",
  spend_limit_usd: 250,
  human_approval_required: true,
  legal_verified: true,
  policy_version: 1
};

const scenarios = [
  {
    id: "buyer_inventory_purchase",
    description: "Buyer agent purchasing verified inventory",
    action: {
      action_type: "purchase",
      label: "Buy verified inventory token",
      amount_usd: 175,
      counterparty: "verified-seller.dual",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      jurisdiction: "AU-NSW"
    }
  },
  {
    id: "trading_agent_paper_trade",
    description: "Trading agent requesting a paper DUAL/USD trade",
    action: {
      action_type: "paper-trade",
      label: "Kraken paper BUY DUALUSD",
      amount_usd: 75,
      counterparty: "kraken-paper:DUALUSD",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      jurisdiction: "AU-NSW"
    }
  },
  {
    id: "procurement_quote",
    description: "Procurement agent requesting a quote",
    action: {
      action_type: "quote",
      label: "Request supplier quote",
      amount_usd: 0,
      counterparty: "approved-vendor.dual",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      jurisdiction: "AU-NSW"
    }
  },
  {
    id: "oversized_purchase",
    description: "Buyer agent attempts to exceed the mandate limit",
    action: {
      action_type: "purchase",
      label: "Buy inventory outside mandate",
      amount_usd: 999,
      counterparty: "unverified-seller.dual",
      agent_wallet: "agent-mandates-demo-agent-wallet-001",
      jurisdiction: "AU-NSW"
    }
  }
];

const initialized = await mcp("initialize", {});
if (initialized.serverInfo?.name !== "agent-mandates-dual-demo") {
  throw new Error(`Unexpected MCP server: ${initialized.serverInfo?.name || "unknown"}`);
}

const tools = await mcp("tools/list", {});
const toolNames = new Set((tools.tools || []).map((tool) => tool.name));
if (!toolNames.has("agent_mandates_evaluate_action")) {
  throw new Error("agent_mandates_evaluate_action tool is not available.");
}

const status = structured(await mcp("tools/call", {
  name: "agent_mandates_get_status",
  arguments: {}
}));

const decisions = [];
for (const scenario of scenarios) {
  const result = structured(await mcp("tools/call", {
    name: "agent_mandates_evaluate_action",
    arguments: {
      mandate: demoMandate,
      action: scenario.action
    }
  }));
  const evaluation = result.evaluation || {};
  decisions.push({
    id: scenario.id,
    description: scenario.description,
    decision: evaluation.result,
    agent_next_step: routeDecision(evaluation),
    reason: evaluation.reason,
    object_id: evaluation.proof?.object_id || null,
    decision_hash: evaluation.proof?.decision_hash || null,
    public_writes: result.publicWrites === true
  });
}

console.log(JSON.stringify({
  ok: true,
  mcp_url: mcpUrl,
  server: initialized.serverInfo,
  read_only: status.safety?.readOnly === true,
  public_writes: status.safety?.publicWrites === true,
  decisions
}, null, 2));

async function mcp(method, params) {
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${Date.now()}-${method}`,
      method,
      params
    })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `MCP ${method} failed with HTTP ${response.status}`);
  }
  return payload.result;
}

function structured(toolResult) {
  if (toolResult?.structuredContent) return toolResult.structuredContent;
  const text = toolResult?.content?.find((item) => item.type === "text")?.text;
  return text ? JSON.parse(text) : toolResult;
}

function routeDecision(evaluation = {}) {
  if (evaluation.result === "Approved" && evaluation.allowed) return "continue";
  if (evaluation.result === "Requires approval") return "escalate_to_human";
  return "stop";
}
