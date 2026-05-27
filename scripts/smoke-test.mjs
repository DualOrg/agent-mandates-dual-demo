const baseUrl = process.env.DEMO_BASE_URL || "http://127.0.0.1:4173";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.operatorToken ? { "x-demo-operator-token": options.operatorToken } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

const home = await fetch(baseUrl);
assert(home.ok, "home page loads");
assert((await home.text()).includes("DUAL Agent Mandates"), "home page includes cockpit title");

const status = await request("/api/dual/status");
assert(status.response.ok, "status endpoint returns 200");
assert(status.body.publicWrites === false, "status endpoint reports no public writes");
assert(!("apiKey" in status.body), "status endpoint does not expose API key");
assert(status.body.orgId === "69b935b4187e903f826bbe71", "status endpoint defaults to IanTest org");

const current = await request("/api/mandates/current");
assert(current.response.ok, "current mandate endpoint degrades safely");
assert(typeof current.body.available === "boolean", "current mandate endpoint reports availability");

const rejectedSync = await request("/api/mandates/sync", {
  method: "POST",
  operatorToken: "wrong",
  body: {
    properties: {
      mandate_id: "mandate-agent-commerce-001",
      status: "active"
    }
  }
});
assert(rejectedSync.response.status === 403, "sync endpoint rejects missing or wrong operator token");

console.log("smoke test passed");
