# 關閉 Postman 自動更新（保持中文化不被覆蓋）

> 本頁配合 [Postman 繁體中文注入](../README.md) 使用。

Postman 桌面端使用 **Squirrel 更新器**自動更新：檢查更新走 `GET dl.pstmn.io/update/status`，Windows 由 `%LOCALAPPDATA%\Postman\Update.exe` 負責下載並套用。升級後會產生新的版本目錄（不含中文化補丁）→ 介面變回英文。使用下列任一方法關閉更新即可（可疊加使用）。

> ⚠️ 網傳「修改 `Preferences.json` 裡的 `update.enabled`」對**新版 Postman 已失效**——新版已無該檔案亦無此開關，請勿照抄。

---

## 方法 A（Windows，推薦）：停用 Squirrel 更新器

將更新器 `Update.exe` 重新命名即可。**不影響 Postman 啟動，亦不影響以瀏覽器下載 Postman**，隨時可改回——比屏蔽網域名稱更乾淨。

```powershell
# 停用自動更新
$u="$env:LOCALAPPDATA\Postman\Update.exe"
if(Test-Path $u){ Rename-Item $u "Update.exe.disabled" -Force; "已停用更新：$u -> Update.exe.disabled" } else { "未找到 Update.exe（可能非 Squirrel 安裝）" }
```

```powershell
# 還原
$d="$env:LOCALAPPDATA\Postman\Update.exe.disabled"
if(Test-Path $d){ Rename-Item $d "Update.exe" -Force; "已恢復更新器" } else { "未找到 Update.exe.disabled" }
```

> `Update.exe` 是 Squirrel 用來下載並安裝更新的程式，改名後即無法自我更新。應用程式內偶爾仍可能跳出「有可用更新」的通知但無法安裝；若想連同通知一併消除，可疊加下方的方法 B。

---

## 方法 B（全平台通用）：hosts 屏蔽更新伺服器

Postman 透過 `GET dl.pstmn.io/update/status?...` 檢查更新，並從**同一個** `dl.pstmn.io` 下載更新套件。hosts 是**按網域名稱**生效，無法僅阻擋更新而放行下載，因此屏蔽此項目後**手動下載 Postman 的連結亦會一併失效**。macOS / Linux 沒有可單獨改名的更新器，採用此方法最為省事。

**實用做法**：**先將要使用的 Postman 版本下載並安裝完成**，再加入下方設定；日後若需更換版本，將該行暫時刪除（或行首加上 `#` 註解）即可。

編輯 hosts 檔案（Windows `C:\Windows\System32\drivers\etc\hosts` 需系統管理員權限；macOS / Linux `/etc/hosts` 需 `sudo`），加入：

```
127.0.0.1 dl.pstmn.io
# 以下為歷史遺留網域，選填（新版基本上不再使用）：
127.0.0.1 updates.getpostman.com
127.0.0.1 postman-electron-updates.s3.amazonaws.com
```

macOS / Linux 重新整理 DNS 快取（選用）：

```bash
# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
# Linux（systemd）
sudo resolvectl flush-caches 2>/dev/null || sudo systemd-resolve --flush-caches
```

---

## 固定在特定版本

若想固定版本：先從[發布說明頁](https://www.postman.com/release-notes/postman-app/)挑選版本，透過[指定版本載點](../README.md#下載-postman各版本)安裝，再依照上述方法 A 或 B 關閉更新即可。
