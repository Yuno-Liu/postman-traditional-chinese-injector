# Postman 繁體中文注入工具 · Postman Traditional Chinese Injector

[![Release](https://img.shields.io/github/v/release/Yuno-Liu/postman-traditional-chinese-injector?sort=semver)](../../releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blue)
[![Postman](https://img.shields.io/badge/Postman-10.x%20~%2012.x-orange)](#支援的-postman-版本)

把繁體中文介面注入 **Postman 桌面端**與**網頁版**，讓介面變為繁體中文（台灣標準詞彙）。譯文已全部預置、開箱即用。

- **桌面端** — Windows / macOS / Linux 的**單檔案可執行程式**（目標電腦無需安裝 Node），亦可用 Node 原始碼直接執行。
- **網頁版** — Chrome / Edge 的 **Manifest V3 瀏覽器擴充功能**（`go.postman.co` 等）。

> **支援版本**：桌面端 Postman **10.x ～ 12.x**（以最新正式版為主要測試目標），網頁版隨官方介面滾動更新。詳見 [支援的 Postman 版本](#支援的-postman-版本)。

> [!WARNING]
> **非官方專案**：與 Postman, Inc. 無任何關聯，未獲授權或背書；"Postman" 是其商標。
> 本倉庫不含亦不分發 Postman 的任何原始碼 / 二進位程式 / 原始語言包。僅供個人本地使用，自負風險。
> 詳見文末 [法律聲明](#法律聲明--disclaimer)。

**目錄**

[快速開始](#快速開始) · [支援的 Postman 版本](#支援的-postman-版本) · [下載 Postman（各版本）](#下載-postman各版本) · [關閉自動更新](#關閉自動更新保持中文化不被覆蓋) · [運作原理](#運作原理) · [桌面端](#桌面端) · [報毒說明](#防毒軟體報毒誤報說明) · [網頁版](#網頁版瀏覽器擴充功能) · [翻譯數據](#翻譯數據) · [常見問題](#常見問題) · [交流反饋](#交流--反饋) · [法律聲明](#法律聲明--disclaimer)

---

## 快速開始

**桌面端**

1. 前往 [Release](../../releases) 下載對應平台壓縮包並解壓縮；
2. **完全結束 Postman**；
3. 執行可執行程式（自動偵測安裝路徑）；
4. 重啟 Postman，介面即變為繁體中文。

> 移除中文化：執行時加上 `--restore`。

**網頁版**

1. 前往 [Release](../../releases) 下載 `postman-traditional-chinese-injector-extension.zip` 並解壓縮；
2. Chrome / Edge 開啟 `chrome://extensions` → 開啟「開發者模式」；
3. 點選「載入已解壓的擴充功能」→ 選擇該目錄；
4. 重新整理 Postman 網頁版，介面即變為繁體中文。

以下為完整說明。

---

## 支援的 Postman 版本

中文化對桌面端的適配依賴兩點，滿足即可注入：

- 主視窗 preload 腳本可注入 —— 新版為根目錄 `preload_desktop.js`，舊版（10.24）為 `preload/desktop/index.js`，腳本自動判別；
- 介面語言包走 `.../_ar-assets/locales/<lang>/<module>-<hash>.json` 遠端載入 —— 執行階段掛鉤攔截這些回應進行合併替換。

| 項目 | 說明 |
|------|------|
| **已適配範圍** | Postman 桌面端 **10.x ～ 12.x**（目前最新），以最新正式版為主要測試目標 |
| **網頁版** | `go.postman.co` 等，隨官方介面滾動更新，無版本號限制 |
| **覆蓋度** | 譯文鍵值對齊「當前 Postman 介面文案」，越接近最新版覆蓋越完整；過舊版本介面文案不同，可能出現部分未翻譯 |
| **不支援** | 更早、不走 `_ar-assets` 語言包機制的舊架構 |

> Postman 會**自動更新**，更新後會產生新的版本目錄（不含中文化補丁）→ 介面變回英文，重新執行一次注入即可。若想固定版本，請見下方[關閉自動更新](#關閉自動更新保持中文化不被覆蓋)。

---

## 下載 Postman（各版本）

本工具**僅注入**已安裝的 Postman，不包含 Postman 本體。以下為官方官方連結，請按需自行下載。

**官方入口**

- 官方下載頁：<https://www.postman.com/downloads/>
- **發布說明 / 更新日誌**：<https://www.postman.com/release-notes/postman-app/>

**最新版載點**（`https://dl.pstmn.io/download/latest/<平台標識>`）

| 平台 | 載點 |
|------|------|
| Windows x64 | <https://dl.pstmn.io/download/latest/win64> |
| Windows arm64 | <https://dl.pstmn.io/download/latest/windows_arm64> |
| macOS Intel | <https://dl.pstmn.io/download/latest/osx_64> |
| macOS Apple Silicon | <https://dl.pstmn.io/download/latest/osx_arm64> |
| Linux x64 | <https://dl.pstmn.io/download/latest/linux64> |
| Linux arm64 | <https://dl.pstmn.io/download/latest/linux_arm64> |

**指定版本載點**

將版本號與平台標識填入模板即可下載歷史版本：

```
https://dl.pstmn.io/download/version/<版本號>/<平台標識>
```

範例（下載 11.21.0 的 Windows x64）：

```
https://dl.pstmn.io/download/version/11.21.0/win64
```

平台標識：`win64` · `windows_arm64` · `osx_64` · `osx_arm64` · `linux64` · `linux_arm64`
（`win64` 亦可寫為 `windows_64`，`windows_arm64` 亦可寫為 `win_arm64`，互為別名。）版本號請見上方發布說明頁。

> 註：**Windows arm64** 原生套件較新才提供，使用**指定版本**回溯舊版時該架構可能回傳 404（`latest` 正常）。遇到此情況請改用 `win64`（x64，可在 arm64 上相容執行），或選擇更新的版本。

---

## 關閉自動更新（保持中文化不被覆蓋）

Postman 會**自動更新**，升級後會產生新的版本目錄（不含補丁）→ 介面變回英文。若想固定在某個版本、避免中文化被覆蓋，請參閱獨立文件：

**👉 [關閉 Postman 自動更新](docs/disable-auto-update.md)**

內含兩種方法：**A（Windows 推薦）停用 Squirrel 更新器 `Update.exe`**（重新命名即可，不影響啟動與下載，可一鍵還原）與 **B（全平台通用）hosts 屏蔽更新伺服器**（徹底但會連手動下載一併阻擋）。

---

## 運作原理

Postman 主視窗 `webPreferences` 為 `contextIsolation=false` + `nodeIntegration=true`，Electron 的 preload 腳本與頁面共享同一個 main world 且先於頁面腳本執行。執行階段掛鉤 `pm-chinese.js` 包裝了 `window.fetch` / `XMLHttpRequest`，攔截 Postman 請求的英文（`en-US` / `ja`）語言包回應，將對應模組的繁體中文 deep-merge 合併進去再回傳給頁面。

因為修改的是 fetch 回傳前的回應本體，無論數據來自網路還是 Service Worker 快取皆能生效。兩種載入方式：

- **桌面端** — Electron 資源解析時 `app.asar` 存在則優先讀取、否則退而載入未打包的 `resources/app/` 目錄。CLI 自動判別並支援兩種型態：
  - **`app.asar` 型** — 備份原始 asar、從備份打補丁、再打包回去；
  - **未打包 `app/` 型**（沒有 `app.asar`，只有 `resources/app/`）— 直接備份並修改 `app/preload_desktop.js`，將掛鉤與數據寫入同目錄，無需解包 / 打包。

  兩種型態皆為冪等，且可透過 `--restore` 還原。
- **網頁版** — 瀏覽器擴充功能以 `world:MAIN` + `run_at:document_start` 注入同一段掛鉤，在頁面腳本之前生效。

掛鉤 `pm-chinese.js` 是**唯一核心來源**，兩端共用：網頁版從全域 `window.__PM_I18N__` 取得數據，桌面端則從 asar 內同目錄的 `pm-chinese-data.json` 以 `fs` 讀取。

### 登出態 Scratch Pad（本地介面）繁體化

Postman **登入態**主介面是遠端網頁，走上述的語言包攔截即可完成繁體化；但**登出態的 Scratch Pad** 是本地打包的介面，文案為**硬編碼英文**、不發送語言包請求，攔截 fetch 對其無效。

為此，工具在**同一次注入**中額外置入第二個執行階段掛鉤 `pm-scratchpad-cn.js`：

- 僅在 Scratch Pad 視窗（`file://…scratchpad`）啟用；
- 使用 `MutationObserver` 遍歷 DOM，將**與內建詞典完全精準相符**的純文字 / 屬性替換為繁體中文；
- **主動跳過輸入框與程式碼編輯器**（`input` / `textarea` / `contenteditable` / CodeMirror / Monaco）子樹，絕不竄改您輸入的請求內容、URL 等資料。

### 原生選單繁體化

左上角原生選單（檔案 / 編輯 / 檢視 / 幫助）、macOS 應用程式選單、Dock 選單與部分確認對話框是**主行程**以 Electron 原生 API 繪製的，既不經 DOM 亦不請求語言包。為此，注入時會在主行程入口 `main.js` 最前方插入第三個掛鉤 `pm-main-cn.js`：包裝 `Menu.buildFromTemplate` 與 `dialog.showMessageBox`，依照詞典 `locales/main/zh-CN.json` 將選單 / 對話框文案整串替換為繁體中文（支援 `About {{appName}}` 這類佔位符）。

單一指令即可自動完成全部掛鉤注入，自動適配版本與登入狀態，無需手動介入。

---

## 目錄結構

```
postman-traditional-chinese-injector/
├── postman-traditional-chinese-injector.js # 桌面端注入 CLI：建置 / 備份 / 解包 / 注入 / 打包 app.asar，含 --restore
├── postman-chinese-injector.js             # 向下相容入口
├── pm-chinese.js                           # 執行階段掛鉤（桌面端與瀏覽器擴充功能共用的唯一核心）
├── pm-scratchpad-cn.js                     # 第二個掛鉤：登出態 Scratch Pad 的 DOM 詞典替換（僅桌面端）
├── pm-main-cn.js                           # 第三個掛鉤：主行程原生選單 / 對話框中文化（僅桌面端）
├── locales/
│   ├── zh-CN/                              # 語言包翻譯源（已全量轉為繁體中文）：每個模組一個 json，可單獨編輯
│   │   ├── api-client-core.json
│   │   └── ...
│   ├── scratchpad/
│   │   └── zh-CN.json                      # Scratch Pad DOM 詞典（英文整串 → 繁體中文）
│   └── main/
│       └── zh-CN.json                      # 主行程原生選單 / 對話框詞典（英文整串 → 繁體中文）
├── scripts/
│   ├── convert-to-traditional.js           # 一鍵將語言包與詞典轉換為繁體中文工具
│   ├── build-data.js                       # 合併 locales/ 並產生可嵌入二進位程式的快照（見下）
│   ├── build-scratchpad-dict.js            # 建置 / 維護 Scratch Pad 詞典 locales/scratchpad/zh-CN.json
│   ├── build-extension.js                  # 打包 Chrome/Edge (MV3) 瀏覽器擴充功能，供 Postman 網頁版使用
│   ├── build-bin.js                        # 使用 bun --compile 編譯單檔案二進位執行檔（復用本地快取的執行環境）
│   ├── build-bin-legacy.js                 # 使用 pkg（Node 執行環境）打包舊版 Windows 二進位執行檔
│   ├── fetch-runtimes.js                   # 預先拉取各平台 bun 執行環境至本地快取，避免交叉編譯時線上重複下載
│   └── compress-dist.js                    # 將 dist/ 的二進位程式平行壓縮為發行包（zip / tar.xz）
├── .github/workflows/                      # CI：建立 tag 自動交叉編譯、平行壓縮並發布 Release
└── package.json                            # bin 命令 postman-traditional-chinese-injector、建置腳本、依賴 @electron/asar
```

> `build-data.js` 會產生 6 份供 `bun --compile` 靜態內嵌的快照：`pm-chinese-data.json`（語言包合併數據）、`pm-chinese-src.json`（`pm-chinese.js` 原始碼）、`pm-scratchpad-data.json`（Scratch Pad 詞典）、`pm-scratchpad-src.json`（`pm-scratchpad-cn.js` 原始碼）、`pm-main-data.json`（主行程菜單詞典）、`pm-main-src.json`（`pm-main-cn.js` 原始碼）。它們皆為建置產物，平時使用 `node postman-traditional-chinese-injector.js` 直接注入時不需要，該路徑直接讀取 `locales/` 與本地掛鉤。

---

## 桌面端

### 方式一：下載二進位執行檔（推薦，目標電腦無需 Node）

從 Release 下載對應平台的壓縮包，解壓縮後獲得單檔案（可自由重新命名）：

| 平台 | 下載檔案 | 解壓縮後 |
|------|----------|--------|
| Windows x64 | `postman-traditional-chinese-injector-win-x64.zip` | `postman-traditional-chinese-injector-win-x64.exe` |
| Windows x64（舊版系統） | `postman-traditional-chinese-injector-win-x64-legacy.zip` | `postman-traditional-chinese-injector-win-x64-legacy.exe` |
| Linux x64 / arm64 | `postman-traditional-chinese-injector-linux-x64.tar.xz` / `-arm64.tar.xz` | `postman-traditional-chinese-injector-linux-x64` / `-arm64` |
| macOS x64 / arm64（Apple Silicon） | `postman-traditional-chinese-injector-macos-x64.tar.xz` / `-arm64.tar.xz` | `postman-traditional-chinese-injector-macos-x64` / `-arm64` |

> 壓縮僅為減少下載體積（約降為原來的 1/4），解壓縮後仍以原大小執行。
> Windows 雙擊 `.zip` 即可解壓縮；Linux / macOS：`tar -xf postman-traditional-chinese-injector-*.tar.xz`。

> [!NOTE]
> **防毒軟體將 exe 誤報為木馬？** 這是單檔案打包工具（bun / pkg）的常見現象，屬於啟發式誤判。核實方法（SHA256 校驗、建置來源證明、VirusTotal）與替代方案請見 [防毒軟體報毒（誤報）說明](#防毒軟體報毒誤報說明)。

**作業系統要求**

- 預設二進位程式由 Bun 編譯：**Windows 需 10 1809+ / Server 2019+**，macOS 需 11+，Linux 需較新的 glibc。
- 在更舊的 Windows（如 Server 2012 / Win7）上會提示 `無法定位程序輸入點 ClosePseudoConsole …`（缺少 ConPTY API）—— 此為 Bun 執行環境的系統底線。
- 舊版 Windows 請改用**舊系統版**二進位程式（`*-win-x64-legacy.exe`，使用 Node 執行環境打包，詳見下方[舊版系統](#舊版系統windows-81--server-2012-r2)），或採用[方式二：Node 原始碼執行](#方式二node-原始碼執行開發--修改譯文)。

**注入步驟**

```bash
# 1. 完全結束 Postman
# 2. 執行注入（自動偵測當前平台的 Postman 安裝目錄）
./postman-traditional-chinese-injector-win-x64.exe          # Windows
./postman-traditional-chinese-injector-linux-x64            # Linux/macOS 先 chmod +x（tar.xz 解壓後通常已保留執行權限）

# 3. 重啟 Postman，介面顯示繁體中文即成功
```

二進位程式已內嵌全部繁體中文譯文與 `@electron/asar`，無需聯網、無需安裝 Node。

> 譯文有更新但不想更換二進位程式？將 `locales/<lang>/` 資料夾放置於**執行檔同目錄**即可覆蓋內嵌數據。

> [!NOTE]
> **macOS 使用者**：Apple Silicon 首次執行可能提示 `zsh: killed` /「已損毀」，注入時可能提示 `EPERM`——均非檔案損毀，處理方式請見 **👉 [macOS 首次執行 / 注入排障](docs/macos-troubleshooting.md)**。

### 方式二：Node 原始碼執行（開發 / 修改譯文）

需要 Node 22.12+（打包 asar 使用 `@electron/asar` v4；更舊的 Node 請將依賴與 `postman-traditional-chinese-injector.js` 中的 `ASAR_PKG` 改回 `@electron/asar@3`，可相容 Node 12+）。無需 Python。

```bash
npm install                                 # 安裝依賴（未安裝時會自動回退 npx，速度較慢）
node postman-traditional-chinese-injector.js  # 注入；或 npm install -g . 後使用 postman-traditional-chinese-injector 指令
```

### CLI 選項

以下以 `node postman-traditional-chinese-injector.js` 為例；使用二進位程式時替換為該執行檔檔名即可（如 `./postman-traditional-chinese-injector-win-x64.exe`）。

| 選項 | 作用 |
|------|------|
| `--status` | 唯讀檢查是否已注入並印出結論（不修改任何檔案） |
| `--restore` | 還原（使用備份覆蓋回 `app.asar` / preload） |
| `--resources <dir>` | 直接指定含有 `app.asar` 或未打包 `app/` 的目錄（跳過自動偵測） |
| `--postman-dir <dir>` | 指定 Postman 安裝根目錄 |
| `--app-version 12.16.1` | Windows 多版本共存時指定 `app-<version>`（預設選擇最新版） |
| `-v`, `--version` | 顯示本工具版本 |
| `-h`, `--help` | 顯示說明訊息 |

#### 各平台預設偵測路徑

| 平台 | 路徑 |
|------|------|
| Windows | `%LOCALAPPDATA%\Postman\app-<version>\resources`（自動選取最新版本） |
| macOS | `/Applications/Postman.app/Contents/Resources`（含 `~/Applications`） |
| Linux | `/opt/Postman/app/resources`、`/usr/share/postman/resources`、`~/.local/share/Postman/app/resources` 等常見路徑 |

> 若無法自動偵測，請使用 `--resources <含 app.asar 或 app/ 的目錄>` 或 `--postman-dir <安裝根目錄>` 手動指定。
> macOS / Linux 系統層級的安裝目錄可能需要 `sudo` 權限方可寫入。

##### 驗證注入是否成功

**① 靜態檢查（無需啟動 Postman）** —— `--status` 唯讀檢查目標 asar 並輸出結論：

```bash
node postman-traditional-chinese-injector.js --status      # 或 ./postman-traditional-chinese-injector-win-x64.exe --status
```

```
  類型: app.asar（已打包）
  備份 app.asar.bak: 有（已注入過至少一次）
  pm-chinese.js 在 asar 內: 是
  pm-chinese-data.json 在 asar 內: 是（<N> 模組）
  Scratch Pad 掛鉤在 asar 內: 是
  preload 注入行 require('./pm-chinese.js'): 有

[結論] 已注入 ✓　重啟 Postman，介面應變為中文；Console 會輸出 [pm-chinese] 已注入
```

**② 觀察介面** —— 結束並重啟 Postman，選單與按鈕呈現繁體中文即代表成功。

**③ 檢查執行階段日誌（最確切）** —— 於 Postman 選單點選 `View → Developer → Show DevTools (Current View)`（快速鍵 `Ctrl+Alt+I`）→ 切換至 Console，應有：

```
[pm-chinese] 已注入，語言: zh-CN | 攔截: en-US,ja | 模組數: <N>
```

### 自行編譯二進位執行檔

需要安裝 [Bun](https://bun.sh)（用於 `--compile` 交叉編譯）：

```bash
npm install            # 或 bun install，準備 @electron/asar
npm run build          # 產生嵌入數據 + 交叉編譯全部 5 個平台至 dist/
# 或單一平台：
npm run build:win      # build:linux / build:linux-arm64 / build:mac / build:mac-arm64

npm run build:compress # 選用：將 dist/ 的二進位程式平行壓縮為發行包（Windows→zip，其餘→tar.xz）
```

#### 舊版系統（Windows 8.1 / Server 2012 R2+）

Bun 產物需要 Win10 1809+；更舊的 Windows 需改用 **Node 執行環境**打包（`pkg`），產物**不靜態連結 ConPTY**，可在舊系統上執行：

```bash
npm run build:win-legacy        # → dist/postman-traditional-chinese-injector-win-x64-legacy.exe（預設 node16 基底）
# 目標更舊（Server 2012 非 R2 / Win7）可嘗試更舊基底：
node scripts/build-bin-legacy.js node12-win-x64
```

---

## 防毒軟體報毒（誤報）說明

部分防毒軟體（Windows Defender 等）或 VirusTotal 上的少數引擎可能會將本工具的 `.exe` 標記為啟發式威脅。這是**誤報**，原因在於打包方式與本工具的運作性質：

1. **單檔案執行檔的結構類似加殼程式**——預設二進位程式由 `bun --compile` 產生（舊版由 `pkg` 產生），結構為執行環境加上打包的腳本酬載。此類打包工具的產物容易被機器學習模型誤判，為業界常見問題。
2. **行為特徵天然類似「打補丁程式」**——本工具需讀寫已安裝的 Postman 之 `resources/app.asar`（備份 → 解包 → 修改 preload → 重新打包）。「修改另一個已安裝應用程式之檔案」的行為特徵容易觸發防毒機制。
3. **未進行商業程式碼簽署**——Windows SmartScreen 採用檔案信譽機制，未簽署的新 exe 會顯示為「未知的發行者」。

### 如何自行核實

- **核對雜湊校驗碼**：每個 Release 均附帶 `SHA256SUMS.txt`，可確認下載之檔案與 CI 建置產物一致。

  ```powershell
  # Windows PowerShell
  Get-FileHash .\postman-traditional-chinese-injector-win-x64.zip -Algorithm SHA256
  ```

  ```bash
  # macOS / Linux
  shasum -a 256 postman-traditional-chinese-injector-*.tar.xz
  ```

- **驗證建置來源證明**：所有二進位發行包**均由 GitHub Actions 從公開原始碼建置**（見 [`.github/workflows/release.yml`](.github/workflows/release.yml)），並具備 [建置來源證明（build provenance）](https://docs.github.com/actions/security-guides/using-artifact-attestations)：

  ```bash
  gh attestation verify postman-traditional-chinese-injector-win-x64.zip --repo Yuno-Liu/postman-traditional-chinese-injector
  ```

- **上傳至 [VirusTotal](https://www.virustotal.com/) 複查**：少數引擎標紅、主流引擎全綠，為典型的啟發式誤報特徵。

### 不想處理誤報：直接以原始碼執行

原始碼為純 JavaScript，不經過任何二進位打包器，因此不會觸發此類誤報：

```bash
git clone https://github.com/Yuno-Liu/postman-traditional-chinese-injector.git
cd postman-traditional-chinese-injector
npm install
node postman-traditional-chinese-injector.js
```

---

## 網頁版：瀏覽器擴充功能

為 **Postman 網頁版**（`go.postman.co` 等）注入繁體中文，無需更動 app.asar。產出的是 Chrome / Edge 的 Manifest V3 擴充功能：

```bash
npm run build:ext      # 或 node scripts/build-extension.js
```

產物位於 `dist/extension/`（同時產生 `dist/postman-traditional-chinese-injector-extension.zip`）：

```
dist/extension/
├── manifest.json      # MV3，內容腳本 world:MAIN + run_at:document_start
├── pm-i18n-data.js    # window.__PM_I18N__ = { <模組>: {…繁體中文…} }
└── pm-chinese.js      # 與桌面端共用的同一份執行階段掛鉤
```

安裝方式

1. Chrome / Edge 開啟 `chrome://extensions` → 開啟「開發者模式」；
2. 點選「載入已解壓的擴充功能」→ 選擇 `dist/extension/` 目錄；
3. 重新整理 Postman 網頁版，介面即變為繁體中文。

開啟 DevTools Console 應可看到 `[pm-chinese] 已注入…模組數: <N>`。

---

## 翻譯數據

翻譯來源為 `locales/<lang>/` 下**每個模組一個 JSON**，檔名即為模組名，內容為與 Postman 介面語言包同構的繁體中文鍵值樹：

```
locales/zh-CN/
├── api-client-core.json
├── app-header.json
└── ...（共 165 個模組）
```

注入 / 打包時將這些檔案合併為一個扁平 bundle（`{ "<module>": {…} }`），執行階段由 `pm-chinese.js` 讀取並合併。

**修改譯文**：直接編輯對應的 json 檔案，重新執行注入（桌面端）或執行 `npm run build:ext`（網頁版）即可。

- 登出態 Scratch Pad 的 DOM 詞典放置於 `locales/scratchpad/zh-CN.json`（英文整串 → 繁體中文）。
- 主行程原生選單 / 對話框詞典放置於 `locales/main/zh-CN.json`（英文整串 → 繁體中文）。
- 亦可執行 `npm run convert:tw` 重新執行整套繁體中文在地化轉換腳本。

---

## 常見問題

**macOS（M 晶片）執行提示 `zsh: killed` / 「已損毀，無法開啟」/ 注入時 `EPERM`**
分別對應未簽章、下載隔離與 macOS 13+ 的「應用程式管理」保護。處理步驟請見 [docs/macos-troubleshooting.md](docs/macos-troubleshooting.md)。

**防毒軟體報毒 / SmartScreen 攔截**
此為單檔案打包工具（bun / pkg）之啟發式誤判，非真實威脅。核實方法與替代方案請見 [防毒軟體報毒（誤報）說明](#防毒軟體報毒誤報說明)。

**介面仍顯示英文 / Console 未印出 `[pm-chinese] 已注入`**
① 注入前是否已完全結束 Postman；② 是否注入至正在執行的版本目錄（Windows 多版本共存時可使用 `--app-version` 指定）。

**`asar requires Node >=22` 錯誤**
此為 `@electron/asar` v4 的限制。將 Node 升級至 22.12+ 即可；若無法升級，請將依賴改回 `@electron/asar@3`。

**Postman 自動更新後又變回英文**
更新會產生新的版本目錄（不含中文化補丁），重新執行一次 `node postman-traditional-chinese-injector.js` 即可。

**如何卸載中文化**
桌面端執行 `node postman-traditional-chinese-injector.js --restore`；網頁版在 `chrome://extensions` 移除該擴充功能。

---

## 交流 / 反饋

- 歡迎透過 [GitHub Issues](../../issues) 回報問題與提供建議。

### 回報 Issue 前建議附帶之資訊

| 資訊 | 取得方式 |
|------|--------|
| **作業系統與版本** | Windows 10/11、macOS 版本 + 晶片（Intel / Apple Silicon）、Linux 發行版 |
| **Postman 版本** | Postman 內 `Settings → About`，或 Windows 的 `app-<version>` 資料夾名 |
| **使用方式** | 桌面端二進位程式 / Node 原始碼執行 / 網頁版瀏覽器擴充功能（三選一） |
| **本工具版本** | 執行 `... --version`，或所下載 Release 的版本號 |
| **`--status` 輸出** | 桌面端執行 `... --status`，將整段輸出附上 |
| **Console 日誌** | Postman `View → Developer → Show DevTools`（或擴充功能頁 F12）→ Console，附上含 `[pm-chinese]` / `[pm-scratchpad]` 之日誌 |
| **完整錯誤訊息** | 終端機之完整錯誤文字 |
| **重現步驟與截圖** | 具體操作過程與未翻譯處之截圖 |

---

## 法律聲明 / Disclaimer

- **非官方、無關聯**：本專案為社群維護的第三方繁體中文化工具，**與 Postman, Inc. 無任何關聯**，未獲其授權、贊助或背書。"Postman" 及相關標識為 Postman, Inc. 的商標，此處僅作描述性指代。
- **不分發 Postman 資產**：本倉庫**不包含、亦不分發** Postman 的任何原始碼、二進位程式或原始語言包。倉庫內容僅有本專案之腳本與社群撰寫之繁體中文譯文。
- **譯文數據**：`locales/` 下之繁體中文譯文為便利中文使用者而創作，其鍵值結構與文案衍生自 Postman 之介面字串。本專案對此部分**不主張版權**；如 Postman, Inc. 提出異議，將積極配合處理。
- **本地使用、自負風險**：本工具在**您自己的電腦**上修改**您自行安裝**的 Postman（重新打包 `app.asar` 或載入瀏覽器擴充功能）。是否使用由您自行決定並承擔風險，請遵守 Postman 的**服務條款與 EULA**。
- **授權**：本專案**自身程式碼**以 MIT 許可證發布；該許可證**不涵蓋**上述衍生自 Postman 文案的譯文數據。
- 本說明不構成法律意見。
