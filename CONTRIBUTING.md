# Contributing

This repository is a public DualOrg demo artifact for Agent Mandates.

## Ground Rules

- Keep public writes disabled.
- Keep MCP read-only unless a separate private safety review approves a write-capable surface.
- Do not commit secrets, API keys, operator tokens, private wallet material, screenshots containing secrets, or `.env` files.
- Do not store secrets in DUAL objects or audit metadata.
- Do not imply this demo is legal advice or an enforceable mandate product.
- Preserve the local no-credential path.

## Development Loop

```bash
npm install
npm run check
npm start
```

In another terminal:

```bash
npm run smoke
npm run agent:harness
```

Use a different port when needed:

```bash
PORT=4174 npm start
DEMO_BASE_URL=http://127.0.0.1:4174 npm run smoke
MCP_URL=http://127.0.0.1:4174/mcp npm run agent:harness
```

## Documentation Expectations

Update docs when behavior changes:

- README for user paths, API/MCP contract, safety boundary, and troubleshooting.
- `DEPLOYMENT.md` for environment variables and rollout checks.
- `docs/agent-mandates-demo-playbook.md` for presenter flow.
- `docs/agent-mandates-proof-run-sheet.md` for proof/readback walkthrough.
- `docs/agent-usage.md` for agent and MCP behavior.

## Pull Request Checklist

- `npm run check` passes.
- Smoke test passes locally or against a disposable deployment.
- MCP harness passes.
- No secrets are present in changed files.
- Public status still reports `publicWrites=false`.
- Write preview still reports `writable=false`.
- Wrong operator token still returns `403`.
- README/docs match the implemented behavior.

## License

No open-source license is declared yet. Treat the code as a DualOrg demo artifact until a `LICENSE` file is added.
