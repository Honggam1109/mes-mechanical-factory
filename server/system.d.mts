import type { IncomingMessage, ServerResponse } from "node:http"
export function createSystem(options?: {
  filename?: string
  adminPassword?: string
  adminUsername?: string
}): {
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    next?: () => void,
  ) => Promise<void>
  close: () => void
}
