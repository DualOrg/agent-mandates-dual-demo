# Deployment Notes

## Local Demo

Use local mode for the safest development loop:

```bash
npm install
npm start
```

Open <http://127.0.0.1:4173>.

Local mode supports the UI, REST evaluator, read-only MCP facade, smoke tests, and agent harness without DUAL credentials.

## Vercel Deployment

The app is a static cockpit plus Vercel serverless API routes.

Production URL:

<https://agent-mandates-dual-demo.vercel.app/>

Recommended public posture:

- DUAL readback enabled.
- Public writes disabled.
- MCP read-only.
- Sync and mint endpoints operator-gated.
- No live DUAL write on page load.

## Environment

No environment variables are required for local simulation.

For DUAL-backed readback in production:

```text
DUAL_PERSISTENCE_MODE=dual
DUAL_API_URL=https://api-testnet.dual.network
DUAL_ORG_ID=69b935b4187e903f826bbe71
DUAL_AGENT_MANDATE_TEMPLATE_ID=6a165a580b0bf21f33c111ca
DUAL_AGENT_MANDATE_OBJECT_ID=6a165a5a0b0bf21f33c111cc
DUAL_API_KEY=...
DUAL_WRITE_MODE=read_only
```

For operator-gated event-bus writes:

```text
DUAL_WRITE_MODE=event_bus
DEMO_OPERATOR_TOKEN=...
```

Optional link bases:

```text
DUAL_CONSOLE_BASE_URL=https://console-testnet.dual.network
DUAL_L3_EXPLORER_BASE_URL=https://explorer-testnet.dual.network
DUAL_L2_EXPLORER_BASE_URL=https://explorer-test-v2.dual.network
```

Do not store `DUAL_API_KEY` or `DEMO_OPERATOR_TOKEN` in client code, docs, screenshots, logs, DUAL objects, or commits.

## DUAL-Backed Deployment

The production demo currently targets IanTest:

```text
DUAL_ORG_ID=69b935b4187e903f826bbe71
DUAL_AGENT_MANDATE_TEMPLATE_ID=6a165a580b0bf21f33c111ca
DUAL_AGENT_MANDATE_OBJECT_ID=6a165a5a0b0bf21f33c111cc
```

Template name:

```text
io.dual.agent_mandate.demo.v1
```

The runtime needs `dual-sdk` available. If the SDK import fails, the app uses a direct HTTP DUAL client. If DUAL credentials are missing, public routes should report clear readiness gaps and keep the demo in local/read-only mode.

## Operator Write Flow

The write-capable endpoints are:

```text
POST /api/mandates/sync
POST /api/mandates/mint
```

Both require:

- server-side `DUAL_API_KEY`;
- server-side `DEMO_OPERATOR_TOKEN`;
- `DUAL_WRITE_MODE=event_bus`;
- matching template/object configuration;
- request header `x-demo-operator-token` or `Authorization: Bearer ...`.

Wrong or missing operator token must return `403`. Incomplete write readiness should return `409`.

The public MCP endpoint must remain read-only:

```text
GET  /mcp
POST /mcp
```

It exposes status, current mandate readback, and evaluation only. It does not expose sync or mint.

## Recommended Rollout

1. Deploy local-safe code with `DUAL_PERSISTENCE_MODE=local`.
2. Confirm `npm run check`, local smoke, and local MCP harness.
3. Configure production readback env vars.
4. Deploy and verify `GET /api/dual/status`.
5. Confirm `publicWrites=false` and `operatorGateConfigured=true` if write mode is configured.
6. Verify `GET /api/mandates/current` returns the canonical object or a clear readiness message.
7. Verify `POST /api/mandates/evaluate` returns a decision hash without writing.
8. Verify `GET /mcp`, MCP `initialize`, MCP `tools/list`, and `agent_mandates_evaluate_action`.
9. Verify wrong-token `POST /api/mandates/sync` returns `403`.
10. Perform an operator sync only when explicitly approved for that run.

## API and MCP Checks

Public status:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/api/dual/status
```

Current mandate:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/api/mandates/current
```

Read-only evaluator:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/api/mandates/evaluate \
  -H 'content-type: application/json' \
  -d '{"action":{"action_type":"purchase","label":"Buy verified inventory token","amount_usd":175,"counterparty":"verified-seller.dual","agent_wallet":"agent-mandates-demo-agent-wallet-001","jurisdiction":"AU-NSW"}}'
```

MCP initialize:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

Production smoke:

```bash
DEMO_BASE_URL=https://agent-mandates-dual-demo.vercel.app npm run smoke
MCP_URL=https://agent-mandates-dual-demo.vercel.app/mcp npm run agent:harness
```

## Public Contract

The public contract is:

- HTTP status/readback/evaluation routes are safe for public inspection.
- MCP is safe for public agent clients because it is read-only.
- Public evaluation can return DUAL readback identifiers and hashes.
- Public evaluation never mutates DUAL state.
- Operator endpoints are present for setup and approved sync only.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `readbackReady=false` | Check `DUAL_API_KEY` and `DUAL_AGENT_MANDATE_OBJECT_ID`. |
| `writable=false` in production | Confirm this is intended. If not, check `DUAL_WRITE_MODE=event_bus`, `DEMO_OPERATOR_TOKEN`, template id, object id, and API key. |
| `/api/mandates/current` returns unavailable | Treat as local/read-only demo state; do not imply live object proof. |
| MCP returns no write tools | Correct behavior. This MCP is intentionally read-only. |
| Operator sync returns `403` | Wrong token or missing token. Do not retry with guessed values. |
| Operator sync returns `409` | Write readiness is incomplete. Inspect `/api/dual/status`. |
| Vercel deploy uses stale UI | Redeploy from the latest commit and verify the alias. |

## Safety Boundary

Do not enable public DUAL writes for this repo. The intended public pattern is:

```text
read -> evaluate -> verify -> generate local proof bundle
```

The operator pattern is:

```text
review -> approve -> send operator token -> sync/mint through server route
```

No live DUAL write should happen on page load, through MCP, or through unauthenticated public API calls.
