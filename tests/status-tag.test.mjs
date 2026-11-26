import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const module = { exports: {} }
const code = ts.transpileModule(readFileSync(new URL("../src/components/shared/StatusTag.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
runInNewContext(code, { module, exports: module.exports, require: createRequire(import.meta.url) })
const StatusTag = module.exports.default
// Semantic labels must override conflicting legacy colors.
for (const [label, color, tone] of [
  ["Ngừng hoạt động", "error", "neutral"],
  ["Không hoạt động", "success", "neutral"],
  ["Bản nháp", "orange", "neutral"],
  ["Đang chạy", "green", "progress"],
  ["Tạm dừng", "blue", "waiting"],
  ["Chưa phân công", "default", "waiting"],
  ["Quá hạn", "blue", "danger"],
  ["Đã hủy", "default", "danger"],
  ["Thiếu nhân viên trong ca", "default", "danger"],
  ["Chưa có nhân viên trong ca", "blue", "danger"],
  ["Đang áp dụng", "default", "success"],
  ["Hoàn thành", "blue", "success"],
  ["Sử dụng", "default", "success"],
  ["Lưu trữ", "success", "neutral"],
]) {
  const tag = StatusTag({ children: label, color })
  assert.ok(tag.props.className.includes(`mes-status-${tone}`), label)
  assert.equal(tag.props.children[1], label)
  assert.equal(tag.props.children[0].props["aria-hidden"], "true")
}

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
function luminance(hex) {
  const rgb = hex.match(/\w\w/g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
const palettes = [...css.matchAll(/\.mes-status-(\w+) \{ --status-bg: (#\w+); --status-text: (#\w+);/g)]
assert.equal(palettes.length, 5)
for (const [, tone, bg, text] of palettes) {
  assert.ok((luminance(bg) + 0.05) / (luminance(text) + 0.05) >= 4.5, `${tone}: text contrast`)
}
console.log("PASS: status semantics override legacy colors, visible labels, decorative dots and five palettes meet 4.5:1 text contrast")
