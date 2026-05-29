import {
  dualConfig,
  mintPayload,
  normalizeMandateProperties,
  readBody,
  readiness,
  semanticMetadata,
  sendError,
  updatePayload
} from "../_dual.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  try {
    const config = dualConfig();
    const body = await readBody(request);
    const action = body.action === "mint" ? "mint" : "sync";
    const properties = normalizeMandateProperties(body.properties || {});
    const metadata = semanticMetadata(
      action === "mint" ? "mandate_object_mint_preview" : "mandate_snapshot_sync_preview",
      properties,
      body.auditEvent || null
    );
    const payload = action === "mint"
      ? mintPayload(config.templateId || "<DUAL_AGENT_MANDATE_TEMPLATE_ID>", properties, metadata)
      : updatePayload(config.objectId || "<DUAL_AGENT_MANDATE_OBJECT_ID>", properties, metadata);

    response.status(200).json({
      ok: true,
      action,
      writable: false,
      publicWrites: false,
      operatorTokenRequiredForExecution: true,
      target: {
        orgId: config.orgId,
        templateId: config.templateId || null,
        objectId: config.objectId || null
      },
      readiness: readiness(),
      payloadPreview: payload
    });
  } catch (error) {
    sendError(response, error);
  }
}
