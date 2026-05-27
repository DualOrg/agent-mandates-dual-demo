import {
  dualClient,
  dualConfig,
  extractResultObject,
  mintPayload,
  normalizeMandateProperties,
  readBody,
  requireOperator,
  requireWritable,
  semanticMetadata,
  sendError
} from "../_dual.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  try {
    requireOperator(request);
    requireWritable({ requireObject: false });
    const config = dualConfig();
    const body = await readBody(request);
    const properties = normalizeMandateProperties(body.properties || {});
    const metadata = semanticMetadata("mandate_object_minted", properties, body.auditEvent || null);
    const result = await (await dualClient()).eventBus.execute(mintPayload(config.templateId, properties, metadata));
    response.status(200).json({
      synced: true,
      action: "mint",
      object: extractResultObject(result),
      result
    });
  } catch (error) {
    sendError(response, error);
  }
}
