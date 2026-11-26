import { readFileSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { runInThisContext } from "node:vm"
import ts from "typescript"

// One module graph per database, sharing the same domain rules as the UI/tests.
export function createDomain() {
  let clock
  class DomainDate extends Date {
    constructor(...args) {
      if (args.length) super(...args)
      else super(clock ?? Date.now())
    }
    static now() {
      return clock ?? Date.now()
    }
  }
  const root = fileURLToPath(new URL("../src/", import.meta.url))
  const nativeRequire = createRequire(import.meta.url)
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
    const require = (name) => {
      if (!name.startsWith(".")) return nativeRequire(name)
      const target = [".ts", ".tsx"]
        .map((ext) => resolve(dirname(file), name) + ext)
        .find(existsSync)
      if (!target || !target.startsWith(root))
        throw new Error("Invalid domain import")
      return load(target)
    }
    runInThisContext(
      `(function(require,module,exports,window,Date){${code}\n})`,
      {
        filename: file,
      },
    )(require, module, module.exports, undefined, DomainDate)
    return module.exports
  }
  return {
    // Used only by the admin-only historical fixture importer, never from client input.
    withTime(at, callback) {
      const previous = clock
      clock = new Date(at).getTime()
      if (!Number.isFinite(clock)) throw new Error("Invalid fixture time")
      try {
        return callback()
      } finally {
        clock = previous
      }
    },
    store: load(resolve(root, "features/master-data/store.ts")),
    service: load(resolve(root, "features/production/lib/service.ts")),
    execution: load(
      resolve(root, "features/production/lib/executionService.ts"),
    ),
    model: load(resolve(root, "features/production/lib/model.ts")),
    access: load(resolve(root, "features/production/lib/access.ts")),
    bom: load(resolve(root, "features/process-bom/lib/service.ts")),
  }
}
