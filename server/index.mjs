import { createServer } from "node:http"
import { createReadStream, statSync } from "node:fs"
import { resolve, extname, sep } from "node:path"
import { createSystem } from "./system.mjs"
const system = createSystem(),
  root = resolve("dist")
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}
const server = createServer(
  (req, res) =>
    void system.handler(req, res, () => {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405)
        res.end()
        return
      }
      try {
        const pathname = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        )
        let file = resolve(root, `.${pathname}`)
        if (file !== root && !file.startsWith(root + sep)) {
          res.writeHead(404)
          res.end()
          return
        }
        if (!extname(file)) file = resolve(root, "index.html")
        if (!statSync(file).isFile()) throw new Error("Missing file")
        res.setHeader(
          "Content-Type",
          types[extname(file)] || "application/octet-stream",
        )
        res.setHeader("X-Content-Type-Options", "nosniff")
        if (req.method === "HEAD") res.end()
        else createReadStream(file).pipe(res)
      } catch {
        res.writeHead(404)
        res.end("Not found")
      }
    }),
)
server.listen(
  Number(process.env.MES_PORT || 3001),
  process.env.MES_HOST || "127.0.0.1",
  () =>
    console.info(
      `MES listening on http://${process.env.MES_HOST || "127.0.0.1"}:${process.env.MES_PORT || 3001}`,
    ),
)
const close = () =>
  server.close(() => {
    system.close()
    process.exit(0)
  })
process.on("SIGINT", close)
process.on("SIGTERM", close)
