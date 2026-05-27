const initialState = {
  version: 1,
  nonce: 1,
  lifecycleIndex: 1,
  selectedMode: "quote",
  selectedTab: "immutable",
  lastDecision: {
    result: "Ready",
    reason: "Awaiting simulation",
    tone: "ready"
  },
  mandate: {
    id: "mandate-agent-commerce-001",
    principalWallet: "69b92d49d5a95a6018672003",
    agentWallet: "agent-mandates-demo-agent-wallet-001",
    authorityScope: "buyer-agent-commerce",
    jurisdiction: "AU-NSW",
    limitUsd: 250,
    humanApproval: true,
    legalVerified: true,
    state: "active",
    policyVersion: 1,
    policyHash: "",
    mandateHash: "",
    lastEventHash: ""
  },
  request: {
    label: "Buy verified token",
    amount: 175,
    counterparty: "seller.dual"
  },
  audit: [
    {
      type: "ok",
      title: "Mandate minted",
      detail: "Principal signed delegation. Legal verification attached.",
      at: "09:14:12"
    },
    {
      type: "ok",
      title: "Agent activated",
      detail: "Scope limited to buyer-agent commerce.",
      at: "09:18:03"
    },
    {
      type: "warn",
      title: "Governance rule registered",
      detail: "Human approval required above USD 250.",
      at: "09:21:44"
    }
  ],
  dual: {
    status: null,
    current: null,
    message: "Public simulation is local. DUAL writes require an operator token.",
    tone: "local",
    lastSyncAt: null
  },
  gate: {
    result: "Not checked",
    reason: "No external action evaluated",
    source: "idle",
    decisionHash: "",
    objectId: "",
    tone: "local"
  }
};

const lifecycle = [
  ["Created", "Template and principal binding"],
  ["Active", "Agent can act within mandate"],
  ["Executing", "Transaction policy in flight"],
  ["Modified", "Governance terms updated"],
  ["Suspended", "Authority paused"],
  ["Decommissioned", "Mandate revoked and locked"]
];

let state = loadState();

const $ = (id) => document.getElementById(id);

function loadState() {
  const stored = localStorage.getItem("dual-agent-mandates-state");
  if (!stored) return structuredClone(initialState);
  try {
    const parsed = JSON.parse(stored);
    return {
      ...structuredClone(initialState),
      ...parsed,
      mandate: { ...structuredClone(initialState.mandate), ...(parsed.mandate || {}) },
      request: { ...structuredClone(initialState.request), ...(parsed.request || {}) },
      lastDecision: { ...structuredClone(initialState.lastDecision), ...(parsed.lastDecision || {}) },
      dual: { ...structuredClone(initialState.dual), ...(parsed.dual || {}) },
      gate: { ...structuredClone(initialState.gate), ...(parsed.gate || {}) },
      audit: Array.isArray(parsed.audit) ? parsed.audit : structuredClone(initialState.audit)
    };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  const safeState = structuredClone(state);
  safeState.dual.message = initialState.dual.message;
  localStorage.setItem("dual-agent-mandates-state", JSON.stringify(safeState));
}

function shortHash(value) {
  if (!value) return "pending";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

async function digest(input) {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function refreshHashes() {
  const policyPayload = JSON.stringify({
    scope: state.mandate.authorityScope,
    limitUsd: state.mandate.limitUsd,
    jurisdiction: state.mandate.jurisdiction,
    humanApproval: state.mandate.humanApproval,
    policyVersion: state.mandate.policyVersion
  });
  const mandatePayload = JSON.stringify({
    id: state.mandate.id,
    principalWallet: state.mandate.principalWallet,
    agentWallet: state.mandate.agentWallet,
    state: state.mandate.state,
    version: state.version,
    nonce: state.nonce
  });
  const lastEvent = JSON.stringify(state.audit[0] || {});
  state.mandate.policyHash = await digest(policyPayload);
  state.mandate.mandateHash = await digest(mandatePayload);
  state.mandate.lastEventHash = await digest(lastEvent);
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function nowStamp() {
  return new Date().toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function addAudit(type, title, detail) {
  state.audit.unshift({ type, title, detail, at: nowStamp() });
  state.audit = state.audit.slice(0, 20);
  state.nonce += 1;
}

function currentToken() {
  return {
    immutable: {
      mandate_id: state.mandate.id,
      principal_wallet: state.mandate.principalWallet,
      agent_wallet: state.mandate.agentWallet,
      created_under: "DUAL Agent Mandate",
      authority_model: "principal_bound_delegation",
      dual_object_id: state.dual.current?.id || null
    },
    mutable: {
      state: state.mandate.state,
      authority_scope: state.mandate.authorityScope,
      max_transaction_usd: Number(state.mandate.limitUsd),
      human_approval_required: state.mandate.humanApproval,
      active_jurisdiction: state.mandate.jurisdiction,
      policy_version: state.mandate.policyVersion,
      nonce: state.nonce
    },
    compliance: {
      legal_verified: state.mandate.legalVerified,
      revocation_available: true,
      breach_count: state.audit.filter((item) => item.type === "block").length,
      latest_policy_hash: shortHash(state.mandate.policyHash),
      latest_event_hash: shortHash(state.mandate.lastEventHash),
      dual_sync: state.dual.lastSyncAt ? "operator_synced" : "local_only"
    }
  };
}

function mandateSnapshot() {
  return {
    mandate_id: state.mandate.id,
    principal_wallet: state.mandate.principalWallet,
    agent_wallet: state.mandate.agentWallet,
    authority_scope: state.mandate.authorityScope,
    jurisdiction: state.mandate.jurisdiction,
    status: state.mandate.state,
    spend_limit_usd: Number(state.mandate.limitUsd),
    human_approval_required: state.mandate.humanApproval,
    legal_verified: state.mandate.legalVerified,
    policy_version: Number(state.mandate.policyVersion),
    policy_hash: state.mandate.policyHash,
    mandate_hash: state.mandate.mandateHash,
    last_event_hash: state.mandate.lastEventHash,
    breach_count: state.audit.filter((item) => item.type === "block").length,
    action_count: state.audit.length,
    last_decision_result: state.lastDecision.result,
    last_decision_reason: state.lastDecision.reason,
    last_request_label: state.request.label,
    last_request_amount_usd: Number(state.request.amount),
    last_request_counterparty: state.request.counterparty,
    updated_at: new Date().toISOString()
  };
}

function bindInputs() {
  $("principalWallet").value = state.mandate.principalWallet;
  $("agentWallet").value = state.mandate.agentWallet;
  $("limitUsd").value = state.mandate.limitUsd;
  $("jurisdiction").value = state.mandate.jurisdiction;
  $("authorityScope").value = state.mandate.authorityScope;
  $("humanApproval").checked = state.mandate.humanApproval;
  $("requestLabel").value = state.request.label;
  $("requestAmount").value = state.request.amount;
  $("counterparty").value = state.request.counterparty;
}

function syncFromInputs() {
  state.mandate.principalWallet = $("principalWallet").value.trim();
  state.mandate.agentWallet = $("agentWallet").value.trim();
  state.mandate.limitUsd = Number($("limitUsd").value || 0);
  state.mandate.jurisdiction = $("jurisdiction").value;
  state.mandate.authorityScope = $("authorityScope").value;
  state.mandate.humanApproval = $("humanApproval").checked;
  state.request.label = $("requestLabel").value.trim();
  state.request.amount = Number($("requestAmount").value || 0);
  state.request.counterparty = $("counterparty").value.trim();
}

async function render() {
  await refreshHashes();
  saveState();

  $("versionLabel").textContent = `v${state.version}`;
  $("tokenVersion").textContent = `nonce ${state.nonce}`;
  $("mandateId").textContent = "agm-001";
  $("metricLimit").textContent = formatUsd(state.mandate.limitUsd);
  $("metricActions").textContent = String(state.audit.length);
  $("metricBreaches").textContent = String(state.audit.filter((item) => item.type === "block").length);
  $("proofScore").textContent = String(Math.max(72, 100 - state.audit.filter((item) => item.type === "block").length * 9));
  $("stateChip").textContent = state.mandate.state.toUpperCase();
  $("lifecycleStatus").textContent = state.mandate.state;
  $("lifecycleStatus").className = `status-dot ${state.mandate.state === "active" ? "active" : state.mandate.state === "revoked" ? "revoked" : ""}`;
  $("legalStatus").textContent = state.mandate.legalVerified ? "Verified" : "Review";
  $("legalStatus").className = `status-dot ${state.mandate.legalVerified ? "verified" : ""}`;
  $("jurisdictionText").textContent = `${state.mandate.jurisdiction} rules matched`;
  $("mandateHash").textContent = shortHash(state.mandate.mandateHash);
  $("policyHash").textContent = shortHash(state.mandate.policyHash);
  $("lastEventHash").textContent = shortHash(state.mandate.lastEventHash);
  $("auditCount").textContent = `${state.audit.length} events`;

  const lifecycleHtml = lifecycle.map(([name, desc], index) => {
    const className = index < state.lifecycleIndex ? "complete-step" : index === state.lifecycleIndex ? "active-step" : "";
    return `<li class="${className}"><div class="lifecycle-index">${index + 1}</div><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(desc)}</span></div></li>`;
  }).join("");
  $("lifecycleList").innerHTML = lifecycleHtml;

  const token = currentToken();
  $("schemaPanel").textContent = JSON.stringify(token[state.selectedTab], null, 2);

  $("decisionStrip").className = `decision-strip ${state.lastDecision.tone === "block" ? "blocked" : state.lastDecision.tone === "review" ? "review" : ""}`;
  $("policyResult").textContent = state.lastDecision.result;
  $("policyReason").textContent = state.lastDecision.reason;

  $("auditLog").innerHTML = state.audit.map((item) => (
    `<article class="audit-item ${item.type === "warn" ? "warn" : item.type === "block" ? "block" : ""}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.detail)}</span>
      <span>${escapeHtml(item.at)}</span>
    </article>`
  )).join("");

  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.selectedMode);
  });
  document.querySelectorAll(".schema-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.selectedTab);
  });

  renderDualStatus();
  renderGateStatus();
}

function renderDualStatus() {
  const status = state.dual.status || {};
  const current = state.dual.current || {};
  const readReady = Boolean(status.readbackReady || current.id);
  const writeReady = Boolean(status.writable);
  const tone = state.dual.tone || (writeReady ? "active" : readReady ? "review" : "local");

  $("dualStatusChip").textContent = writeReady ? "DUAL writable" : readReady ? "DUAL readback" : "DUAL local";
  $("dualStatusChip").className = `status-dot ${writeReady ? "active" : readReady ? "verified" : ""}`;
  $("dualMode").textContent = status.mode || "local";
  $("dualReadiness").textContent = readReady ? "Ready" : "Not linked";
  $("dualWriteReadiness").textContent = writeReady ? "Ready" : "Operator gated";
  $("dualObjectId").textContent = current.id || status.objectId || "not linked";
  $("dualMessage").textContent = state.dual.message || initialState.dual.message;
  $("dualMessage").className = `dual-message ${tone}`;
}

function renderGateStatus() {
  const tone = state.gate.tone || "local";
  $("gateSource").textContent = state.gate.source || "idle";
  $("gateDecision").textContent = state.gate.result || "Not checked";
  $("gateReason").textContent = state.gate.reason || "No external action evaluated";
  $("gateDecisionHash").textContent = shortHash(state.gate.decisionHash);
  $("gateObjectId").textContent = state.gate.objectId || "not linked";
  $("gateStrip").className = `decision-strip gate-strip ${tone === "block" ? "blocked" : tone === "review" ? "review" : ""}`;
}

async function saveMandate() {
  syncFromInputs();
  state.version += 1;
  state.mandate.policyVersion += 1;
  state.mandate.state = "active";
  state.lifecycleIndex = 3;
  state.lastDecision = {
    result: "Mandate saved",
    reason: "Policy hash refreshed and mutable token fields updated",
    tone: "ready"
  };
  addAudit("ok", "Mandate policy updated", `${state.mandate.authorityScope} in ${state.mandate.jurisdiction}; limit ${formatUsd(state.mandate.limitUsd)}.`);
  await render();
}

async function simulateTransaction(forceBreach = false) {
  syncFromInputs();
  const amount = Number(state.request.amount);
  const overLimit = amount > Number(state.mandate.limitUsd);
  const unsupportedLive = state.selectedMode === "purchase" && state.mandate.authorityScope === "market-data-and-paper-execution";
  const blocked = forceBreach || state.mandate.state !== "active" || overLimit || unsupportedLive;
  state.lifecycleIndex = blocked ? 4 : 2;

  if (blocked) {
    const reason = forceBreach
      ? "Manual red-team breach injected"
      : state.mandate.state !== "active"
        ? "Mandate is not active"
        : overLimit
          ? `${formatUsd(amount)} exceeds ${formatUsd(state.mandate.limitUsd)} limit`
          : "Purchase is outside paper-execution scope";
    state.lastDecision = { result: "Blocked", reason, tone: "block" };
    addAudit("block", "Transaction blocked", `${state.request.label}: ${reason}.`);
  } else if (state.mandate.humanApproval && amount > Number(state.mandate.limitUsd) * 0.7) {
    state.lastDecision = { result: "Needs approval", reason: "Near-threshold action requires human review", tone: "review" };
    addAudit("warn", "Human approval requested", `${state.request.label} for ${formatUsd(amount)} routed to principal.`);
  } else {
    state.lastDecision = { result: "Approved", reason: "Scope, jurisdiction, signature, and limit checks passed", tone: "ready" };
    addAudit("ok", "Transaction approved", `${state.selectedMode} request for ${formatUsd(amount)} with ${state.request.counterparty}.`);
  }
  await render();
}

async function evaluateExternalGate() {
  syncFromInputs();
  try {
    const result = await apiJson("/api/mandates/evaluate", {
      method: "POST",
      body: {
        action: {
          action_type: state.selectedMode,
          label: state.request.label,
          amount_usd: Number(state.request.amount),
          counterparty: state.request.counterparty,
          agent_wallet: state.mandate.agentWallet,
          jurisdiction: state.mandate.jurisdiction
        },
        mandate: mandateSnapshot()
      }
    });
    const evaluation = result.evaluation || {};
    const tone = evaluation.result === "Blocked" ? "block" : evaluation.result === "Requires approval" ? "review" : "ready";
    state.gate = {
      result: evaluation.result || "Evaluated",
      reason: evaluation.reason || "Mandate gate returned a decision.",
      source: evaluation.source || "request",
      decisionHash: evaluation.proof?.decision_hash || "",
      objectId: evaluation.proof?.object_id || "",
      tone
    };
    state.lastDecision = {
      result: state.gate.result,
      reason: state.gate.reason,
      tone
    };
  } catch (error) {
    state.gate = {
      ...state.gate,
      result: "Gate error",
      reason: error.message,
      tone: "block"
    };
  }
  await render();
}

async function suspendMandate() {
  syncFromInputs();
  state.mandate.state = "suspended";
  state.lifecycleIndex = 4;
  state.lastDecision = { result: "Suspended", reason: "Agent authority paused by principal", tone: "review" };
  addAudit("warn", "Mandate suspended", "Delegated authority paused. Readback remains available.");
  await render();
}

async function revokeMandate() {
  syncFromInputs();
  state.mandate.state = "revoked";
  state.lifecycleIndex = 5;
  state.lastDecision = { result: "Revoked", reason: "Mandate locked and decommissioned", tone: "block" };
  addAudit("block", "Mandate revoked", "Principal revocation executed. Agent can no longer transact.");
  await render();
}

async function loadDualStatus() {
  try {
    const status = await apiJson("/api/dual/status");
    state.dual.status = status;
    state.dual.message = status.detail || (status.readbackReady ? "DUAL readback is configured." : "DUAL is not configured for this deployment yet.");
    state.dual.tone = status.writable ? "active" : status.readbackReady ? "review" : "local";
  } catch (error) {
    state.dual.message = `DUAL status unavailable: ${error.message}`;
    state.dual.tone = "block";
  }
  await render();
}

async function loadCurrentMandate({ applyToLocal = false } = {}) {
  try {
    const current = await apiJson("/api/mandates/current");
    state.dual.current = current.object || current;
    state.dual.message = current.available ? "DUAL mandate readback loaded." : current.reason || "No DUAL mandate object is linked.";
    state.dual.tone = current.available ? "review" : "local";
    if (applyToLocal && current.properties) applyMandateProperties(current.properties);
  } catch (error) {
    state.dual.message = `DUAL readback failed: ${error.message}`;
    state.dual.tone = "block";
  }
  await render();
}

async function syncMandateToDual() {
  syncFromInputs();
  await refreshHashes();
  const operatorToken = $("operatorToken").value.trim();
  if (!operatorToken) {
    state.dual.message = "Enter the operator token before syncing to DUAL.";
    state.dual.tone = "block";
    await render();
    return;
  }

  try {
    const result = await apiJson("/api/mandates/sync", {
      method: "POST",
      operatorToken,
      body: {
        properties: mandateSnapshot(),
        auditEvent: state.audit[0] || null
      }
    });
    state.dual.lastSyncAt = new Date().toISOString();
    state.dual.current = result.object || state.dual.current;
    state.dual.message = result.synced ? "Mandate snapshot synced to DUAL." : "DUAL sync completed.";
    state.dual.tone = "active";
    addAudit("ok", "DUAL sync completed", result.object?.id ? `Object ${result.object.id} updated.` : "Operator-gated DUAL write accepted.");
    await loadCurrentMandate();
  } catch (error) {
    state.dual.message = `DUAL sync failed: ${error.message}`;
    state.dual.tone = "block";
    await render();
  }
}

async function apiJson(path, options = {}) {
  const headers = { accept: "application/json" };
  if (options.body) headers["content-type"] = "application/json";
  if (options.operatorToken) headers["x-demo-operator-token"] = options.operatorToken;
  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
  }
  return payload;
}

function applyMandateProperties(properties) {
  state.mandate.principalWallet = stringValue(properties.principal_wallet, state.mandate.principalWallet);
  state.mandate.agentWallet = stringValue(properties.agent_wallet, state.mandate.agentWallet);
  state.mandate.authorityScope = stringValue(properties.authority_scope, state.mandate.authorityScope);
  state.mandate.jurisdiction = stringValue(properties.jurisdiction, state.mandate.jurisdiction);
  state.mandate.state = stringValue(properties.status, state.mandate.state);
  state.mandate.limitUsd = Number(properties.spend_limit_usd || state.mandate.limitUsd);
  state.mandate.humanApproval = Boolean(properties.human_approval_required ?? state.mandate.humanApproval);
  state.mandate.legalVerified = Boolean(properties.legal_verified ?? state.mandate.legalVerified);
  state.mandate.policyVersion = Number(properties.policy_version || state.mandate.policyVersion);
  state.request.label = stringValue(properties.last_request_label, state.request.label);
  state.request.amount = Number(properties.last_request_amount_usd || state.request.amount);
  state.request.counterparty = stringValue(properties.last_request_counterparty, state.request.counterparty);
  state.lastDecision.result = stringValue(properties.last_decision_result, state.lastDecision.result);
  state.lastDecision.reason = stringValue(properties.last_decision_reason, state.lastDecision.reason);
  bindInputs();
}

function stringValue(value, fallback) {
  return typeof value === "string" && value ? value : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wireEvents() {
  $("saveMandateBtn").addEventListener("click", saveMandate);
  $("simulateBtn").addEventListener("click", () => simulateTransaction(false));
  $("forceBreachBtn").addEventListener("click", () => simulateTransaction(true));
  $("evaluateGateBtn").addEventListener("click", evaluateExternalGate);
  $("suspendBtn").addEventListener("click", suspendMandate);
  $("revokeBtn").addEventListener("click", revokeMandate);
  $("loadDualBtn").addEventListener("click", () => loadCurrentMandate({ applyToLocal: true }));
  $("syncDualBtn").addEventListener("click", syncMandateToDual);
  $("resetBtn").addEventListener("click", async () => {
    state = structuredClone(initialState);
    bindInputs();
    await loadDualStatus();
    await render();
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedMode = button.dataset.mode;
      await render();
    });
  });

  document.querySelectorAll(".schema-tab").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedTab = button.dataset.tab;
      await render();
    });
  });
}

bindInputs();
wireEvents();
render();
loadDualStatus().then(() => loadCurrentMandate()).catch(() => {});
