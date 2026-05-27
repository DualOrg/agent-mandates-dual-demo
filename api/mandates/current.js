import { readCurrentObject, readiness, sendError } from "../_dual.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  try {
    if (!readiness().readbackReady) {
      response.status(200).json({ available: false, reason: readiness().detail, status: readiness() });
      return;
    }
    response.status(200).json(await readCurrentObject());
  } catch (error) {
    sendError(response, error);
  }
}
