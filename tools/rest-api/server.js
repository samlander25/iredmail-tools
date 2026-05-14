const http = require("http");
const { spawn } = require("child_process");
const { URL } = require("url");

const PORT = parseInt(process.env.PORT || "8081", 10);
const CLI_PATH = process.env.IREDMAIL_CLI_PATH || "iredmail-cli";
const CLI_TIMEOUT_MS = parseInt(process.env.CLI_TIMEOUT_MS || "15000", 10);
const API_REFERENCE = [
  {
    method: "GET",
    path: "/health",
    description: "Health check and active CLI path.",
    responseExample: { status: "ok", cliPath: "iredmail-cli" }
  },
  {
    method: "GET",
    path: "/api/reference",
    description: "API endpoint reference.",
    responseExample: "<html>...</html>"
  },
  {
    method: "GET",
    path: "/api/version",
    description: "Run iredmail-cli version.",
    responseExample: []
  },
  {
    method: "GET",
    path: "/api/mailboxes",
    description: "List mailboxes.",
    query: { filter: "Optional filter string." },
    responseExample: [{ mailbox: "postmaster@example.com", quota_mb: "1024" }]
  },
  {
    method: "POST",
    path: "/api/mailboxes",
    description: "Create mailbox.",
    bodyExample: {
      email: "api-test@example.com",
      password: "StrongPass123456",
      quota: 2048,
      storagePath: "/var/vmail/vmail1"
    },
    responseExample: []
  },
  {
    method: "GET",
    path: "/api/mailboxes/:email",
    description: "Show mailbox info. Use URL-encoded email.",
    responseExample: [
      { mailbox: "postmaster@example.com", quota: "1024 MB" },
      { mailbox: "postmaster@example.com", maildir: "example.com/p/o/s/postmaster-..." }
    ]
  },
  {
    method: "PATCH",
    path: "/api/mailboxes/:email",
    description: "Update mailbox fields. At least one field is required.",
    bodyExample: { quota: 4096, password: "NewStrongPass123!", keepCopy: false },
    responseExample: []
  },
  {
    method: "DELETE",
    path: "/api/mailboxes/:email",
    description: "Delete mailbox with --force. Use URL-encoded email.",
    responseExample: []
  },
  {
    method: "POST",
    path: "/api/mailboxes/:email/aliases",
    description: "Add mailbox alias (name part only).",
    bodyExample: { alias: "abuse" },
    responseExample: []
  },
  {
    method: "DELETE",
    path: "/api/mailbox-aliases",
    description: "Delete mailbox alias email.",
    bodyExample: { aliasEmail: "abuse@example.com" },
    responseExample: []
  },
  {
    method: "GET",
    path: "/api/forwardings",
    description: "List forwardings.",
    query: { filter: "Optional filter string." },
    responseExample: [{ mailbox_email: "postmaster@example.com", destination_email: "ops@example.net", keep_copy_in_mailbox: "yes" }]
  },
  {
    method: "POST",
    path: "/api/forwardings",
    description: "Add forwarding.",
    bodyExample: { mailboxEmail: "api-test@example.com", destinationEmail: "ops@example.net" },
    responseExample: []
  },
  {
    method: "DELETE",
    path: "/api/forwardings",
    description: "Delete forwarding.",
    bodyExample: { mailboxEmail: "api-test@example.com", destinationEmail: "ops@example.net" },
    responseExample: []
  },
  {
    method: "GET",
    path: "/api/aliases",
    description: "List aliases.",
    query: { filter: "Optional filter string." },
    responseExample: [{ alias: "alias-test@example.com", forwardings: "admin@example.net" }]
  },
  {
    method: "POST",
    path: "/api/aliases",
    description: "Create alias.",
    bodyExample: { aliasEmail: "alias-test@example.com" },
    responseExample: []
  },
  {
    method: "GET",
    path: "/api/aliases/:email",
    description: "Show alias info. Use URL-encoded email.",
    responseExample: [{ alias: "alias-test@example.com", forwardings: "admin@example.net" }]
  },
  {
    method: "DELETE",
    path: "/api/aliases/:email",
    description: "Delete alias. Use URL-encoded email.",
    responseExample: []
  },
  {
    method: "POST",
    path: "/api/aliases/:email/forwardings",
    description: "Add alias forwarding. Use URL-encoded alias email in path.",
    bodyExample: { destinationEmail: "alerts@example.org" },
    responseExample: []
  },
  {
    method: "DELETE",
    path: "/api/alias-forwardings",
    description: "Delete alias forwarding.",
    bodyExample: { aliasEmail: "alias-test@example.com", destinationEmail: "alerts@example.org" },
    responseExample: []
  },
  {
    method: "POST",
    path: "/api/cli",
    description: "Generic passthrough for iredmail-cli arguments.",
    bodyExample: { args: ["mailbox", "list", "--filter", "example.com"] },
    responseExample: [{ mailbox: "postmaster@example.com", quota_mb: "1024" }]
  }
];

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function html(res, status, content) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(content)
  });
  res.end(content);
}

function methodClass(method) {
  switch (method) {
    case "GET":
      return "get";
    case "POST":
      return "post";
    case "PATCH":
      return "patch";
    case "DELETE":
      return "delete";
    default:
      return "other";
  }
}

function entryGroup(entry) {
  if (entry.path === "/health" || entry.path === "/api/reference" || entry.path === "/api/version") return "Miscellaneous";
  if (entry.path.startsWith("/api/mailboxes") || entry.path.startsWith("/api/mailbox-aliases")) return "Mailboxes";
  if (entry.path.startsWith("/api/forwardings")) return "Forwardings";
  if (entry.path.startsWith("/api/aliases") || entry.path.startsWith("/api/alias-forwardings")) return "Aliases";
  return "Advanced";
}

function buildReferenceHtml() {
  const groupOrder = ["Miscellaneous", "Mailboxes", "Forwardings", "Aliases", "Advanced"];
  const grouped = API_REFERENCE.reduce((acc, entry) => {
    const g = entryGroup(entry);
    if (!acc[g]) acc[g] = [];
    acc[g].push(entry);
    return acc;
  }, {});

  const sections = groupOrder
    .filter((group) => grouped[group] && grouped[group].length > 0)
    .map((group) => {
      const cards = grouped[group].map((entry) => {
    const queryBlock = entry.query
      ? `<div class="meta"><div class="label">Query</div><pre>${escapeHtml(JSON.stringify(entry.query, null, 2))}</pre></div>`
      : "";
    const bodyBlock = entry.bodyExample
      ? `<div class="meta"><div class="label">Body Example</div><pre>${escapeHtml(JSON.stringify(entry.bodyExample, null, 2))}</pre></div>`
      : "";
    const responseBlock = entry.responseExample !== undefined
      ? `<div class="meta"><div class="label">Response Example</div><pre>${escapeHtml(typeof entry.responseExample === "string" ? entry.responseExample : JSON.stringify(entry.responseExample, null, 2))}</pre></div>`
      : "";

    return `
      <article class="card">
        <div class="top">
          <span class="badge ${methodClass(entry.method)}">${escapeHtml(entry.method)}</span>
          <code class="path">${escapeHtml(entry.path)}</code>
        </div>
        <p class="desc">${escapeHtml(entry.description || "")}</p>
        ${queryBlock}
        ${bodyBlock}
        ${responseBlock}
      </article>
    `;
      }).join("\n");

      return `
        <section class="group">
          <h2>${escapeHtml(group)}</h2>
          <div class="stack">
            ${cards}
          </div>
        </section>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>iRedMail CLI REST API Reference</title>
  <style>
    :root {
      --bg: #0b1220;
      --panel: #111a2c;
      --text: #e7edf8;
      --muted: #9fb0cd;
      --border: #233252;
      --get: #1f9d6a;
      --post: #0f7ae5;
      --patch: #b97a10;
      --delete: #cc3d3d;
      --other: #66758f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top right, #16233f 0%, var(--bg) 40%);
      color: var(--text);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 28px 18px 42px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 30px;
      letter-spacing: 0.2px;
    }
    .sub {
      margin: 0 0 20px;
      color: var(--muted);
      font-size: 14px;
    }
    .group {
      margin-top: 22px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 18px;
      color: #c9d8f4;
      letter-spacing: 0.3px;
    }
    .stack {
      display: grid;
      gap: 14px;
      grid-template-columns: 1fr;
    }
    .card {
      background: linear-gradient(180deg, #121d33 0%, var(--panel) 100%);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 14px 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    }
    .top {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      letter-spacing: 0.4px;
      font-weight: 700;
      padding: 3px 10px;
      min-width: 65px;
      text-align: center;
    }
    .badge.get { background: var(--get); }
    .badge.post { background: var(--post); }
    .badge.patch { background: var(--patch); }
    .badge.delete { background: var(--delete); }
    .badge.other { background: var(--other); }
    .path {
      font-size: 13px;
      color: #b5c6e5;
      background: #0f1728;
      border: 1px solid #1f2d48;
      border-radius: 7px;
      padding: 4px 8px;
    }
    .desc {
      margin: 0 0 10px;
      color: #d4def1;
      font-size: 14px;
    }
    .meta { margin-top: 8px; }
    .label {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 600;
    }
    pre {
      margin: 0;
      padding: 9px 10px;
      overflow: auto;
      background: #0c1322;
      border: 1px solid #202e4a;
      border-radius: 8px;
      font-size: 12px;
      color: #dce8ff;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>iRedMail CLI REST API Reference</h1>
    <p class="sub">CLI Path: <code>${escapeHtml(CLI_PATH)}</code> | Timeout: <code>${escapeHtml(CLI_TIMEOUT_MS)}</code> ms</p>
    ${sections}
  </main>
</body>
</html>`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) reject(new Error("request body too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_err) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(CLI_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let resolved = false;
    let timedOut = false;

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch (_err) {
        // Ignore kill errors; close/error handlers will resolve.
      }
    }, CLI_TIMEOUT_MS);

    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutHandle);
      resolve(payload);
    };

    child.on("error", (err) => {
      finish({
        ok: false,
        exitCode: -1,
        timedOut,
        timeoutMs: CLI_TIMEOUT_MS,
        args,
        stdout: stdout.trim(),
        stderr: `${stderr}${err.message}`.trim()
      });
    });

    child.on("close", (exitCode) => {
      finish({
        ok: exitCode === 0 && !timedOut,
        exitCode,
        timedOut,
        timeoutMs: CLI_TIMEOUT_MS,
        args,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function parseAsciiTable(stdout) {
  if (!stdout || !stdout.includes("|")) return null;
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  const rowLines = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (rowLines.length < 2) return null;

  const splitRow = (row) =>
    row
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = splitRow(rowLines[0]);
  if (headers.length === 0) return null;

  const records = [];
  let lastPrimary = "";

  for (let i = 1; i < rowLines.length; i++) {
    const values = splitRow(rowLines[i]);
    if (values.length !== headers.length) continue;

    const record = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      record[key] = values[j];
    }

    const firstKey = headers[0].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (record[firstKey] === "" && lastPrimary !== "") {
      record[firstKey] = lastPrimary;
    } else if (record[firstKey]) {
      lastPrimary = record[firstKey];
    }

    records.push(record);
  }

  return { headers, records };
}

function withParsedOutput(result) {
  const parsed = parseAsciiTable(result.stdout || "");
  if (!parsed) return [];
  return parsed.records;
}

function respondWithCli(res, result, successStatus = 200) {
  const payload = withParsedOutput(result);
  if (result.timedOut) {
    return json(res, 504, {
      error: "cli command timed out",
      timeout_ms: result.timeoutMs,
      args: result.args
    });
  }
  return json(res, result.ok ? successStatus : 400, payload);
}

function decodeTail(pathname, index) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= index) return "";
  return decodeURIComponent(parts[index]);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = reqUrl;

  try {
    if (req.method === "GET" && pathname === "/health") {
      return json(res, 200, { status: "ok", cliPath: CLI_PATH });
    }

    if (req.method === "GET" && pathname === "/api/reference") {
      return html(res, 200, buildReferenceHtml());
    }

    if (req.method === "GET" && pathname === "/api/version") {
      return respondWithCli(res, await runCli(["version"]));
    }

    if (req.method === "GET" && pathname === "/api/mailboxes") {
      const filter = searchParams.get("filter");
      const args = ["mailbox", "list"];
      if (filter) args.push("--filter", filter);
      return respondWithCli(res, await runCli(args));
    }

    if (req.method === "POST" && pathname === "/api/mailboxes") {
      const body = await readBody(req);
      if (!body.email || !body.password) return json(res, 400, { error: "email and password are required" });

      const args = ["mailbox", "add", body.email, body.password];
      if (body.quota !== undefined) args.push("--quota", String(body.quota));
      if (body.storagePath) args.push("--storage-path", String(body.storagePath));
      return respondWithCli(res, await runCli(args), 201);
    }

    if (req.method === "GET" && pathname.startsWith("/api/mailboxes/") && !pathname.endsWith("/aliases")) {
      const email = decodeTail(pathname, 2);
      if (!email) return json(res, 400, { error: "mailbox email missing in path" });
      return respondWithCli(res, await runCli(["mailbox", "info", email]));
    }

    if (req.method === "PATCH" && pathname.startsWith("/api/mailboxes/")) {
      const email = decodeTail(pathname, 2);
      if (!email) return json(res, 400, { error: "mailbox email missing in path" });

      const body = await readBody(req);
      const args = ["mailbox", "update", email];
      let changed = false;

      if (body.quota !== undefined) {
        args.push("--quota", String(body.quota));
        changed = true;
      }
      if (body.password) {
        args.push("--password", String(body.password));
        changed = true;
      }
      if (body.keepCopy !== undefined) {
        args.push("--keep-copy", body.keepCopy ? "yes" : "no");
        changed = true;
      }

      if (!changed) return json(res, 400, { error: "at least one of quota, password, keepCopy is required" });
      return respondWithCli(res, await runCli(args));
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/mailboxes/") && !pathname.endsWith("/aliases")) {
      const email = decodeTail(pathname, 2);
      if (!email) return json(res, 400, { error: "mailbox email missing in path" });
      return respondWithCli(res, await runCli(["mailbox", "delete", email, "--force"]));
    }

    if (req.method === "POST" && pathname.endsWith("/aliases")) {
      const mailboxEmail = decodeTail(pathname, 2);
      if (!mailboxEmail) return json(res, 400, { error: "mailbox email missing in path" });
      const body = await readBody(req);
      if (!body.alias) return json(res, 400, { error: "alias is required (name part only)" });
      return respondWithCli(res, await runCli(["mailbox", "add-alias", String(body.alias), mailboxEmail]), 201);
    }

    if (req.method === "DELETE" && pathname === "/api/mailbox-aliases") {
      const body = await readBody(req);
      if (!body.aliasEmail) return json(res, 400, { error: "aliasEmail is required" });
      return respondWithCli(res, await runCli(["mailbox", "delete-alias", body.aliasEmail]));
    }

    if (req.method === "GET" && pathname === "/api/forwardings") {
      const filter = searchParams.get("filter");
      const args = ["forwarding", "list"];
      if (filter) args.push("--filter", filter);
      return respondWithCli(res, await runCli(args));
    }

    if (req.method === "POST" && pathname === "/api/forwardings") {
      const body = await readBody(req);
      if (!body.mailboxEmail || !body.destinationEmail) return json(res, 400, { error: "mailboxEmail and destinationEmail are required" });
      return respondWithCli(res, await runCli(["forwarding", "add", body.mailboxEmail, body.destinationEmail]), 201);
    }

    if (req.method === "DELETE" && pathname === "/api/forwardings") {
      const body = await readBody(req);
      if (!body.mailboxEmail || !body.destinationEmail) return json(res, 400, { error: "mailboxEmail and destinationEmail are required" });
      return respondWithCli(res, await runCli(["forwarding", "delete", body.mailboxEmail, body.destinationEmail]));
    }

    if (req.method === "GET" && pathname === "/api/aliases") {
      const filter = searchParams.get("filter");
      const args = ["alias", "list"];
      if (filter) args.push("--filter", filter);
      return respondWithCli(res, await runCli(args));
    }

    if (req.method === "POST" && pathname === "/api/aliases") {
      const body = await readBody(req);
      if (!body.aliasEmail) return json(res, 400, { error: "aliasEmail is required" });
      return respondWithCli(res, await runCli(["alias", "add", body.aliasEmail]), 201);
    }

    if (req.method === "GET" && pathname.startsWith("/api/aliases/") && !pathname.endsWith("/forwardings")) {
      const aliasEmail = decodeTail(pathname, 2);
      if (!aliasEmail) return json(res, 400, { error: "alias email missing in path" });
      return respondWithCli(res, await runCli(["alias", "info", aliasEmail]));
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/aliases/") && !pathname.endsWith("/forwardings")) {
      const aliasEmail = decodeTail(pathname, 2);
      if (!aliasEmail) return json(res, 400, { error: "alias email missing in path" });
      return respondWithCli(res, await runCli(["alias", "delete", aliasEmail]));
    }

    if (req.method === "POST" && pathname.endsWith("/forwardings") && pathname.startsWith("/api/aliases/")) {
      const aliasEmail = decodeTail(pathname, 2);
      if (!aliasEmail) return json(res, 400, { error: "alias email missing in path" });
      const body = await readBody(req);
      if (!body.destinationEmail) return json(res, 400, { error: "destinationEmail is required" });
      return respondWithCli(res, await runCli(["alias", "add-forwarding", aliasEmail, body.destinationEmail]), 201);
    }

    if (req.method === "DELETE" && pathname === "/api/alias-forwardings") {
      const body = await readBody(req);
      if (!body.aliasEmail || !body.destinationEmail) return json(res, 400, { error: "aliasEmail and destinationEmail are required" });
      return respondWithCli(res, await runCli(["alias", "delete-forwarding", body.aliasEmail, body.destinationEmail]));
    }

    if (req.method === "POST" && pathname === "/api/cli") {
      const body = await readBody(req);
      if (!Array.isArray(body.args) || body.args.length === 0) return json(res, 400, { error: "args must be a non-empty array" });
      if (!body.args.every((a) => typeof a === "string" && a.length > 0)) return json(res, 400, { error: "args must be an array of non-empty strings" });
      return respondWithCli(res, await runCli(body.args));
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    return json(res, 500, { error: err.message || "internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`iredmail-cli REST API listening on :${PORT}`);
  console.log(`using iredmail-cli binary: ${CLI_PATH}`);
  console.log(`cli timeout (ms): ${CLI_TIMEOUT_MS}`);
});
