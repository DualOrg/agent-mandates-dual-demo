export const defaultOrgId = "69b935b4187e903f826bbe71";
export const templateName = "io.dual.agent_mandate.demo.v1";

export function dualConfig() {
  const mode = process.env.DUAL_PERSISTENCE_MODE || "local";
  const writeMode = process.env.DUAL_WRITE_MODE || "read_only";
  return {
    mode,
    writeMode,
    apiUrl: process.env.DUAL_API_URL || "https://api-testnet.dual.network",
    orgId: process.env.DUAL_ORG_ID || defaultOrgId,
    templateId: process.env.DUAL_AGENT_MANDATE_TEMPLATE_ID || "",
    objectId: process.env.DUAL_AGENT_MANDATE_OBJECT_ID || "",
    apiKey: process.env.DUAL_API_KEY || "",
    operatorToken: process.env.DEMO_OPERATOR_TOKEN || ""
  };
}

export function readiness() {
  const config = dualConfig();
  const missing = [];
  if (!config.apiKey) missing.push("DUAL_API_KEY");
  if (!config.templateId) missing.push("DUAL_AGENT_MANDATE_TEMPLATE_ID");
  if (!config.objectId) missing.push("DUAL_AGENT_MANDATE_OBJECT_ID");
  const readbackReady = Boolean(config.apiKey && config.objectId);
  const writable = Boolean(readbackReady && config.templateId && config.operatorToken && config.writeMode === "event_bus");
  return {
    ok: readbackReady,
    mode: config.mode,
    runtime: process.env.VERCEL ? "vercel" : "node",
    sdk: "dual-sdk",
    orgId: config.orgId,
    templateId: config.templateId || null,
    objectId: config.objectId || null,
    templateName,
    readbackReady,
    writable,
    writeMode: config.writeMode,
    operatorGateConfigured: Boolean(config.operatorToken),
    publicWrites: false,
    missing,
    detail: writable
      ? "DUAL readback and operator-gated writes are configured."
      : readbackReady
        ? "DUAL readback is configured. Operator-gated writes need event_bus mode and DEMO_OPERATOR_TOKEN."
        : "Set DUAL_API_KEY and DUAL_AGENT_MANDATE_OBJECT_ID to enable DUAL readback."
  };
}

export async function dualClient() {
  const config = dualConfig();
  if (!config.apiKey) {
    const error = new Error("DUAL_API_KEY is not configured.");
    error.status = 409;
    throw error;
  }
  try {
    const { DualClient } = await import("dual-sdk");
    return new DualClient({
      baseUrl: config.apiUrl,
      apiKey: config.apiKey,
      token: config.apiKey,
      authMode: "api_key",
      timeout: 30000
    });
  } catch {
    return directDualClient(config);
  }
}

function directDualClient(config) {
  return {
    objects: {
      get: (objectId) => dualRequest(config, "GET", `/objects/${encodeURIComponent(objectId)}`)
    },
    eventBus: {
      execute: (payload) => dualRequest(config, "POST", "/ebus/execute", payload)
    }
  };
}

async function dualRequest(config, method, path, body) {
  const response = await fetch(`${config.apiUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": config.apiKey
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `DUAL request failed with HTTP ${response.status}`);
    error.status = response.status;
    error.body = payload;
    throw error;
  }
  return payload;
}

export function requireOperator(request) {
  const config = dualConfig();
  if (!config.operatorToken) {
    const error = new Error("DEMO_OPERATOR_TOKEN is not configured for this deployment.");
    error.status = 403;
    throw error;
  }
  const headerToken = request.headers?.["x-demo-operator-token"] || request.headers?.get?.("x-demo-operator-token") || "";
  const auth = request.headers?.authorization || request.headers?.get?.("authorization") || "";
  const bearerToken = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (headerToken !== config.operatorToken && bearerToken !== config.operatorToken) {
    const error = new Error("Invalid or missing operator token.");
    error.status = 403;
    throw error;
  }
}

export function requireWritable(options = {}) {
  const requireObject = options.requireObject !== false;
  const status = readiness();
  const config = dualConfig();
  const baseWritable = Boolean(config.apiKey && config.templateId && config.operatorToken && config.writeMode === "event_bus");
  if (!baseWritable || (requireObject && !config.objectId)) {
    const error = new Error(status.detail);
    error.status = 409;
    error.readiness = status;
    throw error;
  }
}

export async function readBody(request) {
  if (request.body && typeof request.body === "object" && !request.readable) return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(raw);
}

export function mandateTemplateProperties() {
  return {
    mandate_id: "string",
    principal_wallet: "string",
    agent_wallet: "string",
    authority_scope: "string",
    jurisdiction: "string",
    status: "string",
    spend_limit_usd: "number",
    human_approval_required: "boolean",
    legal_verified: "boolean",
    policy_version: "number",
    policy_hash: "string",
    mandate_hash: "string",
    last_event_hash: "string",
    breach_count: "number",
    action_count: "number",
    last_decision_result: "string",
    last_decision_reason: "string",
    last_request_label: "string",
    last_request_amount_usd: "number",
    last_request_counterparty: "string",
    last_event_type: "string",
    last_event_status: "string",
    updated_at: "string"
  };
}

export function normalizeMandateProperties(input = {}) {
  const now = new Date().toISOString();
  return {
    mandate_id: stringValue(input.mandate_id, "mandate-agent-commerce-001"),
    principal_wallet: stringValue(input.principal_wallet),
    agent_wallet: stringValue(input.agent_wallet),
    authority_scope: stringValue(input.authority_scope, "market-data-and-paper-execution"),
    jurisdiction: stringValue(input.jurisdiction, "AU-NSW"),
    status: stringValue(input.status, "active"),
    spend_limit_usd: numberValue(input.spend_limit_usd, 250),
    human_approval_required: booleanValue(input.human_approval_required, true),
    legal_verified: booleanValue(input.legal_verified, true),
    policy_version: numberValue(input.policy_version, 1),
    policy_hash: stringValue(input.policy_hash),
    mandate_hash: stringValue(input.mandate_hash),
    last_event_hash: stringValue(input.last_event_hash),
    breach_count: numberValue(input.breach_count, 0),
    action_count: numberValue(input.action_count, 0),
    last_decision_result: stringValue(input.last_decision_result, "Ready"),
    last_decision_reason: stringValue(input.last_decision_reason, "Awaiting simulation"),
    last_request_label: stringValue(input.last_request_label, "Buy verified token"),
    last_request_amount_usd: numberValue(input.last_request_amount_usd, 175),
    last_request_counterparty: stringValue(input.last_request_counterparty, "seller.dual"),
    updated_at: stringValue(input.updated_at, now)
  };
}

export function updatePayload(objectId, properties, metadata = {}) {
  return {
    action: {
      update: {
        id: objectId,
        data: {
          custom: {
            ...properties,
            last_event_type: metadata.event_type || "",
            last_event_status: metadata.event_status || "",
            last_event_hash: metadata.event_hash || properties.last_event_hash || ""
          }
        }
      }
    },
    metadata
  };
}

export function mintPayload(templateId, properties, metadata = {}) {
  return {
    action: {
      mint: {
        template_id: templateId,
        num: 1,
        data: {
          custom: {
            ...properties,
            last_event_type: metadata.event_type || "",
            last_event_status: metadata.event_status || "",
            last_event_hash: metadata.event_hash || properties.last_event_hash || ""
          }
        }
      }
    },
    metadata
  };
}

export function semanticMetadata(eventType, properties, auditEvent = null) {
  return {
    source: "agent_mandates_dual_demo",
    event_type: eventType,
    event_status: properties.status || "active",
    event_hash: properties.last_event_hash || "",
    mandate_id: properties.mandate_id,
    audit_title: auditEvent?.title || "",
    audit_type: auditEvent?.type || "",
    generated_at: new Date().toISOString()
  };
}

export function summarizeObject(object) {
  if (!object || typeof object !== "object") return null;
  const custom = extractCustom(object);
  return {
    id: firstNonEmpty(object.id, object.object_id, object.objectId),
    templateId: firstNonEmpty(object.template_id, object.templateId, custom.template_id),
    state: firstNonEmpty(custom.status, object.state, object.status),
    integrityHash: firstNonEmpty(object.integrity_hash, object.integrityHash),
    stateHash: firstNonEmpty(object.state_hash, object.stateHash, object.next_state_hash, object.nextStateHash),
    updatedAt: firstNonEmpty(custom.updated_at, object.updated_at, object.updatedAt, object.whenModified),
    properties: custom,
    raw: object
  };
}

export function extractCustom(object) {
  return object?.custom
    || object?.data?.custom
    || object?.properties
    || object?.object?.custom
    || object?.state?.custom
    || {};
}

export function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

export function sendError(response, error) {
  response.status(error.status || error.statusCode || 500).json({
    error: {
      message: error.message || "Unknown DUAL error",
      code: error.code || error.name || "DUAL_ERROR",
      readiness: error.readiness || undefined
    }
  });
}

export async function readCurrentObject() {
  const config = dualConfig();
  if (!config.objectId) return { available: false, reason: "DUAL_AGENT_MANDATE_OBJECT_ID is not configured." };
  const client = await dualClient();
  const object = await client.objects.get(config.objectId);
  return {
    available: true,
    object: summarizeObject(object),
    properties: extractCustom(object)
  };
}

export function extractResultObject(result) {
  const candidates = [
    result?.object,
    result?.objects?.[0],
    result?.data?.object,
    result?.data?.objects?.[0],
    result?.affected_objects?.[0],
    result?.affectedObjects?.[0]
  ];
  return candidates.map(summarizeObject).find(Boolean) || null;
}

function stringValue(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") || null;
}
