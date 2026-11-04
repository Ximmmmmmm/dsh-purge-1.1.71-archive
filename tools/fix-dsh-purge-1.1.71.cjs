// dsh-purge 1.1.71 -> DSH 0.2.1-rc.5 综合兼容补丁（保持版本为 1.1.71）
// 幂等。每次 pnpm install / 插件重装后重跑一次即可。
// 用法: node fix-dsh-purge-1.1.71.cjs [profile目录] [用户redteam预设]
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const home = os.homedir()
const profile = process.argv[2] || path.join(home, '.dsh', 'profiles', 'desktop')
const plugin = path.join(profile, 'node_modules', 'dsh-purge')
const userPreset = process.argv[3] || path.join(home, '.dsh', '.agent-presets', 'redteam', 'agent.cordis.yml')
const results = []

function writePatched(file, label, next, isJs) {
  const bak = file + '.pre-compat-fix.bak'
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak)
  fs.writeFileSync(file, next, 'utf8')
  if (isJs) {
    try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }) }
    catch (e) { throw new Error(label + ' 语法检查失败: ' + e.message) }
  }
  results.push('[修复] ' + label)
}

function applyJs(file, label, isPatched, transform) {
  if (!fs.existsSync(file)) { results.push('[跳过] ' + label + '（文件不存在）'); return }
  const src = fs.readFileSync(file, 'utf8')
  if (isPatched(src)) { results.push('[已修] ' + label); return }
  const next = transform(src)
  if (next === null || next === src) { results.push('[失败] ' + label + '（锚点未命中，未改动）'); process.exitCode = 1; return }
  writePatched(file, label, next, true)
}

// 1) {{cwd}} 静态回退：rc.5 只注册 provider/model，未注册变量会让整轮对话失败
const CWD_HELPER = String.raw`// dsh 0.2.1 只注册 provider/model，未注册的 {{cwd}} 会让提示词组装直接失败。
const CWD_TOKEN_G = /\{\{\s*cwd\s*\}\}|\[\s*cwd\s*\]/g;
const CWD_TOKEN_T = /\{\{\s*cwd\s*\}\}|\[\s*cwd\s*\]/;
function sanitizeCwdTokens(sections) {
  return (Array.isArray(sections) ? sections : []).map((section) => (
    section && typeof section.text === "string" && CWD_TOKEN_T.test(section.text)
      ? { ...section, text: section.text.replace(CWD_TOKEN_G, "the current workspace") }
      : section
  ));
}`
applyJs(path.join(plugin, 'lib/identity.js'), 'identity.js: {{cwd}} 静态回退',
  s => s.includes('function sanitizeCwdTokens('),
  s => {
    const anchor = 'const DSH_INTERPOLATE_ALLOWED = new Set(["cwd", "model", "provider"]);'
    const retOut = '  return out;\n}\n\nfunction withoutHardcodedExec'
    const retSections = '    sections: outSections,'
    if (![anchor, retOut, retSections].every(x => s.includes(x))) return null
    s = s.replace(anchor, CWD_HELPER + '\n\n' + anchor)
    s = s.replace(retOut, '  return sanitizeCwdTokens(out);\n}\n\nfunction withoutHardcodedExec')
    s = s.replace(retSections, '    sections: sanitizeCwdTokens(outSections),')
    return s
  })

// 2) 红队工具：补齐桌面版 dsh-tools 解析路径；0.2.1 要求 object schema 显式 additionalProperties
const SCHEMA_WRAP = String.raw`const defineToolRaw = loadDefineTool()

/** 0.2.1：任何 type=object 都必须显式 additionalProperties，否则整份红队预设加载失败。 */
function sealObjectSchemas(node) {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) {
    for (const item of node) sealObjectSchemas(item)
    return node
  }
  if (node.type === 'object' && node.additionalProperties === undefined) {
    node.additionalProperties = node.properties ? false : true
  }
  if (node.properties) {
    for (const key of Object.keys(node.properties)) sealObjectSchemas(node.properties[key])
  }
  if (node.items) sealObjectSchemas(node.items)
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    sealObjectSchemas(node.additionalProperties)
  }
  return node
}

function defineTool(spec) {
  if (spec && spec.parameters) sealObjectSchemas(spec.parameters)
  const tool = defineToolRaw(spec)
  if (tool && tool.parameters) sealObjectSchemas(tool.parameters)
  if (tool && tool.inputSchema) sealObjectSchemas(tool.inputSchema)
  if (tool && tool.schema) sealObjectSchemas(tool.schema)
  return tool
}`
applyJs(path.join(plugin, 'lib/redteam/tools.js'), 'tools.js: dsh-tools 解析 + JSON Schema 封口',
  s => s.includes('function sealObjectSchemas(') && s.includes('DSH_DESKTOP_HOME'),
  s => {
    const a1 = `function loadDefineTool() {
  const candidates = []
  try { considerBin(candidates, process.argv[1]) } catch { /* ignore */ }`
    const a2 = `  addCandidate(candidates, join(process.cwd(), 'package.json'))
  addCandidate(candidates, join('D:', 'DeepSeek Harness', 'npm-global', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))`
    const a3 = `const defineTool = loadDefineTool()`
    if (![a1, a2, a3].every(x => s.includes(x))) return null
    s = s.replace(a1, `function loadDefineTool() {
  const candidates = []
  try {
    const req = createRequire(import.meta.url)
    const mod = req('@deepseek-ai/dsh-tools')
    const fn = mod && (mod.defineTool || (mod.default && mod.default.defineTool))
    if (typeof fn === 'function') return fn
  } catch { /* 插件自己的 node_modules 里没有，再扫宿主 */ }
  try { considerBin(candidates, process.argv[1]) } catch { /* ignore */ }
  try { considerBin(candidates, process.execPath) } catch { /* ignore */ }`)
    s = s.replace(a2, `  const resources = process.resourcesPath || ''
  const exeDir = process.execPath ? dirname(process.execPath) : ''
  const desktopRoots = [resources, exeDir ? join(exeDir, 'resources') : '', exeDir].filter(Boolean)
  for (const root of desktopRoots) {
    addCandidate(candidates, join(root, 'app', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))
    addCandidate(candidates, join(root, 'app', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))
    addCandidate(candidates, join(root, 'app.asar.unpacked', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))
    addCandidate(candidates, join(root, 'app.asar.unpacked', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))
  }
  const desktopHome = process.env.DSH_DESKTOP_HOME || 'D:/DeepSeek'
  addCandidate(candidates, join(desktopHome, 'resources', 'app', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))
  addCandidate(candidates, join(desktopHome, 'resources', 'app.asar.unpacked', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))
` + a2)
    s = s.replace(a3, SCHEMA_WRAP)
    return s
  })

// 3) hostFs：吃 fd 的方法不能走路径路由，否则 asar 探测拿到数字 fd
applyJs(path.join(plugin, 'lib/extract-asar.js'), 'extract-asar.js: hostFs fd 直通',
  s => s.includes('const HOST_FD'),
  s => {
    const b1 = `  "rmSync", "renameSync", "appendFileSync", "openSync", "symlinkSync",
];`
    const b2 = `for (const method of HOST_SYNC) hostFs[method] = route(method, false);`
    if (!s.includes(b1) || !s.includes(b2)) return null
    s = s.replace(b1, `  "rmSync", "renameSync", "appendFileSync", "openSync", "symlinkSync",
  "accessSync", "truncateSync", "utimesSync",
];

// 这些吃的是 fd，不是路径。走 route() 会把数字 fd 当路径做 asar 探测。
const HOST_FD = [
  "closeSync", "readSync", "writeSync", "fsyncSync", "fstatSync", "futimesSync",
];`)
    s = s.replace(b2, b2 + `\nfor (const method of HOST_FD) hostFs[method] = (fd, ...args) => nodeFs[method](fd, ...args);`)
    return s
  })

// 4/5) preset：0.2.1 的 dsh-tool-subagent 见到 toolFilter 会直接 throw
function stripToolFilter(text) {
  const lines = String(text).split(/\r?\n/)
  const out = []
  let skipIndent = null
  let changed = false
  for (const line of lines) {
    if (skipIndent !== null) {
      const indent = (/^(\s*)/.exec(line) || ['', ''])[1].length
      if (line.trim() !== '' && indent > skipIndent) { changed = true; continue }
      skipIndent = null
    }
    const block = /^(\s*)toolFilter:\s*(?:#.*)?$/.exec(line)
    if (block) { skipIndent = block[1].length; changed = true; continue }
    if (/^\s*toolFilter:\s+\S/.test(line)) { changed = true; continue }
    out.push(line)
  }
  return { text: out.join('\n'), changed }
}
for (const [file, label] of [
  [path.join(plugin, 'presets/redteam/agent.cordis.yml'), '包内 redteam 模板'],
  [userPreset, '用户 redteam 预设'],
]) {
  if (!fs.existsSync(file)) { results.push('[跳过] ' + label + '（文件不存在）'); continue }
  const src = fs.readFileSync(file, 'utf8')
  const r = stripToolFilter(src)
  if (!r.changed) { results.push('[已修] ' + label + ' 无 toolFilter'); continue }
  writePatched(file, label + ' 移除废弃 toolFilter', r.text, false)
}

// 6) 运行时兜底：插件每次同步 redteam 预设时自动剥离 toolFilter
const STRIP_FN = String.raw`/** 0.2.1 已废弃 toolFilter：残留会让红队预设整份加载失败。 */
function stripToolFilter(text) {
  const lines = String(text || '').split(/\r?\n/)
  const out = []
  let skipIndent = null
  let changed = false
  for (const line of lines) {
    if (skipIndent !== null) {
      const indent = (/^(\s*)/.exec(line) || ['', ''])[1].length
      if (line.trim() !== '' && indent > skipIndent) { changed = true; continue }
      skipIndent = null
    }
    const block = /^(\s*)toolFilter:\s*(?:#.*)?$/.exec(line)
    if (block) { skipIndent = block[1].length; changed = true; continue }
    if (/^\s*toolFilter:\s+\S/.test(line)) { changed = true; continue }
    out.push(line)
  }
  return { text: out.join('\n'), changed }
}`
applyJs(path.join(plugin, 'lib/redteam/index.js'), 'redteam/index.js: 同步时自动剥离 toolFilter',
  s => s.includes('function stripToolFilter('),
  s => {
    const a = `    const rendered = renderSkillsDir(text)
    const tools = renderToolsPackage(rendered.text)
    const delegation = repairDelegation(tools.text)
    const next = delegation.text
    if (rendered.changed || tools.changed || delegation.changed) {`
    if (!s.includes(a)) return null
    s = s.replace(a, `    const rendered = renderSkillsDir(text)
    const tools = renderToolsPackage(rendered.text)
    const filter = stripToolFilter(tools.text)
    const delegation = repairDelegation(filter.text)
    const next = delegation.text
    if (rendered.changed || tools.changed || filter.changed || delegation.changed) {`)
    return s + '\n' + STRIP_FN + '\n'
  })

// 7) 换包助手若自身仍是 Electron 映像，不能把自己列进待杀名单
applyJs(path.join(plugin, 'lib/restart-desktop.js'), 'restart-desktop.js: 换包助手不自杀',
  s => s.includes('return pids.filter((pid) => pid !== process.pid);'),
  s => {
    const a = `  for (const image of images) {
    try {
      pids.push(...pidsForImage(image));
    } catch {
      // 该进程名不存在
    }
  }
  return pids;
}`
    if (!s.includes(a)) return null
    return s.replace(a, `  for (const image of images) {
    try {
      pids.push(...pidsForImage(image));
    } catch {
      // 该进程名不存在
    }
  }
  // 助手自己若仍是 Electron 映像，绝不能进待杀名单。
  return pids.filter((pid) => pid !== process.pid);
}`)
  })

console.log(results.join('\n'))
console.log('\ndsh-purge 版本保持: ' + (fs.existsSync(path.join(plugin, 'package.json'))
  ? JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8')).version : '?'))
console.log('请重启 DeepSeek Harness 使 Host 重新加载模块。')
