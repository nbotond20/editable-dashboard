import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const SUITE_PATH = join(DIR, "suite", "scenarios.json");
const PORT = Number(process.env.PORT) || 3334;

const MIME = {
  ".html": "text/html",
  ".json": "application/json",
  ".js": "text/javascript",
  ".css": "text/css",
};

const server = createServer((req, res) => {
  // POST /api/save — write scenarios.json
  if (req.method === "POST" && req.url === "/api/save") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        JSON.parse(body); // validate
        writeFileSync(SUITE_PATH, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(`{"error":"${e.message}"}`);
      }
    });
    return;
  }

  // GET — static files
  let filePath = join(DIR, req.url === "/" ? "/review.html" : req.url);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const mime = MIME[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`Review server: http://localhost:${PORT}`);
});
