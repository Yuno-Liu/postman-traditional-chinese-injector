# macOS 首次執行 / 注入疑難排解

> 本頁配合 [Postman 繁體中文注入](../README.md) 使用。僅 macOS 需要；Windows / Linux 一般無需這些步驟。

## Apple Silicon（M 晶片）首次執行：`zsh: killed` / 「已損毀，無法開啟」

macOS 二進位程式在 Linux CI 上交叉編譯，**未進行 Apple 商業程式碼簽署**；在 Apple Silicon 機型上，系統會攔截未簽署的二進位程式，表現為執行時 `zsh: killed`、或按兩下跳出「**已損毀，無法開啟**」。這些**均非檔案損毀**，請依下列三步驟處理（請全部在**終端機**中執行，先 `cd` 至該檔案所在目錄；**切勿在 Finder 按兩下執行**——此為命令列程式）：

```bash
# 1) 移除「下載隔離」屬性
xattr -dr com.apple.quarantine ./postman-traditional-chinese-injector-macos-arm64
# 2) 進行 ad-hoc 簽署（-s 後面獨立的 - 代表 ad-hoc 身分，前後均有空格，請勿遺漏）
codesign -s - -f ./postman-traditional-chinese-injector-macos-arm64
# 3) 從終端機以 ./ 啟動（視安裝路徑決定是否加 sudo）
./postman-traditional-chinese-injector-macos-arm64
```

- 驗證簽署成功：`codesign -dv ./postman-traditional-chinese-injector-macos-arm64`，輸出包含 `Signature=adhoc` 即可。
- `codesign` 提示 **`no identity found`**：通常是因為複製貼上時漏掉了獨立的 `-`（或變成了全形符號），請手動輸入 `-s - -f`。
- x64（Intel）機型同理，將檔名替換為 `postman-traditional-chinese-injector-macos-x64` 即可。

## 注入時提示 `EPERM: operation not permitted`

複製 / 修改 `app.asar` 時出現此錯誤，為 macOS 13+ 的「**應用程式管理**」安全機制正在阻擋修改已簽署的 `Postman.app`，**即使加 `sudo` 亦無法繞過**。請選擇以下任一解決方案：

- **授權終端機**：系統設定 → 隱私權與安全性 → **App 管理** → 開啟您所使用的終端機（Terminal / iTerm；若未列出請點選 `+` 加入 `/Applications/Utilities/Terminal.app`）→ **完全關閉並重新啟動終端機** → 重新執行注入。
- **移出受保護目錄後再修改**：
  ```bash
  cp -R /Applications/Postman.app ~/Postman.app
  ./postman-traditional-chinese-injector-macos-arm64 --postman-dir ~/Postman.app
  # 驗證介面變為繁體中文後，再移回 Applications：
  rm -rf /Applications/Postman.app && mv ~/Postman.app /Applications/
  ```

> 若不想處理上述設定，可直接參閱 README「方式二」以 Node 原始碼方式執行，即可繞過二進位簽署問題（App 管理的 `EPERM` 仍需依上述方式授權）。
