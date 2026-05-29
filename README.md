# DUAL Agent Mandates Control Desk

A public demo that shows DUAL as the authority, policy, readback, and proof layer for AI-agent mandates.

The short version:

> Agents decide. DUAL proves whether they were allowed to act.

This repo is intentionally a proof surface. Public users can simulate, evaluate, verify, and generate local proof bundles. Live DUAL writes are operator-gated and are never exposed through the public MCP endpoint.

## Live Demo

Open the public demo:

<https://agent-mandates-dual-demo.vercel.app/>

What to look for:

- `Operator gated`: DUAL readback is live, but public writes are disabled.
- `DUAL readback`: the app reads the canonical mandate object when configured.
- `Authority corridor`: principal, agent, scope, jurisdiction, status, and spend limit.
- `Mandate state`: the currently active mandate and policy boundary.
- `Action verifier`: approve, block, or escalate proposed agent actions.
- `Proof path`: mandate hash, policy hash, state hash, integrity hash, decision hash, and local proof bundle hash.
- `DUAL readiness`: template, object, read channel, write channel, operator gate, and public-write status.
- `Read/write console`: read canonical DUAL state, apply readback locally, preview event-bus payloads, and run operator-gated sync or mint.
- `Audit log`: local demo events and operator-gated sync intent.

For presenter and operator guidance, use:

- [Demo playbook](docs/agent-mandates-demo-playbook.md)
- [Proof run sheet](docs/agent-mandates-proof-run-sheet.md)
- [Agent usage guide](docs/agent-usage.md)
- [Deployment notes](DEPLOYMENT.md)

## New User Paths

Use the path that matches what you are trying to do.

| Path | Use this when | Requires credentials |
| --- | --- | --- |
| Live demo viewer | You only want to inspect the public cockpit. | No |
| Agent developer | You want an MCP authority check before agent action. | No |
| Local developer | You want to run and change the app locally. | No |
| DUAL operator | You want to mint or sync the canonical mandate object. | Yes, scoped DUAL API key plus operator token |
| Legal/compliance reviewer | You want to assess the product idea and proof boundary. | No |

## Requirements

- Node.js 20 or newer.
- npm.
- Git.
- Network access to GitHub during `npm install` because `dual-sdk` is installed from `DualOrg/dual-sdk-ts`.

No Kraken keys, wallet private keys, or browser credentials are needed for the public read/evaluate path.

## Quick Start: Local Demo

```bash
git clone https://github.com/DualOrg/agent-mandates-dual-demo.git
cd agent-mandates-dual-demo
npm install
npm start
```

Open <http://127.0.0.1:4173>.

No `.env` file is required for local mode. The app will:

- Run the cockpit UI.
- Evaluate actions against the local demo mandate.
- Expose the read-only MCP facade.
- Preview DUAL write payloads without executing them.
- Keep DUAL writes disabled unless credentials and operator token are configured.

If port `4173` is busy:

```bash
PORT=4174 npm start
```

## Optional Local `.env`

For explicit local settings, copy the example:

```bash
cp .env.example .env
```

The default `.env.example` is safe for local simulation and keeps DUAL writes disabled. Do not put secrets in browser code, screenshots, logs, commits, or DUAL objects.

## First Run Walkthrough

After the app opens:

1. Confirm the header shows DUAL branding and `Operator gated`.
2. Confirm the disclosure says public visitors can simulate and verify, but not write.
3. Open the reviewer walkthrough and scan the three steps.
4. Use the default buyer-agent scenario.
5. Click `Verify agent action`.
6. Confirm the decision is `Approved` or `Requires approval` depending on the selected action.
7. Click `Generate proof bundle` and confirm a bundle hash appears in the proof rail.
8. Try the oversized purchase scenario and confirm it is blocked before execution.
9. Use the DUAL read/write console to read the canonical object or preview the sync payload.
10. Open `/mcp` or run the agent harness to verify the same read-only decision path is available to agents.

The approved action proves the happy path. The blocked action proves the mandate boundary.

## Test and Validate

Static syntax check:

```bash
npm run check
```

Smoke test against a running server:

```bash
npm start
```

In another terminal:

```bash
npm run smoke
```

Run the agent-facing MCP harness:

```bash
npm run agent:harness
```

To test a different URL:

```bash
DEMO_BASE_URL=http://127.0.0.1:4174 npm run smoke
MCP_URL=http://127.0.0.1:4174/mcp npm run agent:harness
```

Production checks:

```bash
DEMO_BASE_URL=https://agent-mandates-dual-demo.vercel.app npm run smoke
MCP_URL=https://agent-mandates-dual-demo.vercel.app/mcp npm run agent:harness
```

The smoke test checks the home page, status route, current mandate readback, read/write readiness, write preview, read-only evaluation path, MCP initialize/tools/resources, and wrong-token `403` behavior on operator sync/mint.

## Modes

### Local Mode

Local mode is the default and needs no credentials.

```text
DUAL_PERSISTENCE_MODE=local
DUAL_WRITE_MODE=read_only
```

Use this for local UI work, policy changes, documentation review, and screenshots.

### DUAL-Backed Readback Mode

DUAL-backed readback links the app to the canonical mandate object in IanTest.

Minimum server-side configuration:

```bash
DUAL_PERSISTENCE_MODE=dual
DUAL_API_URL=https://api-testnet.dual.network
DUAL_ORG_ID=69b935b4187e903f826bbe71
DUAL_AGENT_MANDATE_TEMPLATE_ID=6a165a580b0bf21f33c111ca
DUAL_AGENT_MANDATE_OBJECT_ID=6a165a5a0b0bf21f33c111cc
DUAL_API_KEY=...
DUAL_WRITE_MODE=read_only
```

The DUAL adapter is server-side only. If the SDK or credentials are unavailable, the app should fail safely to local read/evaluate behavior rather than implying live proof.

### Operator-Gated Write Mode

Operator-gated write mode allows an approved operator to sync or mint the canonical mandate object through server-side endpoints.

Additional configuration:

```bash
DUAL_WRITE_MODE=event_bus
DEMO_OPERATOR_TOKEN=...
```

Important:

- The browser never receives the DUAL API key.
- The public MCP server has no sync or mint tools.
- The operator token is sent only to `POST /api/mandates/sync` or `POST /api/mandates/mint`.
- Public status always reports `publicWrites=false`.

## DUAL Setup Checklist

1. Use IanTest org `69b935b4187e903f826bbe71`.
2. Create or confirm the template named `io.dual.agent_mandate.demo.v1`.
3. Seed one canonical demo mandate object.
4. Set `DUAL_AGENT_MANDATE_TEMPLATE_ID`.
5. Set `DUAL_AGENT_MANDATE_OBJECT_ID`.
6. Set a scoped server-side `DUAL_API_KEY`.
7. Set `DUAL_WRITE_MODE=read_only` for public readback-only deployments.
8. Set `DUAL_WRITE_MODE=event_bus` only when operator-gated sync is intended.
9. Set `DEMO_OPERATOR_TOKEN` only in server-side environment variables.
10. Verify:
    - `GET /api/dual/status`
    - `GET /api/mandates/current`
    - `GET /api/mandates/write-readiness`
    - `POST /api/mandates/evaluate`
    - `POST /api/mandates/preview`
    - `GET /mcp`
    - MCP `initialize`
    - MCP `tools/list`
    - MCP `agent_mandates_evaluate_action`

## API Quick Checks

```bash
curl https://agent-mandates-dual-demo.vercel.app/api/dual/status
curl https://agent-mandates-dual-demo.vercel.app/api/mandates/current
curl https://agent-mandates-dual-demo.vercel.app/api/mandates/write-readiness
curl https://agent-mandates-dual-demo.vercel.app/mcp
```

Evaluate an action:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/api/mandates/evaluate \
  -H 'content-type: application/json' \
  -d '{"action":{"action_type":"purchase","label":"Buy verified inventory token","amount_usd":175,"counterparty":"verified-seller.dual","agent_wallet":"agent-mandates-demo-agent-wallet-001","jurisdiction":"AU-NSW"}}'
```

Useful endpoints:

```text
GET  /api/dual/status
GET  /api/mandates/current
GET  /api/mandates/write-readiness
POST /api/mandates/evaluate
POST /api/mandates/preview   no write; payload preview only
POST /api/mandates/sync      operator token required
POST /api/mandates/mint      operator token required
GET  /mcp
POST /mcp
```

## MCP Quick Start

`POST /mcp` is a JSON-RPC MCP facade for agent clients. It is read-only and does not expose DUAL write tools.

Initialize:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

List tools:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Evaluate a proposed agent action:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"agent_mandates_evaluate_action","arguments":{"action":{"action_type":"purchase","label":"Buy verified inventory token","amount_usd":175,"counterparty":"verified-seller.dual","agent_wallet":"agent-mandates-demo-agent-wallet-001","jurisdiction":"AU-NSW"}}}}'
```

Available MCP tools:

- `agent_mandates_get_status`
- `agent_mandates_get_current`
- `agent_mandates_evaluate_action`

Available MCP resources:

- `agent-mandates://status`
- `agent-mandates://current`
- `agent-mandates://template`

Available MCP prompt:

- `agent_mandates_decision_brief`

For agent-side routing examples, see [Agent Usage](docs/agent-usage.md).

## DUAL Object Model

The demo uses a DUAL template named `io.dual.agent_mandate.demo.v1`.

MVP fields:

- `mandate_id`
- `principal_wallet`
- `agent_wallet`
- `authority_scope`
- `jurisdiction`
- `status`
- `spend_limit_usd`
- `human_approval_required`
- `legal_verified`
- `policy_version`
- `policy_hash`
- `mandate_hash`
- `last_event_hash`
- `breach_count`
- `action_count`
- `last_decision_result`
- `last_decision_reason`
- `last_request_label`
- `last_request_amount_usd`
- `last_request_counterparty`
- `last_event_type`
- `last_event_status`
- `updated_at`

Every evaluation returns proof metadata:

- canonical object id, when DUAL readback is configured;
- template id, when available from readback;
- state hash and integrity hash, when available from readback;
- policy hash, mandate hash, and last event hash;
- decision hash for the proposed action;
- evaluation timestamp.

## DUAL Links and Explorer Routes

The app keeps human-facing DUAL links and proof/search links where the public route can support them:

- Console org: `https://console-testnet.dual.network/{orgId}`
- Console template: `https://console-testnet.dual.network/{orgId}/collections/templates?templateId={templateId}`
- Console object: `https://console-testnet.dual.network/{orgId}/collections/objects?objectId={objectId}`
- L3 action explorer base: `https://explorer-testnet.dual.network`
- L2 explorer base: `https://explorer-test-v2.dual.network`

The current public v1 proof rail is readback and verifier focused. It does not claim an L1 roll-up transaction for every evaluation. Operator-gated sync events may create DUAL event-bus action evidence; public evaluation does not write.

## DUAL Read/Write Console

The app includes a DUAL read/write console in the right rail:

| Control | What it does | Writes |
| --- | --- | --- |
| `Refresh` | Reloads public status and write-readiness. | No |
| `Read DUAL` | Reads the canonical mandate object. | No |
| `Apply readback` | Copies loaded DUAL object values into the local cockpit controls. | No |
| `Preview` | Builds the event-bus update payload that would be sent. | No |
| `Sync update` | Updates the canonical DUAL mandate object. | Yes, operator token required |
| `Mint setup` | Mints a setup mandate object. Use only when no canonical object exists. | Yes, operator token required |

The preview route does not require the operator token because it does not execute a write. It exists so reviewers and operators can inspect the exact payload shape before approving a write.

The sync and mint routes require a browser confirmation and a valid `DEMO_OPERATOR_TOKEN`. The operator token is not stored in local state.

## Safety Rules

- Public users can simulate, evaluate, verify, and generate local proof bundles.
- Public users cannot mint or sync DUAL objects.
- The public MCP surface is read-only.
- Operator writes require `DEMO_OPERATOR_TOKEN`.
- DUAL API keys and operator tokens must remain server-side only.
- No keys should be placed in browser code, DUAL objects, screenshots, logs, or commits.
- This is not legal advice and not an enforceable mandate product.
- Live DUAL writes require explicit operator approval and a scoped server-side key.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `npm install` cannot fetch `dual-sdk` | GitHub access/network issue for `DualOrg/dual-sdk-ts`. | Confirm GitHub access and retry with network access. |
| Port `4173` is busy | Another local server is running. | Start with `PORT=4174 npm start`. |
| UI shows local mode | `DUAL_PERSISTENCE_MODE=local` or missing DUAL readback credentials. | Configure DUAL env vars only when live readback is needed. |
| `/api/dual/status` says readback is missing | Missing `DUAL_API_KEY` or `DUAL_AGENT_MANDATE_OBJECT_ID`. | Set server-side env vars and redeploy. |
| Preview works but sync fails | Preview is read-only; execution still needs write readiness and operator token. | Check `/api/mandates/write-readiness`. |
| Operator sync returns `403` | Missing or wrong `x-demo-operator-token` / bearer token. | Use the server-side configured operator token only for approved sync. |
| Operator sync returns `409` | Write mode, template id, object id, API key, or operator token is incomplete. | Check `/api/dual/status` and `DUAL_WRITE_MODE=event_bus`. |
| MCP client expects write tools | This MCP is intentionally read-only. | Use HTTP operator endpoints only for approved setup/sync. |
| Evaluation returns `Requires approval` | Action is near threshold under a human-approval mandate. | Escalate to a human; do not execute automatically. |

## Support and Contributing

This is a public demo repo under `DualOrg`.

- Issues: <https://github.com/DualOrg/agent-mandates-dual-demo/issues>
- Repository: <https://github.com/DualOrg/agent-mandates-dual-demo>
- Contribution guidance: [CONTRIBUTING.md](CONTRIBUTING.md)
- License status: no open-source license is declared yet. Treat the code as a DualOrg demo artifact until a `LICENSE` file is added.

## Build Roadmap

1. Add a public proof page for a single mandate decision.
2. Add exportable verifier packs for agent decisions.
3. Add durable read-only decision history sourced from DUAL readback.
4. Add richer template/action explorer links after stable DUAL routes are available.
5. Keep any write-capable MCP tools out of the public demo unless a separate private safety review approves them.
