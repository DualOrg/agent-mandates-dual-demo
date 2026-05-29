# Agent Usage Guide

Agents use Agent Mandates as an authority checkpoint before consequential action.

Production MCP endpoint:

```text
https://agent-mandates-dual-demo.vercel.app/mcp
```

The MCP surface is read-only. It does not expose sync, mint, operator-token, or public-write tools.

## Agent Contract

The contract is:

```text
proposed action -> mandate evaluation -> continue / stop / escalate
```

Agents should call `agent_mandates_evaluate_action` before interacting with an external system such as a marketplace, exchange, payment rail, procurement API, workflow engine, or credential service.

## Decision Rule

1. Call `agent_mandates_evaluate_action` with the proposed action.
2. Continue only when `evaluation.result` is `Approved` and `evaluation.allowed` is `true`.
3. Stop when `evaluation.result` is `Blocked`.
4. Ask a human when `evaluation.result` is `Requires approval`.
5. Store `evaluation.proof.object_id`, `evaluation.proof.template_id`, and `evaluation.proof.decision_hash` in the agent audit trail when present.
6. Do not retry blocked actions with changed wording unless a human changes the mandate.
7. Do not call operator HTTP endpoints from an autonomous public agent.

## Available Tools

| Tool | Purpose | Writes |
| --- | --- | --- |
| `agent_mandates_get_status` | Read DUAL readiness and MCP safety state. | No |
| `agent_mandates_get_current` | Read the canonical DUAL mandate object when configured. | No |
| `agent_mandates_evaluate_action` | Evaluate an action and return `Approved`, `Blocked`, or `Requires approval`. | No |

## Available Resources

| Resource | Purpose |
| --- | --- |
| `agent-mandates://status` | Readiness, safety, and DUAL readback state. |
| `agent-mandates://current` | Current canonical mandate object when configured. |
| `agent-mandates://template` | Schema summary for `io.dual.agent_mandate.demo.v1`. |

## Available Prompt

| Prompt | Purpose |
| --- | --- |
| `agent_mandates_decision_brief` | Guide an agent to check delegated authority before consequential action. |

## Initialize

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"init","method":"initialize","params":{}}'
```

Expected safety posture:

```text
auth.required=false
readOnly=true
publicWrites=false
operatorWritesExposed=false
```

## Example Tool Call

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "evaluate-1",
    "method": "tools/call",
    "params": {
      "name": "agent_mandates_evaluate_action",
      "arguments": {
        "action": {
          "action_type": "purchase",
          "label": "Buy verified inventory token",
          "amount_usd": 175,
          "counterparty": "verified-seller.dual",
          "agent_wallet": "agent-mandates-demo-agent-wallet-001",
          "jurisdiction": "AU-NSW"
        }
      }
    }
  }'
```

## Response Fields To Keep

Agents should retain these fields in their own audit log:

| Field | Why it matters |
| --- | --- |
| `evaluation.result` | Main routing decision. |
| `evaluation.allowed` | Boolean gate for execution. |
| `evaluation.code` | Machine-readable reason. |
| `evaluation.reason` | Human-readable explanation. |
| `evaluation.source` | Whether the decision used DUAL readback or request-local state. |
| `evaluation.proof.object_id` | Canonical DUAL object id when available. |
| `evaluation.proof.template_id` | DUAL template id when available. |
| `evaluation.proof.policy_hash` | Active policy fingerprint. |
| `evaluation.proof.mandate_hash` | Mandate state fingerprint. |
| `evaluation.proof.last_event_hash` | Last synced event fingerprint. |
| `evaluation.proof.decision_hash` | Fingerprint for this action decision. |
| `evaluation.proof.evaluated_at` | Timestamp for the authority check. |

## Canonical Examples

### Buyer Agent

```json
{
  "action_type": "purchase",
  "label": "Buy verified inventory token",
  "amount_usd": 175,
  "counterparty": "verified-seller.dual",
  "agent_wallet": "agent-mandates-demo-agent-wallet-001",
  "jurisdiction": "AU-NSW"
}
```

Expected: `Approved`, unless the canonical DUAL mandate has been changed to require approval or block.

### Trading Agent

```json
{
  "action_type": "paper-trade",
  "label": "Kraken paper BUY DUALUSD",
  "amount_usd": 75,
  "counterparty": "kraken-paper:DUALUSD",
  "agent_wallet": "agent-mandates-demo-agent-wallet-001",
  "jurisdiction": "AU-NSW"
}
```

Expected: `Approved` under the demo mandate because the request is paper-only and below the spend limit.

### Procurement Agent

```json
{
  "action_type": "quote",
  "label": "Request supplier quote",
  "amount_usd": 0,
  "counterparty": "approved-vendor.dual",
  "agent_wallet": "agent-mandates-demo-agent-wallet-001",
  "jurisdiction": "AU-NSW"
}
```

Expected: `Approved`.

### Near-Threshold Action

```json
{
  "action_type": "purchase",
  "label": "Buy high-value verified inventory token",
  "amount_usd": 225,
  "counterparty": "verified-seller.dual",
  "agent_wallet": "agent-mandates-demo-agent-wallet-001",
  "jurisdiction": "AU-NSW"
}
```

Expected: `Requires approval` when `human_approval_required=true` and the amount is near the mandate limit.

Agent next step: stop autonomous execution and ask a human.

### Oversized Action

```json
{
  "action_type": "purchase",
  "label": "Buy inventory outside mandate",
  "amount_usd": 999,
  "counterparty": "unverified-seller.dual",
  "agent_wallet": "agent-mandates-demo-agent-wallet-001",
  "jurisdiction": "AU-NSW"
}
```

Expected: `Blocked` with `spend_limit_exceeded`.

Agent next step: stop before action.

### Wrong Agent Wallet

```json
{
  "action_type": "purchase",
  "label": "Buy verified inventory token",
  "amount_usd": 175,
  "counterparty": "verified-seller.dual",
  "agent_wallet": "wrong-agent-wallet",
  "jurisdiction": "AU-NSW"
}
```

Expected: `Blocked` with `agent_wallet_mismatch` when the canonical mandate has an agent wallet.

## Local Mandate Override

For tests and sandbox agents, a caller may pass a local `mandate` object:

```json
{
  "mandate": {
    "mandate_id": "mandate-agent-commerce-001",
    "agent_wallet": "agent-mandates-demo-agent-wallet-001",
    "authority_scope": "buyer-agent-commerce",
    "jurisdiction": "AU-NSW",
    "status": "active",
    "spend_limit_usd": 250,
    "human_approval_required": true,
    "legal_verified": true
  },
  "action": {
    "action_type": "purchase",
    "label": "Buy verified inventory token",
    "amount_usd": 175,
    "counterparty": "verified-seller.dual",
    "agent_wallet": "agent-mandates-demo-agent-wallet-001",
    "jurisdiction": "AU-NSW"
  }
}
```

Production agents should prefer canonical DUAL readback and treat local overrides as test-only unless a human operator explicitly chooses local evaluation.

## Runnable Harness

Run the included harness against production:

```bash
npm run agent:harness
```

Run it against a local server:

```bash
MCP_URL=http://127.0.0.1:4173/mcp npm run agent:harness
```

The harness checks:

- MCP initialize;
- tool list;
- read-only safety posture;
- public writes false;
- three approved scenarios;
- one blocked oversized scenario;
- decision hashes.

## Integration Pattern

Use this pattern in an agent tool router:

```text
1. Build action request.
2. Call agent_mandates_evaluate_action.
3. If Approved and allowed, call the downstream tool.
4. If Requires approval, ask a human and wait.
5. If Blocked, do not call the downstream tool.
6. Store the decision hash with the downstream action log or blocked-action log.
```

The downstream system might be Kraken, AutoChain, a procurement API, a payment rail, a credential verifier, or an internal workflow engine. Agent Mandates should sit before the action, not after it.

## Safety Notes For Agents

- Treat `Blocked` as final until the mandate changes.
- Treat `Requires approval` as human escalation, not a soft approval.
- Do not infer authority from natural language alone.
- Do not call `POST /api/mandates/sync` or `POST /api/mandates/mint` from a public autonomous agent.
- Do not ask the user for `DUAL_API_KEY` or `DEMO_OPERATOR_TOKEN`.
- Do not store secrets in the action label, counterparty, metadata, or proof logs.
- Do not claim DUAL write evidence from read-only evaluation responses.
