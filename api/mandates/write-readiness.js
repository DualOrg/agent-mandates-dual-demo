import { dualConfig, readiness } from "../_dual.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const config = dualConfig();
  const status = readiness();
  const hasApiKey = Boolean(config.apiKey);
  const hasTemplate = Boolean(config.templateId);
  const hasObject = Boolean(config.objectId);
  const hasOperatorGate = Boolean(config.operatorToken);
  const eventBusMode = config.writeMode === "event_bus";
  const networkReadAllowed = Boolean(status.network?.read_allowed);
  const networkWriteAllowed = Boolean(status.network?.write_allowed);
  const mainnetRequirements = status.network?.mainnet_requested
    ? [
        {
          name: "AGENT_MANDATES_MAINNET_READONLY_CONFIRMED=true",
          configured: Boolean(status.network?.mainnet_readonly_confirmed),
          scope: "server",
          requiredFor: "mainnet readback"
        },
        {
          name: "AGENT_MANDATES_MAINNET_CUTOVER_CONFIRMED=true",
          configured: Boolean(status.network?.mainnet_cutover_confirmed),
          scope: "server",
          requiredFor: "mainnet writes"
        }
      ]
    : [];

  response.status(200).json({
    ok: true,
    mode: config.mode,
    runtime: status.runtime,
    targetNetwork: status.targetNetwork,
    network: status.network,
    orgId: config.orgId,
    templateId: config.templateId || null,
    objectId: config.objectId || null,
    read: {
      enabled: status.readbackReady,
      source: status.readbackReady ? "dual_object_readback" : "local_preview",
      networkAllowed: networkReadAllowed,
      missing: status.readbackReady ? [] : status.missing.filter((item) => item !== "DUAL_AGENT_MANDATE_TEMPLATE_ID")
    },
    write: {
      enabled: status.writable,
      mode: config.writeMode,
      syncReady: Boolean(networkWriteAllowed && hasApiKey && hasTemplate && hasObject && hasOperatorGate && eventBusMode),
      mintReady: Boolean(networkWriteAllowed && hasApiKey && hasTemplate && hasOperatorGate && eventBusMode),
      operatorGateConfigured: hasOperatorGate,
      publicWrites: false,
      exposedThroughMcp: false
    },
    requirements: [
      ...mainnetRequirements,
      { name: "DUAL_API_KEY", configured: hasApiKey, scope: "server" },
      { name: "DUAL_AGENT_MANDATE_TEMPLATE_ID", configured: hasTemplate, scope: "server" },
      { name: "DUAL_AGENT_MANDATE_OBJECT_ID", configured: hasObject, scope: "server", requiredFor: "sync" },
      { name: "DEMO_OPERATOR_TOKEN", configured: hasOperatorGate, scope: "server" },
      { name: "DUAL_WRITE_MODE=event_bus", configured: eventBusMode, scope: "server" }
    ],
    detail: status.detail
  });
}
