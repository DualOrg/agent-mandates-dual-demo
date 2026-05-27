# Agent Mandates DUAL Demo

Public DUAL-backed cockpit for buyer-controlled AI agent authority.

The app demonstrates a principal granting a bounded mandate to an agent, local policy simulation, revocation, proof hashes, audit events, and operator-gated DUAL sync.

## Local Use

```bash
npm install
npm start
```

Open `http://127.0.0.1:4173`.

Validation:

```bash
npm run check
DEMO_BASE_URL=http://127.0.0.1:4173 npm run smoke
```

## DUAL Backing

Safe defaults keep the app local-only. Public visitors can simulate policy decisions without creating DUAL writes.

Required production variables for DUAL readback:

```text
DUAL_PERSISTENCE_MODE=dual
DUAL_API_URL=https://api-testnet.dual.network
DUAL_ORG_ID=69b935b4187e903f826bbe71
DUAL_AGENT_MANDATE_TEMPLATE_ID=<template id>
DUAL_AGENT_MANDATE_OBJECT_ID=<object id>
DUAL_API_KEY=<scoped server-side key>
DUAL_WRITE_MODE=read_only
```

Required variables for operator-gated DUAL sync:

```text
DUAL_WRITE_MODE=event_bus
DEMO_OPERATOR_TOKEN=<generated operator token>
```

Never expose the DUAL API key or operator token in browser code. The browser only sends the operator token to `POST /api/mandates/sync` or `POST /api/mandates/mint`.

## API

- `GET /api/dual/status` returns readiness without secrets.
- `GET /api/mandates/current` returns the canonical DUAL mandate object when linked.
- `POST /api/mandates/evaluate` returns a read-only allow/block decision for a proposed agent action. It reads the canonical DUAL mandate when linked and never writes.
- `POST /api/mandates/sync` updates the canonical mandate object. Requires `x-demo-operator-token`.
- `POST /api/mandates/mint` mints a setup object. Requires `x-demo-operator-token`.

Example external gate request:

```bash
curl -s https://agent-mandates-dual-demo.vercel.app/api/mandates/evaluate \
  -H 'content-type: application/json' \
  -d '{"action":{"action_type":"purchase","label":"Buy verified inventory token","amount_usd":175,"agent_wallet":"agent-mandates-demo-agent-wallet-001","jurisdiction":"AU-NSW"}}'
```

## Template

`dual-agent-mandate-template.json` defines `io.dual.agent_mandate.demo.v1` for IanTest (`69b935b4187e903f826bbe71`). It uses the v1 MVP fields: principal wallet, agent wallet, authority scope, jurisdiction, status, spend limit, human approval flag, policy/hash fields, event counts, last decision, last request, and timestamp.

## Safety Boundary

This is a demo proof surface, not legal advice or an enforceable mandate product. It stores hashes and demo metadata only. Live DUAL writes require explicit approval and scoped server-side credentials.
