import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
function load(file) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const require = name => {
    const base = resolve(dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(existsSync))
  }
  runInNewContext(code, { module, exports: module.exports, require, crypto })
  return module.exports
}
const { nextDocumentCode, validateDocument, availableStock } = load(resolve('src/features/warehouse-documents/lib/documentData.ts'))
assert.equal(nextDocumentCode([{code:'NK-000001'}],'receipt'),'NK-000002')
const values={plannedDate:'2026-10-10',requiredAt:'2026-10-10T08:00',sourceWarehouse:'raw',destinationWarehouse:'production'}
validateDocument('internal',values,[{productId:'1',quantity:1}],true)
assert.throws(()=>validateDocument('internal',{...values,destinationWarehouse:'raw'},[],true))
assert.throws(()=>validateDocument('issue',values,[{productId:'1',quantity:availableStock('1','raw')+1}],true))
assert.throws(()=>validateDocument('receipt',values,[],true))
validateDocument('receipt',values,[],false)
console.log('PASS: unique codes, warehouse rules, quantity limits and draft/confirmation validation')
