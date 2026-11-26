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
const { filterDocuments } = load(resolve('src/features/warehouse-documents/lib/filterDocuments.ts'))
const { mockDocuments } = load(resolve('src/features/warehouse-documents/mocks/documents.ts'))
const item=mockDocuments[0]
assert.equal(mockDocuments.length,24)
assert.equal(filterDocuments(mockDocuments,{code:' wh-00001 ',type:item.type,status:item.status,dateRange:[item.plannedDate,item.plannedDate],sourceWarehouse:item.sourceWarehouse,destinationWarehouse:item.destinationWarehouse}).length,1)
assert.equal(filterDocuments(mockDocuments,{code:'missing'}).length,0)
assert.equal(filterDocuments(mockDocuments,{dateRange:['2027-01-01','2027-12-31']}).length,0)
assert.equal(filterDocuments(mockDocuments,{}).length,24)
console.log('PASS: combined warehouse document filters, inclusive dates, empty results and reset')
