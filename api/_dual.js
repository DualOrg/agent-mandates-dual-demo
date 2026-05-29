import { createHash } from "node:crypto";

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
    operatorToken: process.env.DEMO_OPERATOR_TOKEN || "",
    consoleBaseUrl: process.env.DUAL_CONSOLE_BASE_URL || "https://console-testnet.dual.network",
    l3ExplorerBaseUrl: process.env.DUAL_L3_EXPLORER_BASE_URL || "https://explorer-testnet.dual.network",
    l2ExplorerBaseUrl: process.env.DUAL_L2_EXPLORER_BASE_URL || "https://explorer-test-v2.dual.network"
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
    consoleBaseUrl: config.consoleBaseUrl,
    l3ExplorerBaseUrl: config.l3ExplorerBaseUrl,
    l2ExplorerBaseUrl: config.l2ExplorerBaseUrl,
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

export function normalizeActionRequest(input = {}) {
  return {
    action_type: stringValue(input.action_type || input.type || input.mode, "purchase"),
    label: stringValue(input.label || input.request_label || input.name, "Agent action request"),
    amount_usd: numberValue(input.amount_usd ?? input.amount ?? input.notional_usd, 0),
    counterparty: stringValue(input.counterparty || input.to || input.vendor, ""),
    agent_wallet: stringValue(input.agent_wallet || input.agentWallet, ""),
    jurisdiction: stringValue(input.jurisdiction, ""),
    authority_scope: stringValue(input.authority_scope || input.scope, "")
  };
}

export function evaluateMandateAction(properties, action, context = {}) {
  const mandate = normalizeMandateProperties(properties);
  const request = normalizeActionRequest(action);
  const reasons = [];
  const status = mandate.status.toLowerCase();
  const actionType = request.action_type.toLowerCase().replaceAll("_", "-");
  const amount = Number(request.amount_usd || 0);
  const limit = Number(mandate.spend_limit_usd || 0);
  let code = "approved";
  let result = "Approved";
  let allowed = true;

  if (status !== "active") {
    code = "inactive_mandate";
    result = "Blocked";
    allowed = false;
    reasons.push(`Mandate status is ${mandate.status}.`);
  }
  if (request.agent_wallet && mandate.agent_wallet && request.agent_wallet !== mandate.agent_wallet) {
    code = "agent_wallet_mismatch";
    result = "Blocked";
    allowed = false;
    reasons.push("Request agent wallet does not match the mandate.");
  }
  if (request.jurisdiction && mandate.jurisdiction && request.jurisdiction !== mandate.jurisdiction) {
    code = "jurisdiction_mismatch";
    result = "Blocked";
    allowed = false;
    reasons.push(`Request jurisdiction ${request.jurisdiction} does not match ${mandate.jurisdiction}.`);
  }
  if (limit > 0 && amount > limit) {
    code = "spend_limit_exceeded";
    result = "Blocked";
    allowed = false;
    reasons.push(`Request amount ${amount} exceeds mandate limit ${limit}.`);
  }
  if (!scopeAllowsAction(mandate.authority_scope, actionType, request.label)) {
    code = "scope_mismatch";
    result = "Blocked";
    allowed = false;
    reasons.push(`${request.action_type} is outside ${mandate.authority_scope}.`);
  }
  if (!mandate.legal_verified) {
    code = "legal_review_required";
    result = "Blocked";
    allowed = false;
    reasons.push("Mandate legal verification is not active.");
  }
  if (allowed && mandate.human_approval_required && limit > 0 && amount > limit * 0.7) {
    code = "human_approval_required";
    result = "Requires approval";
    allowed = false;
    reasons.push("Near-threshold action requires human approval.");
  }
  if (!reasons.length) reasons.push("Scope, jurisdiction, status, and spend checks passed.");

  const decisionHash = hashJson({
    mandate_id: mandate.mandate_id,
    action: request,
    result,
    code,
    policy_hash: mandate.policy_hash,
    mandate_hash: mandate.mandate_hash,
    last_event_hash: mandate.last_event_hash
  });

  return {
    allowed,
    result,
    code,
    reason: reasons.join(" "),
    source: context.source || "request",
    action: request,
    mandate: {
      id: mandate.mandate_id,
      status: mandate.status,
      authority_scope: mandate.authority_scope,
      jurisdiction: mandate.jurisdiction,
      spend_limit_usd: mandate.spend_limit_usd,
      human_approval_required: mandate.human_approval_required,
      agent_wallet: mandate.agent_wallet
    },
    proof: {
      object_id: context.object?.id || null,
      template_id: context.object?.templateId || null,
      state_hash: context.object?.stateHash || null,
      integrity_hash: context.object?.integrityHash || null,
      policy_hash: mandate.policy_hash,
      mandate_hash: mandate.mandate_hash,
      last_event_hash: mandate.last_event_hash,
      decision_hash: decisionHash,
      evaluated_at: new Date().toISOString()
    }
  };
}

export function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(sortObject(value))).digest("hex");
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

function scopeAllowsAction(scope, actionType, label = "") {
  const normalizedScope = String(scope || "").toLowerCase();
  const normalizedLabel = String(label || "").toLowerCase();
  const allowedByScope = {
    "buyer-agent-commerce": ["quote", "purchase", "transfer", "commerce", "commerce-purchase", "buy"],
    "market-data-and-paper-execution": ["quote", "market-data", "paper-execution", "paper-trade", "trade-simulation"],
    "credential-verification": ["verify", "credential-verification", "credential-verify"],
    "procurement-quotes": ["quote", "procurement-quote", "rfq"]
  };
  const allowed = allowedByScope[normalizedScope] || [];
  return allowed.some((item) => actionType === item || actionType.includes(item) || normalizedLabel.includes(item));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}
