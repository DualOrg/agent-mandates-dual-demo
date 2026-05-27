import {
  evaluateMandateAction,
  normalizeMandateProperties,
  readBody,
  readCurrentObject,
  readiness,
  sendError
} from "../_dual.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  try {
    const body = await readBody(request);
    const status = readiness();
    let source = "request";
    let object = null;
    let properties = normalizeMandateProperties(body.mandate || body.properties || {});

    if (status.readbackReady) {
      try {
        const current = await readCurrentObject();
        if (current.available && current.properties) {
          source = "dual_readback";
          object = current.object;
          properties = normalizeMandateProperties(current.properties);
        }
      } catch (error) {
        if (!body.mandate && !body.properties) throw error;
        source = "request_fallback";
      }
    }

    const evaluation = evaluateMandateAction(properties, body.action || body.request || body, { source, object });
    response.status(200).json({
      evaluated: true,
      writable: false,
      publicWrites: false,
      status,
      evaluation
    });
  } catch (error) {
    sendError(response, error);
  }
}
