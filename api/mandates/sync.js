import {
  dualClient,
  dualConfig,
  extractResultObject,
  normalizeMandateProperties,
  readBody,
  requireOperator,
  requireWritable,
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
    requireOperator(request);
    requireWritable();
    const body = await readBody(request);
    const properties = normalizeMandateProperties(body.properties || {});
    const metadata = semanticMetadata("mandate_snapshot_synced", properties, body.auditEvent || null);
    const payload = updatePayload(dualConfig().objectId, properties, metadata);
    const result = await (await dualClient()).eventBus.execute(payload);
    response.status(200).json({
      synced: true,
      action: "update",
      object: extractResultObject(result) || { id: dualConfig().objectId, properties },
      result
    });
  } catch (error) {
    sendError(response, error);
  }
}
