#!/usr/bin/env node
/*
 * ⚠ 免責聲明：本專案為非官方第三方繁體中文化工具，與 Postman, Inc. 無任何關聯，未獲其授權或背書；
 *   "Postman" 是 Postman, Inc. 的商標。本倉庫不包含、也不分發 Postman 的任何原始碼 / 二進位 /
 *   原始語言包。僅供個人在本地使用，使用者自負風險，請遵守 Postman 的服務條款與 EULA。
 *   程式碼以 MIT 許可（僅覆蓋本專案自身程式碼，不含派生自 Postman 文案的譯文數據）。
 */
/*
 * postman-traditional-chinese-injector.js —— 把繁體中文掛鉤注入 Postman 桌面端（跨平台 CLI）
 *
 * Electron 的資源解析順序是「app.asar 存在則優先用 asar，否則退而載入未打包的 resources/app/」。
 * 本腳本兩種安裝型態都支援，自動判別：
 *
 *   1. 按平台自動定位 Postman 的 resources 目錄（Windows / macOS / Linux）；
 *   2. 把 locales/zh-CN/*.json 合併成扁平 bundle（每個檔案一個模組）；
 *
 *   【app.asar 型】
 *   3a. 首次執行時把原始 app.asar 備份為 app.asar.bak（之後始終從備份重新打補丁，
 *       保證冪等、且 Postman 更新後能乾淨重打）；
 *   4a. 用 @electron/asar 解包備份 -> 暫存目錄（裝了依賴走程式化 API，否則回退 npx）；
 *   5a. 往渲染行程 preload 注入一行 require('./pm-chinese.js')，掛鉤 + 數據放在 preload 同目錄；
 *       preload 路徑隨版本而異：新版為根目錄 preload_desktop.js，舊版(10.24)為 preload/desktop/index.js；
 *   6a. 打包暫存目錄 -> app.asar（覆蓋）。
 *
 *   【未打包 app/ 型】（沒有 app.asar，只有 resources/app/ 目錄）
 *   3b. 首次執行時把渲染行程 preload 備份為 <preload>.bak（始終從備份打補丁）；
 *   4b. 直接往該 preload 注入 require('./pm-chinese.js')，並把 pm-chinese.js +
 *       pm-chinese-data.json 寫到 preload 同目錄——無需解包/打包。
 *
 * 主視窗 webPreferences 為 contextIsolation=false + nodeIntegration=true，preload 與頁面
 * 共享 main world 且先於頁面腳本執行，故掛鉤能直接改 window.fetch 攔截語言包回應。
 *
 * 用法:
 *     node postman-traditional-chinese-injector.js                       # 注入繁體中文（自動偵測 Postman）
 *     node postman-traditional-chinese-injector.js --restore             # 還原
 *     node postman-traditional-chinese-injector.js --resources <dir>     # 直接指定含 app.asar 或 app/ 的目錄
 *     node postman-traditional-chinese-injector.js --postman-dir <dir>   # 指定 Postman 安裝根目錄
 *     node postman-traditional-chinese-injector.js --app-version 12.16.1 # Windows 多版本時指定 app-<version>
 *
 * 裝為全域指令後亦可：postman-traditional-chinese-injector [--restore ...]
 * 注入/還原前請先完全結束 Postman。macOS / Linux 的系統級安裝可能需要 sudo。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE_DIR = __dirname;
const HOOK_SRC = path.join(BASE_DIR, 'pm-chinese.js');
const LOCALES_DIR = path.join(BASE_DIR, 'locales');
const DEFAULT_LANG = 'zh-CN';
const DATA_NAME = 'pm-chinese-data.json'; // 注入时在 asar 内生成的 bundle 文件名
const SCRATCH_HOOK_NAME = 'pm-scratchpad-cn.js';
const SCRATCH_HOOK_SRC = path.join(BASE_DIR, SCRATCH_HOOK_NAME);
const SCRATCH_DATA_NAME = 'pm-scratchpad-data.json';
const MAIN_HOOK_NAME = 'pm-main-cn.js';
const MAIN_HOOK_SRC = path.join(BASE_DIR, MAIN_HOOK_NAME);
const MAIN_DATA_NAME = 'pm-main-data.json';
const MAIN_ENTRY = 'main.js'; // 主进程入口（package.json 的 main）

const BAK_SUFFIX = '.bak';
const MARK_START = '// === PM-I18N START ===';
const MARK_END = '// === PM-I18N END ===';
const INJECT_BLOCK =
  `\n${MARK_START}\n` +
  "try { require('./pm-chinese.js'); } catch (e) { console.error('[pm-chinese] load failed', e); }\n" +
  "try { require('./pm-scratchpad-cn.js'); } catch (e) { console.error('[pm-scratchpad] load failed', e); }\n" +
  `${MARK_END}\n`;
// 主进程入口的注入块：须插在 main.js 最前面，赶在 Postman 建菜单之前包装好 Menu
const MAIN_INJECT_BLOCK =
  `${MARK_START}\n` +
  "try { require('./pm-main-cn.js'); } catch (e) { console.error('[pm-main] load failed', e); }\n" +
  `${MARK_END}\n`;

// ---------- 小工具 ----------
function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}
// 渲染进程 preload 在不同 Postman 版本里的相对路径（按优先级排序）：
//   新版        -> preload_desktop.js（根目录）
//   老版(10.24) -> preload/desktop/index.js（见 windowManager.js 的 webPreferences.preload）
// 注意：根目录还有个主进程用的 preload.js，不能误选，故只匹配这份明确清单。
const PRELOAD_CANDIDATES = ['preload_desktop.js', path.join('preload', 'desktop', 'index.js')];
// 在 root（解包后的 staging 或未打包 app/）里定位渲染进程 preload，找不到返回 null。
function findPreloadIn(root) {
  for (const rel of PRELOAD_CANDIDATES) {
    const p = path.join(root, rel);
    if (isFile(p)) return p;
  }
  return null;
}
// 未打包 app/ 型定位 preload：优先现存文件；preload 被删但 .bak 还在时，从 .bak 反推。
function resolveDirPreload(appDir) {
  const found = findPreloadIn(appDir);
  if (found) return found;
  for (const rel of PRELOAD_CANDIDATES) {
    const p = path.join(appDir, rel);
    if (isFile(p + BAK_SUFFIX)) return p;
  }
  return null;
}
// 在 asar 文件清单里定位渲染进程 preload，返回可直接喂给 extractFile 的内部路径，找不到返回 null。
// 注意 @electron/asar 在 Windows 上：listPackage 返回带前导分隔符的原生路径（如 \preload\desktop\index.js），
// 而 extractFile 只认「去掉前导分隔符、保留原生分隔符」的形式（如 preload\desktop\index.js）。
function findPreloadInAsar(files) {
  const key = (s) => s.replace(/\\/g, '/').replace(/^\/+/, ''); // 归一化用于比较
  for (const rel of PRELOAD_CANDIDATES) {
    const want = key(rel);
    for (const f of files) {
      if (key(f) === want) return f.replace(/^[\\/]+/, ''); // 保留原生分隔符，仅去前导
    }
  }
  return null;
}
function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}
function toolVersion() {
  try { return require('./package.json').version; } catch (e) { return '0.0.0'; }
}

// ---------- asar 解包/打包：优先程序化 API，回退 npx ----------
function loadAsar() {
  try { return require('@electron/asar'); } catch (e) { return null; }
}
// 固定 @electron/asar@4（最新主版本，要求 Node >=22.12）。若需兼容更老 Node 可改回 @3。
const ASAR_PKG = '@electron/asar@4';
function runNpxAsar(...args) {
  const quoted = args.map((a) => `"${a}"`).join(' ');
  const res = spawnSync(`npx --yes ${ASAR_PKG} ${quoted}`, { stdio: 'inherit', shell: true });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`@electron/asar ${args[0]} 失败（exit ${res.status}）。请确认已安装 Node.js + npx，或先 npm install`);
  }
}
function asarExtract(archive, dest) {
  const asar = loadAsar();
  if (asar) return asar.extractAll(archive, dest);
  return runNpxAsar('extract', archive, dest);
}
async function asarPack(src, dest) {
  const asar = loadAsar();
  if (asar) return asar.createPackage(src, dest);
  return runNpxAsar('pack', src, dest);
}
// 只读检查用：列文件 / 读单文件（只走程序化 API；二进制内已内置）
function asarList(archive) {
  const asar = loadAsar();
  if (!asar) throw new Error('需要 @electron/asar 才能检查（请先 npm install，或用编译好的二进制）');
  return asar.listPackage(archive);
}
function asarReadFile(archive, name) {
  const asar = loadAsar();
  if (!asar) throw new Error('需要 @electron/asar 才能检查（请先 npm install，或用编译好的二进制）');
  return asar.extractFile(archive, name).toString('utf8');
}

// ---------- 从 locales/<lang>/*.json 构建注入用的扁平 bundle ----------
// 编译成单文件二进制时身边没有 locales/，改用编译期嵌入的 pm-chinese-data.json。
function loadEmbedded() {
  try { return require('./pm-chinese-data.json'); } catch (e) { return null; }
}

// 注入用的钩子源码：编译成单文件二进制时 __dirname 指向编译机路径（如 /home/runner/...），
// 身边没有 pm-chinese.js，改用编译期嵌入的 pm-chinese-src.json。
function loadEmbeddedHook() {
  try { return require('./pm-chinese-src.json').src || null; } catch (e) { return null; }
}

// 取钩子源码（按优先级）：① exe 旁的 pm-chinese.js（允许覆盖内嵌，无需重编译）；
// ② 源码同目录（node 开发模式）；都没有则用编译期内嵌的快照。
function hookSource() {
  const cands = [];
  try { cands.push(path.join(path.dirname(process.execPath), 'pm-chinese.js')); } catch (e) { /* ignore */ }
  cands.push(HOOK_SRC);
  for (const p of cands) {
    if (isFile(p)) return { src: fs.readFileSync(p, 'utf8'), from: p };
  }
  const emb = loadEmbeddedHook();
  if (emb) return { src: emb, from: '内嵌快照' };
  throw new Error(`缺少钩子源码 pm-chinese.js（已尝试: ${cands.join('、')}，且无内嵌快照）`);
}

// Scratch Pad 钩子源码（编译后取内嵌快照，逻辑同 hookSource）
function loadEmbeddedScratchpadHook() {
  try { return require('./pm-scratchpad-src.json').src || null; } catch (e) { return null; }
}
function scratchpadHookSource() {
  const cands = [];
  try { cands.push(path.join(path.dirname(process.execPath), SCRATCH_HOOK_NAME)); } catch (e) { /* ignore */ }
  cands.push(SCRATCH_HOOK_SRC);
  for (const p of cands) {
    if (isFile(p)) return { src: fs.readFileSync(p, 'utf8'), from: p };
  }
  const emb = loadEmbeddedScratchpadHook();
  if (emb) return { src: emb, from: '内嵌快照' };
  throw new Error(`缺少 Scratch Pad 钩子源码 ${SCRATCH_HOOK_NAME}（且无内嵌快照）`);
}

// Scratch Pad 词典：① locales/scratchpad/zh-CN.json（exe 旁或源码旁）；② 内嵌快照
function loadEmbeddedScratchpadDict() {
  try { return require('./pm-scratchpad-data.json'); } catch (e) { return null; }
}
function loadScratchpadDict() {
  for (const root of localeRoots()) {
    const p = path.join(root, 'scratchpad', 'zh-CN.json');
    if (isFile(p)) {
      try { return { dict: JSON.parse(fs.readFileSync(p, 'utf8')), from: p }; } catch (e) { /* 坏文件则继续 */ }
    }
  }
  const emb = loadEmbeddedScratchpadDict();
  if (emb && typeof emb === 'object' && Object.keys(emb).length) return { dict: emb, from: '内嵌快照' };
  throw new Error('缺少 Scratch Pad 词典（locales/scratchpad/zh-CN.json 或内嵌快照）');
}

// 主进程钩子源码 / 词典（逻辑同 Scratch Pad）
function loadEmbeddedMainHook() {
  try { return require('./pm-main-src.json').src || null; } catch (e) { return null; }
}
function mainHookSource() {
  const cands = [];
  try { cands.push(path.join(path.dirname(process.execPath), MAIN_HOOK_NAME)); } catch (e) { /* ignore */ }
  cands.push(MAIN_HOOK_SRC);
  for (const p of cands) {
    if (isFile(p)) return { src: fs.readFileSync(p, 'utf8'), from: p };
  }
  const emb = loadEmbeddedMainHook();
  if (emb) return { src: emb, from: '内嵌快照' };
  throw new Error(`缺少主进程钩子源码 ${MAIN_HOOK_NAME}（且无内嵌快照）`);
}
function loadEmbeddedMainDict() {
  try { return require('./pm-main-data.json'); } catch (e) { return null; }
}
function loadMainDict() {
  for (const root of localeRoots()) {
    const p = path.join(root, 'main', 'zh-CN.json');
    if (isFile(p)) {
      try { return { dict: JSON.parse(fs.readFileSync(p, 'utf8')), from: p }; } catch (e) { /* 坏文件则继续 */ }
    }
  }
  const emb = loadEmbeddedMainDict();
  if (emb && typeof emb === 'object' && Object.keys(emb).length) return { dict: emb, from: '内嵌快照' };
  throw new Error('缺少主进程词典（locales/main/zh-CN.json 或内嵌快照）');
}

// 把注入块插到 main.js 最前面（若有 'use strict' 指令则插在其后，免得破坏严格模式）
function injectMainEntry(text) {
  const clean = stripBlock(text);
  const m = /^(\s*(['"])use strict\2;?[ \t]*\r?\n?)/.exec(clean);
  return m ? m[1] + MAIN_INJECT_BLOCK + clean.slice(m[1].length) : MAIN_INJECT_BLOCK + clean;
}

// 在 appRoot 写入注入后的 main.js + 主进程钩子与词典；entrySrc 为干净的 main.js 原文
function writeMainHook(appRoot, mainHook, mainDict, entrySrc) {
  fs.writeFileSync(path.join(appRoot, MAIN_ENTRY), injectMainEntry(entrySrc), 'utf8');
  fs.writeFileSync(path.join(appRoot, MAIN_HOOK_NAME), mainHook.src, 'utf8');
  fs.writeFileSync(path.join(appRoot, MAIN_DATA_NAME), JSON.stringify(mainDict.dict), 'utf8');
  console.log(`[注入] ${MAIN_ENTRY} <- require('./${MAIN_HOOK_NAME}')（原生菜单，${Object.keys(mainDict.dict).length} 条）`);
}

// 候选 locales 根目录（按优先级）：① 紧挨真正的可执行文件（允许在 exe 旁放 locales/ 覆盖
// 内嵌译文，无需重新编译）；② 源码同目录（node 开发模式）。都没有则用内嵌数据。
function localeRoots() {
  const roots = [];
  try { roots.push(path.join(path.dirname(process.execPath), 'locales')); } catch (e) { /* ignore */ }
  roots.push(LOCALES_DIR);
  return roots;
}

function buildBundle(lang) {
  let dir = null;
  for (const root of localeRoots()) {
    const d = path.join(root, lang);
    if (isDir(d)) { dir = d; break; }
  }
  if (!dir) {
    const emb = loadEmbedded();
    if (emb && typeof emb === 'object' && Object.keys(emb).length) {
      return { bundle: emb, count: Object.keys(emb).length, embedded: true };
    }
    throw new Error(`找不到语言目录 locales/${lang}/（且无内嵌数据）`);
  }
  const bundle = {};
  let count = 0;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const mod = name.slice(0, -'.json'.length);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch (e) {
      console.error(`[跳过] ${name} 解析失败: ${e.message}`);
      continue;
    }
    if (data && typeof data === 'object' && Object.keys(data).length) {
      bundle[mod] = data;
      count++;
    }
  }
  if (!count) throw new Error(`${dir} 下没有可用的翻译文件`);
  return { bundle, count, embedded: false, dir };
}

// ---------- 跨平台定位 Postman resources 目录 ----------
function cmpVer(a, b) {
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] - b[i]; }
  return 0;
}
function findLatestAppVersion(postmanDir) {
  if (!isDir(postmanDir)) return null;
  let best = null;
  for (const name of fs.readdirSync(postmanDir)) {
    const m = /^app-(\d+)\.(\d+)\.(\d+)/.exec(name);
    if (m && isDir(path.join(postmanDir, name))) {
      const v = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (best === null || cmpVer(v, best.v) > 0) best = { v, name };
    }
  }
  return best ? best.name : null;
}

// 返回候选 resources 目录列表（按优先级），调用方挑第一个含 app.asar / 备份的。
function candidateResourceDirs(opts) {
  if (opts.resources) return [expandHome(opts.resources)];

  const home = os.homedir();
  if (process.platform === 'win32') {
    const baseDir = expandHome(opts.postmanDir) || path.join(process.env.LOCALAPPDATA || '', 'Postman');
    const appName = opts.appVersion ? `app-${opts.appVersion}` : findLatestAppVersion(baseDir);
    return appName ? [path.join(baseDir, appName, 'resources')] : [];
  }

  if (process.platform === 'darwin') {
    const bases = opts.postmanDir
      ? [expandHome(opts.postmanDir)]
      : ['/Applications/Postman.app', path.join(home, 'Applications/Postman.app')];
    return bases.map((b) => (path.basename(b) === 'Resources' ? b : path.join(b, 'Contents', 'Resources')));
  }

  // linux 及其它
  const bases = opts.postmanDir
    ? [expandHome(opts.postmanDir)]
    : [
        '/opt/Postman/app/resources',
        '/usr/share/postman/resources',
        '/usr/lib/postman/resources',
        path.join(home, '.local/share/Postman/app/resources'),
        path.join(home, 'Postman/app/resources'),
        '/snap/postman/current/usr/share/postman/resources',
      ];
  // 对每个 base 同时尝试它本身、它的 resources / app/resources 子目录
  const out = [];
  for (const b of bases) {
    out.push(b, path.join(b, 'resources'), path.join(b, 'app', 'resources'));
  }
  return out;
}

// 把一个 resources 目录归类成注入目标：
//   - 'asar' 型：目录里有 app.asar（或其备份）——走解包/打包流程；
//   - 'dir'  型：没有 app.asar，但有未打包的 app/ 目录（Electron 退而加载 resources/app/）——直接改文件。
// app.asar 与 app/ 同时存在时 Electron 优先用 asar，故先判 asar。
function classifyResourceDir(dir) {
  const asar = path.join(dir, 'app.asar');
  const bak = asar + BAK_SUFFIX;
  if (isFile(asar) || isFile(bak)) {
    return { resourcesDir: dir, kind: 'asar', asar, bak };
  }
  const appDir = path.join(dir, 'app');
  const preload = path.join(appDir, 'preload_desktop.js');
  if (isFile(preload) || isFile(preload + BAK_SUFFIX)) {
    return { resourcesDir: dir, kind: 'dir', appDir };
  }
  return null;
}

function resolveTarget(opts) {
  const cands = candidateResourceDirs(opts);
  for (const dir of cands) {
    const t = classifyResourceDir(dir);
    if (t) return t;
  }
  const looked = cands.length ? cands.map((c) => '  - ' + c).join('\n') : '  （无候选，未找到安装）';
  throw new Error(
    `找不到 Postman 的 app.asar 或未打包的 app/ 目录。已尝试:\n${looked}\n` +
    `请用 --resources <含 app.asar 或 app/ 的目录> 或 --postman-dir <安装根目录> 指定。`
  );
}

// ---------- 注入 / 还原 ----------
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripBlock(text) {
  const re = new RegExp(escapeRe(MARK_START) + '[\\s\\S]*?' + escapeRe(MARK_END) + '\\n?', 'g');
  return text.replace(re, '');
}

async function patch(target, lang) {
  return target.kind === 'asar' ? patchAsar(target, lang) : patchDir(target, lang);
}

async function patchAsar(target, lang) {
  const { resourcesDir, asar, bak } = target;
  if (!isFile(asar) && !isFile(bak)) throw new Error(`找不到 app.asar: ${resourcesDir}`);

  // 提前解析钩子源码（二进制内嵌 / 源码同目录），缺失则在改动任何文件前就失败
  const hook = hookSource();
  const spHook = scratchpadHookSource();
  const spDict = loadScratchpadDict();
  const mainHook = mainHookSource();
  const mainDict = loadMainDict();

  // 0) 从 locales/<lang>/ 构建注入数据（二进制无 locales 时用内嵌数据）
  const { bundle, count, embedded } = buildBundle(lang);
  console.log(`[构建] ${embedded ? '内嵌数据' : 'locales/' + lang + '/'} -> ${DATA_NAME}（${count} 模块）`);

  // 1) 确保有 pristine 备份，且始终从备份打补丁
  if (!isFile(bak)) {
    fs.copyFileSync(asar, bak);
    console.log(`[备份] app.asar -> ${path.basename(bak)}`);
  } else {
    console.log(`[备份] 已存在，使用 ${path.basename(bak)} 作为打补丁源`);
  }

  // 2) 从备份解包到临时目录
  const staging = path.join(resourcesDir, 'app_pm_chinese_build');
  if (isDir(staging)) fs.rmSync(staging, { recursive: true, force: true });
  console.log(`[解包] ${path.basename(bak)} -> 临时目录`);
  asarExtract(bak, staging);

  // 3) 注入 preload + 放入钩子与数据（钩子/数据须与 preload 同目录，
  //    因为注入行 require('./pm-chinese.js') 与钩子内 __dirname 都相对 preload 所在目录解析）
  const preload = findPreloadIn(staging);
  if (!preload) {
    throw new Error(`解包后找不到渲染进程 preload（找过：${PRELOAD_CANDIDATES.join('、')}）`);
  }
  const preloadDir = path.dirname(preload);
  const preloadRel = path.relative(staging, preload).replace(/\\/g, '/');
  let content = stripBlock(fs.readFileSync(preload, 'utf8'));
  content = content.replace(/\n+$/, '') + '\n' + INJECT_BLOCK;
  fs.writeFileSync(preload, content, 'utf8');
  console.log(`[注入] ${preloadRel} <- require('./pm-chinese.js')`);
  fs.writeFileSync(path.join(preloadDir, 'pm-chinese.js'), hook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, DATA_NAME), JSON.stringify(bundle), 'utf8');
  console.log(`[写入] pm-chinese.js + ${DATA_NAME}`);
  fs.writeFileSync(path.join(preloadDir, SCRATCH_HOOK_NAME), spHook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, SCRATCH_DATA_NAME), JSON.stringify(spDict.dict), 'utf8');
  console.log(`[写入] ${SCRATCH_HOOK_NAME} + ${SCRATCH_DATA_NAME}（${Object.keys(spDict.dict).length} 条）`);

  // 3.5) 主进程入口注入原生菜单钩子（钩子/词典与 main.js 同目录）
  const stagedEntry = path.join(staging, MAIN_ENTRY);
  if (!isFile(stagedEntry)) throw new Error(`解包后找不到主进程入口 ${MAIN_ENTRY}`);
  writeMainHook(staging, mainHook, mainDict, fs.readFileSync(stagedEntry, 'utf8'));

  // 4) 打包回 app.asar
  console.log('[打包] 临时目录 -> app.asar');
  await asarPack(staging, asar);
  fs.rmSync(staging, { recursive: true, force: true });
  console.log('\n[成功] 已重打包 app.asar。完全退出并重启 Postman；');
  console.log('       界面出现中文即生效。');
}

// 未打包（resources/app/）型：没有 asar 可解包/打包，直接改目录里的文件。
// 只改 preload_desktop.js（备份为 .bak，始终从备份打补丁以幂等），并放入钩子与数据。
async function patchDir(target, lang) {
  const { appDir } = target;
  const preload = resolveDirPreload(appDir);
  if (!preload) throw new Error(`找不到渲染进程 preload（找过：${PRELOAD_CANDIDATES.join('、')}）: ${appDir}`);
  const bak = preload + BAK_SUFFIX;
  const preloadDir = path.dirname(preload);
  const preloadRel = path.relative(appDir, preload).replace(/\\/g, '/');

  // 提前解析钩子源码，缺失则在改动任何文件前就失败
  const hook = hookSource();
  const spHook = scratchpadHookSource();
  const spDict = loadScratchpadDict();
  const mainHook = mainHookSource();
  const mainDict = loadMainDict();

  // 0) 构建注入数据
  const { bundle, count, embedded } = buildBundle(lang);
  console.log(`[构建] ${embedded ? '内嵌数据' : 'locales/' + lang + '/'} -> ${DATA_NAME}（${count} 模块）`);

  // 1) 确保有 pristine 备份（剥掉可能已存在的注入块，保证备份干净），且始终从备份打补丁
  if (!isFile(bak)) {
    if (!isFile(preload)) throw new Error(`找不到 ${preloadRel}: ${appDir}`);
    fs.writeFileSync(bak, stripBlock(fs.readFileSync(preload, 'utf8')), 'utf8');
    console.log(`[备份] ${preloadRel} -> ${path.basename(bak)}`);
  } else {
    console.log(`[备份] 已存在，使用 ${path.basename(bak)} 作为打补丁源`);
  }

  // 2) 从备份注入到 preload
  let content = stripBlock(fs.readFileSync(bak, 'utf8'));
  content = content.replace(/\n+$/, '') + '\n' + INJECT_BLOCK;
  fs.writeFileSync(preload, content, 'utf8');
  console.log(`[注入] ${preloadRel} <- require('./pm-chinese.js')`);

  // 3) 放入钩子与数据（与 preload 同目录，因 require('./pm-chinese.js') 与 __dirname 都相对 preload 解析）
  fs.writeFileSync(path.join(preloadDir, 'pm-chinese.js'), hook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, DATA_NAME), JSON.stringify(bundle), 'utf8');
  console.log(`[写入] pm-chinese.js + ${DATA_NAME}`);
  fs.writeFileSync(path.join(preloadDir, SCRATCH_HOOK_NAME), spHook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, SCRATCH_DATA_NAME), JSON.stringify(spDict.dict), 'utf8');
  console.log(`[写入] ${SCRATCH_HOOK_NAME} + ${SCRATCH_DATA_NAME}（${Object.keys(spDict.dict).length} 条）`);

  // 4) 主进程入口：同样备份为 main.js.bak 并始终从备份注入
  const entry = path.join(appDir, MAIN_ENTRY);
  const entryBak = entry + BAK_SUFFIX;
  if (!isFile(entryBak)) {
    if (!isFile(entry)) throw new Error(`找不到主进程入口 ${MAIN_ENTRY}: ${appDir}`);
    fs.writeFileSync(entryBak, stripBlock(fs.readFileSync(entry, 'utf8')), 'utf8');
    console.log(`[备份] ${MAIN_ENTRY} -> ${path.basename(entryBak)}`);
  }
  writeMainHook(appDir, mainHook, mainDict, fs.readFileSync(entryBak, 'utf8'));

  console.log('\n[成功] 已注入未打包的 app/ 目录。完全退出并重启 Postman；');
  console.log('       界面出现中文即生效。');
}

function restore(target) {
  return target.kind === 'asar' ? restoreAsar(target) : restoreDir(target);
}

function restoreAsar(target) {
  const { asar, bak } = target;
  if (!isFile(bak)) {
    console.log('[还原] 找不到备份，无需还原');
    return;
  }
  fs.copyFileSync(bak, asar);
  console.log(`[还原] 已用 ${path.basename(bak)} 覆盖回 app.asar`);
  console.log('       （备份保留；如需彻底清理可手动删除）');
}

function restoreDir(target) {
  const { appDir } = target;
  const preload = resolveDirPreload(appDir) || path.join(appDir, PRELOAD_CANDIDATES[0]);
  const preloadDir = path.dirname(preload);
  const preloadRel = path.relative(appDir, preload).replace(/\\/g, '/');
  const bak = preload + BAK_SUFFIX;
  let did = false;
  if (isFile(bak)) {
    fs.copyFileSync(bak, preload);
    console.log(`[还原] 已用 ${path.basename(bak)} 覆盖回 ${preloadRel}`);
    did = true;
  } else if (isFile(preload)) {
    // 没备份则就地剥掉注入块
    const cleaned = stripBlock(fs.readFileSync(preload, 'utf8'));
    if (cleaned !== fs.readFileSync(preload, 'utf8')) {
      fs.writeFileSync(preload, cleaned, 'utf8');
      console.log(`[还原] 无备份，已就地移除 ${preloadRel} 中的注入块`);
      did = true;
    }
  }
  // 删除注入的钩子与数据文件（与 preload 同目录）
  for (const f of ['pm-chinese.js', DATA_NAME, SCRATCH_HOOK_NAME, SCRATCH_DATA_NAME]) {
    const p = path.join(preloadDir, f);
    if (isFile(p)) { fs.rmSync(p, { force: true }); console.log(`[还原] 删除 ${f}`); did = true; }
  }
  // 主进程入口：用 main.js.bak 覆盖回，并删除主进程钩子与词典
  const entry = path.join(appDir, MAIN_ENTRY);
  if (isFile(entry + BAK_SUFFIX)) {
    fs.copyFileSync(entry + BAK_SUFFIX, entry);
    console.log(`[还原] 已用 ${MAIN_ENTRY}${BAK_SUFFIX} 覆盖回 ${MAIN_ENTRY}`);
    did = true;
  } else if (isFile(entry)) {
    const raw = fs.readFileSync(entry, 'utf8');
    const cleaned = stripBlock(raw);
    if (cleaned !== raw) { fs.writeFileSync(entry, cleaned, 'utf8'); console.log(`[还原] 已移除 ${MAIN_ENTRY} 中的注入块`); did = true; }
  }
  for (const f of [MAIN_HOOK_NAME, MAIN_DATA_NAME]) {
    const p = path.join(appDir, f);
    if (isFile(p)) { fs.rmSync(p, { force: true }); console.log(`[还原] 删除 ${f}`); did = true; }
  }
  if (!did) console.log('[还原] 未发现注入痕迹，无需还原');
  else console.log('       （备份保留；如需彻底清理可手动删除）');
}

// 检查目标是否已被注入，打印结论（只读，不改动）
function status(target) {
  const { resourcesDir } = target;
  console.log(`  类型: ${target.kind === 'asar' ? 'app.asar（已打包）' : '未打包 app/ 目录'}`);
  return target.kind === 'asar' ? statusAsar(target) : statusDir(target);
}

function statusDir(target) {
  const { appDir } = target;
  const preload = resolveDirPreload(appDir) || path.join(appDir, PRELOAD_CANDIDATES[0]);
  const preloadDir = path.dirname(preload);
  const bak = preload + BAK_SUFFIX;
  const hookPath = path.join(preloadDir, 'pm-chinese.js');
  const dataPath = path.join(preloadDir, DATA_NAME);

  console.log(`  备份 ${path.basename(bak)}: ${isFile(bak) ? '有（注入过至少一次）' : '无'}`);

  const hasHook = isFile(hookPath);
  const hasData = isFile(dataPath);
  const hasScratch = isFile(path.join(preloadDir, SCRATCH_HOOK_NAME));
  let count = null, injected = false;
  if (hasData) {
    try { count = Object.keys(JSON.parse(fs.readFileSync(dataPath, 'utf8'))).length; } catch (e) { /* ignore */ }
  }
  try {
    injected = /require\((['"])\.\/pm-chinese\.js\1\)/.test(fs.readFileSync(preload, 'utf8'));
  } catch (e) { /* preload 缺失则视为未注入 */ }

  console.log(`  pm-chinese.js 在 app/ 内: ${hasHook ? '是' : '否'}`);
  console.log(`  pm-chinese-data.json 在 app/ 内: ${hasData ? '是' : '否'}${count != null ? `（${count} 模块）` : ''}`);
  console.log(`  Scratch Pad 钩子在 app/ 内: ${hasScratch ? '是' : '否'}`);
  let mainInjected = false;
  try { mainInjected = fs.readFileSync(path.join(appDir, MAIN_ENTRY), 'utf8').includes(`require('./${MAIN_HOOK_NAME}')`); } catch (e) { /* ignore */ }
  console.log(`  原生菜单钩子（${MAIN_ENTRY}）: ${mainInjected && isFile(path.join(appDir, MAIN_HOOK_NAME)) ? '已注入' : '未注入'}`);
  console.log(`  preload 注入行 require('./pm-chinese.js'): ${injected ? '有' : '无'}`);

  const ok = hasHook && hasData && injected;
  console.log(
    ok
      ? '\n[结论] 已注入 ✓　重启 Postman，界面应变中文；Console 会打印 [pm-chinese] 已注入'
      : '\n[结论] 未注入 ✗　运行（不带参数）即可注入：postman-chinese-injector'
  );
}

function statusAsar(target) {
  const { asar, bak } = target;
  if (!isFile(asar)) {
    console.log('  app.asar: 不存在');
    console.log('\n[结论] 未注入 ✗');
    return;
  }
  console.log(`  备份 ${path.basename(bak)}: ${isFile(bak) ? '有（注入过至少一次）' : '无'}`);

  let hasHook = false, hasData = false, injected = false, count = null, preloadRel = null;
  let hasScratch = false, hasMain = false;
  try {
    const files = asarList(asar);
    hasHook = files.some((f) => /(^|[\\/])pm-chinese\.js$/.test(f));
    hasData = files.some((f) => /(^|[\\/])pm-chinese-data\.json$/.test(f));
    hasScratch = files.some((f) => /(^|[\\/])pm-scratchpad-cn\.js$/.test(f));
    hasMain = files.some((f) => /^[\\/]?pm-main-cn\.js$/.test(f));
    preloadRel = findPreloadInAsar(files);
  } catch (e) {
    console.log('  无法读取 asar 内容:', e.message);
  }
  try {
    if (preloadRel) {
      injected = /require\((['"])\.\/pm-chinese\.js\1\)/.test(asarReadFile(asar, preloadRel));
    }
  } catch (e) { /* preload 缺失则视为未注入 */ }
  if (hasData) {
    try { count = Object.keys(JSON.parse(asarReadFile(asar, 'pm-chinese-data.json'))).length; } catch (e) { /* ignore */ }
  }

  console.log(`  pm-chinese.js 在 asar 内: ${hasHook ? '是' : '否'}`);
  console.log(`  pm-chinese-data.json 在 asar 内: ${hasData ? '是' : '否'}${count != null ? `（${count} 模块）` : ''}`);
  console.log(`  Scratch Pad 钩子在 asar 内: ${hasScratch ? '是' : '否'}`);
  let mainInjected = false;
  try {
    mainInjected = hasMain && asarReadFile(asar, MAIN_ENTRY).includes(`require('./${MAIN_HOOK_NAME}')`);
  } catch (e) { /* ignore */ }
  console.log(`  原生菜单钩子（${MAIN_ENTRY}）: ${mainInjected ? '已注入' : '未注入'}`);
  console.log(`  preload 注入行 require('./pm-chinese.js'): ${injected ? '有' : '无'}`);

  const ok = hasHook && hasData && injected;
  console.log(
    ok
      ? '\n[結論] 已注入 ✓　重啟 Postman，介面應變繁體中文；Console 會印出 [pm-chinese] 已注入'
      : '\n[結論] 未注入 ✗　執行（不帶參數）即可注入：postman-traditional-chinese-injector'
  );
}

// ---------- CLI ----------
function printHelp() {
  console.log(`postman-traditional-chinese-injector —— 把繁體中文注入 Postman 桌面端（跨平台）

用法:
  postman-traditional-chinese-injector [選項]   # 或 node postman-traditional-chinese-injector.js [選項]

選項:
  --status                  檢查目標是否已注入（唯讀，不改動），印出結論
  --restore                 還原注入（使用備份覆蓋回 app.asar / preload）
  --resources <dir>         直接指定含有 app.asar 或未打包 app/ 的目錄（跳過自動偵測）
  --postman-dir <dir>       指定 Postman 安裝根目錄
  --app-version <v>         Windows 多版本共存時指定 app-<version>（預設最新）
  -v, --version             顯示本工具版本
  -h, --help                顯示說明訊息

平台預設偵測位置:
  Windows  %LOCALAPPDATA%\\Postman\\app-<version>\\resources
  macOS    /Applications/Postman.app/Contents/Resources（及 ~/Applications）
  Linux    /opt/Postman/app/resources 等常見位置

注入/還原前請先完全結束 Postman。macOS / Linux 的系統級安裝可能需要 sudo。`);
}

function parseArgs(argv) {
  const opts = { postmanDir: null, resources: null, appVersion: null, restore: false, status: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--restore') opts.restore = true;
    else if (a === '--status') opts.status = true;
    else if (a === '--resources') opts.resources = argv[++i];
    else if (a === '--postman-dir') opts.postmanDir = argv[++i];
    else if (a === '--app-version') opts.appVersion = argv[++i];
    else if (a === '-v' || a === '--version') { console.log(toolVersion()); process.exit(0); }
    else if (a === '-h' || a === '--help') { printHelp(); process.exit(0); }
    else { console.error(`[錯誤] 未知參數: ${a}（用 --help 查看用法）`); process.exit(2); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const target = resolveTarget(opts);
  console.log(`[目標] ${target.resourcesDir}（${target.kind === 'asar' ? 'app.asar' : '未打包 app/ 目錄'}）`);
  if (opts.status) status(target);
  else if (opts.restore) restore(target);
  else await patch(target, DEFAULT_LANG);
}

// 導出供測試與別名引用（作為 CLI 運行時不受影響）
module.exports = { findPreloadIn, findPreloadInAsar, resolveDirPreload, PRELOAD_CANDIDATES, scratchpadHookSource, loadScratchpadDict, mainHookSource, loadMainDict, injectMainEntry, stripBlock, main };

if (require.main === module) {
  main().catch((e) => {
    console.error(`[錯誤] ${e.message}`);
    if (e && e.code === 'EACCES' && process.platform !== 'win32') {
      console.error('       權限不足——該目錄（如 /opt/Postman）通常屬 root，需要寫入權限。');
      console.error('       請在同一條命令前加 sudo 重試，並確保已完全結束 Postman。');
    }
    process.exit(1);
  });
}
