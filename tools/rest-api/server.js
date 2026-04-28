const http = require("http");
const { spawn } = require("child_process");
const { URL } = require("url");

const PORT = parseInt(process.env.PORT || "8080", 10);
const CLI_PATH = process.env.IREDMAIL_CLI_PATH || "iredmail-cli";
const CLI_TIMEOUT_MS = parseInt(process.env.CLI_TIMEOUT_MS || "15000", 10);

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
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
