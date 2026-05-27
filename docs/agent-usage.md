# Agent Usage

Agents use Agent Mandates as an authority checkpoint before consequential action.

MCP endpoint:

```text
https://agent-mandates-dual-demo.vercel.app/mcp
```

## Decision Rule

1. Call `agent_mandates_evaluate_action` with the proposed action.
2. Continue only when `evaluation.result` is `Approved` and `evaluation.allowed` is `true`.
3. Stop when `evaluation.result` is `Blocked`.
4. Ask a human when `evaluation.result` is `Requires approval`.
5. Store `evaluation.proof.object_id` and `evaluation.proof.decision_hash` in the agent audit trail.

The MCP is read-only. It does not expose `sync`, `mint`, operator-token, or public-write tools.

## Tools

| Tool | Purpose |
| --- | --- |
| `agent_mandates_get_status` | Read DUAL readiness and MCP safety state. |
| `agent_mandates_get_current` | Read the canonical DUAL mandate object when configured. |
| `agent_mandates_evaluate_action` | Evaluate an action and return `Approved`, `Blocked`, or `Requires approval`. |

## Example Call

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

Expected: `Approved`.

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

## Runnable Harness

Run the included harness against production:

```bash
npm run agent:harness
```

Run it against a local server:

```bash
MCP_URL=http://127.0.0.1:4173/mcp npm run agent:harness
```
