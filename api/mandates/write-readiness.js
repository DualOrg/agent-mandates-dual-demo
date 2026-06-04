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
  const networkWriteAllowed = Boolean(status.network?.write_allowed);

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
      { name: "DUAL_API_KEY", configured: hasApiKey, scope: "server" },
      { name: "DUAL_AGENT_MANDATE_TEMPLATE_ID", configured: hasTemplate, scope: "server" },
      { name: "DUAL_AGENT_MANDATE_OBJECT_ID", configured: hasObject, scope: "server", requiredFor: "sync" },
      { name: "DEMO_OPERATOR_TOKEN", configured: hasOperatorGate, scope: "server" },
      { name: "DUAL_WRITE_MODE=event_bus", configured: eventBusMode, scope: "server" }
    ],
    detail: status.detail
  });
}
