const initialState = {
  version: 1,
  nonce: 1,
  lifecycleIndex: 1,
  selectedMode: "quote",
  selectedTab: "immutable",
  selectedPathView: "policy",
  proofBundle: {
    generated: false,
    hash: "",
    at: ""
  },
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

const pathViews = {
  policy: [
    ["01", "Mandate issued", "Principal binds wallet, scope, and ceiling", "verified"],
    ["02", "Request normalized", "Agent action becomes a typed proposal", "verified"],
    ["03", "Policy checked", "Scope, status, jurisdiction, and limit evaluated", "active"],
    ["04", "Decision logged", "Decision hash is returned for audit", "verified"]
  ],
  evidence: [
    ["01", "Signature", "Principal delegation is attached", "verified"],
    ["02", "Policy hash", "Mutable terms produce a stable hash", "verified"],
    ["03", "DUAL readback", "Object and template prove canonical state", "active"],
    ["04", "Explorer links", "Reviewer can open public anchors", "verified"]
  ],
  agent: [
    ["01", "MCP client", "Agent calls read-only evaluator", "verified"],
    ["02", "Authority gate", "Evaluator allows, blocks, or asks a human", "active"],
    ["03", "No write power", "Public MCP exposes no sync or mint tool", "verified"],
    ["04", "Audit handoff", "Object id and decision hash go into agent logs", "verified"]
  ]
};

let reviewerMode = false;
let reviewerStepIndex = 0;

let state = loadState();

const $ = (id) => document.getElementById(id);

const reviewerSteps = [
  {
    targetId: "mandatePanel",
    title: "Mandate state",
    body: "Start with the live authority object: one principal, one delegated buyer agent, an active state, and a bounded spend ceiling.",
    facts: () => [
      ["Mandate", "agm-001"],
      ["Status", state.mandate.state],
      ["Limit", formatUsd(state.mandate.limitUsd)],
      ["Jurisdiction", state.mandate.jurisdiction]
    ]
  },
  {
    targetId: "authorityPanel",
    title: "Authority boundary",
    body: "The useful claim is not that the agent is trusted. It is that the principal has set explicit, readable constraints before execution.",
    facts: () => [
      ["Principal", shortValue(state.mandate.principalWallet)],
      ["Agent", shortValue(state.mandate.agentWallet)],
      ["Scope", state.mandate.authorityScope],
      ["Human gate", state.mandate.humanApproval ? "enabled" : "off"]
    ]
  },
  {
    targetId: "simulatorPanel",
    title: "Agent action",
    body: "The agent proposes a concrete action. Local simulation shows the operator what will pass, require approval, or block.",
    facts: () => [
      ["Request", state.request.label],
      ["Amount", formatUsd(state.request.amount)],
      ["Counterparty", state.request.counterparty],
      ["Result", state.lastDecision.result]
    ]
  },
  {
    targetId: "verifierPanel",
    title: "Read-only verifier",
    body: "Agents can call the public evaluator and receive a decision hash without receiving any operator write token.",
    facts: () => [
      ["Decision", state.gate.result],
      ["Source", state.gate.source],
      ["Decision hash", shortHash(state.gate.decisionHash)],
      ["Public writes", "false"]
    ]
  },
  {
    targetId: "proofRailPanel",
    title: "DUAL proof rail",
    body: "The proof rail exposes object, template, state hash, integrity hash, and explorer links so a reviewer can verify the backing record.",
    facts: () => [
      ["Object", shortValue(proofObjectId())],
      ["Template", shortValue(proofTemplateId())],
      ["Source", proofSourceLabel()],
      ["Bundle", shortHash(state.proofBundle.hash)]
    ]
  },
  {
    targetId: "dualReadinessPanel",
    title: "Write boundary",
    body: "Readback is public. State-changing DUAL sync is operator-gated. Page load and public MCP calls do not write.",
    facts: () => [
      ["Runtime", `${state.dual.status?.runtime || "browser"} / ${state.dual.status?.mode || "local"}`],
      ["Readback", state.dual.status?.readbackReady ? "configured" : "pending"],
      ["Writable", state.dual.status?.writable ? "event-bus gated" : "disabled"],
      ["Public writes", String(Boolean(state.dual.status?.publicWrites))]
    ]
  }
];

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
      proofBundle: { ...structuredClone(initialState.proofBundle), ...(parsed.proofBundle || {}) },
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

function shortValue(value, head = 10, tail = 6) {
  if (!value) return "pending";
  const text = String(value);
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
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
  $("lifecycleStatus").className = `status-chip ${state.mandate.state === "active" ? "active" : state.mandate.state === "revoked" ? "revoked" : "review"}`;
  $("legalStatus").textContent = state.mandate.legalVerified ? "Verified" : "Review";
  $("legalStatus").className = `status-chip ${state.mandate.legalVerified ? "verified" : "review"}`;
  $("jurisdictionText").textContent = `${state.mandate.jurisdiction} rules matched`;
  $("mandateHash").textContent = shortHash(state.mandate.mandateHash);
  $("policyHash").textContent = shortHash(state.mandate.policyHash);
  $("lastEventHash").textContent = shortHash(state.mandate.lastEventHash);
  $("auditCount").textContent = `${state.audit.length} events`;
  $("headerScope").textContent = state.mandate.authorityScope;
  $("headerObjectId").textContent = shortValue(proofObjectId());
  $("headerPublicWrites").textContent = String(Boolean(state.dual.status?.publicWrites));
  $("principalShort").textContent = shortValue(state.mandate.principalWallet);
  $("agentShort").textContent = shortValue(state.mandate.agentWallet);
  $("policyLimit").textContent = formatUsd(state.mandate.limitUsd);
  $("policyJurisdiction").textContent = state.mandate.jurisdiction;
  $("blockedCount").textContent = String(state.audit.filter((item) => item.type === "block").length);
  $("remainingAllowance").textContent = formatUsd(Math.max(0, Number(state.mandate.limitUsd || 0) - Number(state.request.amount || 0)));
  $("stateMachine").textContent = state.mandate.state === "revoked"
    ? "Created -> Active -> Revoked -> Agent blocked"
    : state.mandate.state === "suspended"
      ? "Created -> Active -> Suspended -> Human review"
      : "Created -> Active -> Evaluated -> Synced or blocked";
  $("exportStatus").textContent = state.proofBundle.generated ? `${shortHash(state.proofBundle.hash)} at ${state.proofBundle.at}` : "Not generated";

  const lifecycleHtml = lifecycle.map(([name, desc], index) => {
    const className = index < state.lifecycleIndex ? "complete-step" : index === state.lifecycleIndex ? "active-step" : "";
    return `<li class="${className}"><div class="lifecycle-index">${index + 1}</div><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(desc)}</span></div></li>`;
  }).join("");
  $("lifecycleList").innerHTML = lifecycleHtml;

  renderPathMap();

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
  renderProofRail();
  renderReviewerGuide();
}

function renderPathMap() {
  const nodes = pathViews[state.selectedPathView] || pathViews.policy;
  $("pathMap").innerHTML = nodes.map(([step, title, detail, tone]) => (
    `<article class="path-node ${escapeHtml(tone)}">
      <span>${escapeHtml(step)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>`
  )).join("");
  document.querySelectorAll("[data-path-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.pathView === state.selectedPathView);
  });
}

function renderDualStatus() {
  const status = state.dual.status || {};
  const current = state.dual.current || {};
  const readReady = Boolean(status.readbackReady || current.id);
  const writeReady = Boolean(status.writable);
  const tone = state.dual.tone || (writeReady ? "active" : readReady ? "review" : "local");

  $("dualModeChip").textContent = writeReady ? "Operator gated" : readReady ? "Read linked" : "Local";
  $("dualModeChip").className = `status-chip ${writeReady ? "active" : readReady ? "verified" : "review"}`;
  $("dualRuntime").textContent = `${status.runtime || "browser"} / ${status.mode || "local"}`;
  $("dualOrg").textContent = shortValue(status.orgId || "pending", 12, 6);
  $("dualReadiness").textContent = readReady ? "configured" : "not linked";
  $("dualWriteReadiness").textContent = writeReady ? "event-bus gated" : "disabled";
  $("dualMessage").textContent = state.dual.message || initialState.dual.message;
  $("dualMessage").className = `readiness-note ${tone}`;
}

function renderGateStatus() {
  const tone = state.gate.tone || "local";
  $("gateSource").textContent = state.gate.source || "idle";
  $("gateSource").className = `status-chip ${tone === "block" ? "blocked" : tone === "review" ? "review" : tone === "ready" ? "verified" : "review"}`;
  $("gateDecision").textContent = state.gate.result || "Not checked";
  $("gateReason").textContent = state.gate.reason || "No external action evaluated";
  $("gateDecisionHash").textContent = shortHash(state.gate.decisionHash);
  $("gateObjectId").textContent = state.gate.objectId || "not linked";
}

function proofObjectId() {
  return state.dual.current?.id || state.dual.status?.objectId || state.gate.objectId || "";
}

function proofTemplateId() {
  return state.dual.current?.templateId || state.dual.status?.templateId || "";
}

function proofSourceLabel() {
  if (state.dual.current?.id) return "dual_readback";
  if (state.dual.status?.readbackReady) return "configured";
  return "local_preview";
}

function currentRawObject() {
  return state.dual.current?.raw || state.dual.current || {};
}

function explorerBase() {
  return (state.dual.status?.l3ExplorerBaseUrl || "https://explorer-testnet.dual.network").replace(/\/+$/, "");
}

function l2ExplorerBase() {
  return (state.dual.status?.l2ExplorerBaseUrl || "https://explorer-test-v2.dual.network").replace(/\/+$/, "");
}

function proofLinks() {
  const raw = currentRawObject();
  const objectId = proofObjectId();
  const templateId = proofTemplateId();
  const stateHash = raw.stateHash || raw.state_hash || state.dual.current?.stateHash || "";
  const integrityHash = raw.integrityHash || raw.integrity_hash || state.dual.current?.integrityHash || "";
  const bundleHash = state.proofBundle.hash || "";
  const links = [];
  if (objectId) {
    links.push({
      id: "dual-object",
      label: "DUAL object block explorer",
      value: objectId,
      detail: "Object state",
      href: `${explorerBase()}/objects/${encodeURIComponent(objectId)}`
    });
  }
  if (templateId) {
    links.push({
      id: "dual-template",
      label: "DUAL template block explorer",
      value: templateId,
      detail: "Template schema",
      href: `${explorerBase()}/templates/${encodeURIComponent(templateId)}`
    });
  }
  if (stateHash) {
    links.push({
      id: "state-hash",
      label: "State hash proof",
      value: stateHash,
      detail: "Object state hash",
      href: `${l2ExplorerBase()}/search?q=${encodeURIComponent(stateHash)}`
    });
  }
  if (integrityHash) {
    links.push({
      id: "integrity-hash",
      label: "Integrity hash proof",
      value: integrityHash,
      detail: "Object integrity hash",
      href: `${l2ExplorerBase()}/search?q=${encodeURIComponent(integrityHash)}`
    });
  }
  if (bundleHash) {
    links.push({
      id: "proof-bundle",
      label: "Proof bundle hash",
      value: bundleHash,
      detail: "Locally re-derived reviewer bundle",
      href: `${l2ExplorerBase()}/search?q=${encodeURIComponent(bundleHash)}`
    });
  }
  return links;
}

function renderProofRail() {
  const raw = currentRawObject();
  const stateHash = raw.stateHash || raw.state_hash || state.dual.current?.stateHash || "";
  const integrityHash = raw.integrityHash || raw.integrity_hash || state.dual.current?.integrityHash || "";
  const readReady = Boolean(proofObjectId());
  const writable = Boolean(state.dual.status?.writable);

  $("proofModeChip").textContent = writable ? "Operator gated" : readReady ? "Read-only" : "Local";
  $("proofModeChip").className = `status-chip ${writable ? "active" : readReady ? "verified" : "review"}`;
  $("proofObjectId").textContent = shortValue(proofObjectId());
  $("proofTemplateId").textContent = shortValue(proofTemplateId());
  $("proofSource").textContent = proofSourceLabel();
  $("stateHash").textContent = shortHash(stateHash);
  $("integrityHash").textContent = shortHash(integrityHash);
  $("bundleHash").textContent = state.proofBundle.generated ? shortHash(state.proofBundle.hash) : "not generated";
  $("proofVerificationLevel").textContent = readReady ? "dual_readback_rederived" : "local_preview";
  renderProofLinks(proofLinks());
  renderPrimaryProofActions(proofLinks());
}

function renderProofLinks(links = []) {
  if (!links.length) {
    $("proofLinks").innerHTML = `<div class="proof-link-empty">DUAL block explorer links appear after readback.</div>`;
    return;
  }
  $("proofLinks").innerHTML = links.slice(0, 6).map((link) => `
    <a class="proof-link" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(link.label)}</span>
      <strong>${escapeHtml(shortHash(link.value))}</strong>
      <small>${escapeHtml(link.detail)}</small>
    </a>
  `).join("");
}

function renderPrimaryProofActions(links = []) {
  const objectLink = links.find((link) => link.id === "dual-object");
  const templateLink = links.find((link) => link.id === "dual-template");
  setProofAction("proofObjectAction", objectLink, "Open Object Proof");
  setProofAction("proofTemplateAction", templateLink, "Open Template Proof");
}

function setProofAction(id, link, fallbackLabel) {
  const element = $(id);
  element.textContent = fallbackLabel;
  if (link?.href) {
    element.href = link.href;
    element.classList.remove("disabled");
    element.removeAttribute("aria-disabled");
  } else {
    element.removeAttribute("href");
    element.classList.add("disabled");
    element.setAttribute("aria-disabled", "true");
  }
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

async function generateProofBundle() {
  syncFromInputs();
  await refreshHashes();
  const raw = currentRawObject();
  const bundle = {
    type: "agent_mandate_reviewer_bundle",
    generated_at: new Date().toISOString(),
    mandate: mandateSnapshot(),
    gate: state.gate,
    dual: {
      object_id: proofObjectId(),
      template_id: proofTemplateId(),
      state_hash: raw.stateHash || raw.state_hash || state.dual.current?.stateHash || "",
      integrity_hash: raw.integrityHash || raw.integrity_hash || state.dual.current?.integrityHash || "",
      source: proofSourceLabel(),
      public_writes: Boolean(state.dual.status?.publicWrites)
    },
    hashes: {
      mandate_hash: state.mandate.mandateHash,
      policy_hash: state.mandate.policyHash,
      last_event_hash: state.mandate.lastEventHash,
      decision_hash: state.gate.decisionHash || ""
    },
    boundary: "Public users can read, simulate, evaluate, and verify. Live DUAL writes require the operator token."
  };
  const hash = await digest(JSON.stringify(bundle));
  state.proofBundle = {
    generated: true,
    hash,
    at: nowStamp()
  };
  addAudit("export", "Proof bundle generated", `Reviewer bundle ${shortHash(hash)} includes mandate, gate, DUAL readback, and write boundary.`);
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

function renderReviewerGuide() {
  const guide = $("reviewerGuide");
  document.querySelectorAll(".review-focus").forEach((element) => element.classList.remove("review-focus"));
  if (!reviewerMode) {
    guide.hidden = true;
    $("reviewerModeBtn").classList.remove("active");
    return;
  }

  const step = reviewerSteps[reviewerStepIndex] || reviewerSteps[0];
  const target = $(step.targetId);
  if (target) target.classList.add("review-focus");
  guide.hidden = false;
  $("reviewerModeBtn").classList.add("active");
  $("reviewerEyebrow").textContent = `Step ${reviewerStepIndex + 1} of ${reviewerSteps.length}`;
  $("reviewerTitle").textContent = step.title;
  $("reviewerBody").textContent = step.body;
  $("reviewerFacts").innerHTML = step.facts().map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "pending")}</dd>
    </div>
  `).join("");
  $("reviewerProgress").style.setProperty("--progress", `${((reviewerStepIndex + 1) / reviewerSteps.length) * 100}%`);
  $("reviewerPrevBtn").disabled = reviewerStepIndex === 0;
  $("reviewerNextBtn").textContent = reviewerStepIndex === reviewerSteps.length - 1 ? "Finish" : "Next";
}

function scrollReviewerTarget() {
  const step = reviewerSteps[reviewerStepIndex] || reviewerSteps[0];
  const target = $(step.targetId);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function toggleReviewerMode() {
  reviewerMode = !reviewerMode;
  if (reviewerMode) reviewerStepIndex = 0;
  await render();
  if (reviewerMode) scrollReviewerTarget();
}

async function advanceReviewerStep() {
  if (reviewerStepIndex >= reviewerSteps.length - 1) {
    reviewerMode = false;
    await render();
    return;
  }
  reviewerStepIndex += 1;
  await render();
  scrollReviewerTarget();
}

async function retreatReviewerStep() {
  reviewerStepIndex = Math.max(0, reviewerStepIndex - 1);
  await render();
  scrollReviewerTarget();
}

async function closeReviewerMode() {
  reviewerMode = false;
  await render();
}

function wireEvents() {
  $("saveMandateBtn").addEventListener("click", saveMandate);
  $("simulateBtn").addEventListener("click", () => simulateTransaction(false));
  $("forceBreachBtn").addEventListener("click", () => simulateTransaction(true));
  $("evaluateGateBtn").addEventListener("click", evaluateExternalGate);
  $("verifyNextBtn").addEventListener("click", evaluateExternalGate);
  $("proofBundleBtn").addEventListener("click", generateProofBundle);
  $("proofRecomputeAction").addEventListener("click", generateProofBundle);
  $("reviewerModeBtn").addEventListener("click", toggleReviewerMode);
  $("reviewerPrevBtn").addEventListener("click", retreatReviewerStep);
  $("reviewerNextBtn").addEventListener("click", advanceReviewerStep);
  $("reviewerCloseBtn").addEventListener("click", closeReviewerMode);
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

  document.querySelectorAll("[data-path-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedPathView = button.dataset.pathView;
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
