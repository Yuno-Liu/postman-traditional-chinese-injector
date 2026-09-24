#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const OpenCC = require('opencc-js');

const ROOT = path.join(__dirname, '..');
const convTwp = OpenCC.Converter({ from: 'cn', to: 'twp' });

function convertValue(val, key, filePath) {
  if (typeof val !== 'string') return val;
  if (!val) return val;

  // Specific menu translations
  if (/[\\/]locales[\\/]main[\\/]/.test(filePath)) {
    if (key === 'Undo') return '復原';
  }

  let res = convTwp(val);

  // 1. Postman scripts: developer tools use 腳本 instead of 指令碼
  res = res.replace(/指令碼/g, '腳本');

  // 2. Documentation vs File: 文檔/Documentation -> 文件 (not 檔案)
  if (key === 'Documentation' || key === 'documentation') {
    res = '文件';
  }
  res = res.replace(/API 檔案/g, 'API 文件');
  res = res.replace(/API檔案/g, 'API文件');
  res = res.replace(/說明檔案/g, '說明文件');
  res = res.replace(/參考檔案/g, '參考文件');
  res = res.replace(/技術檔案/g, '技術文件');
  res = res.replace(/公共檔案/g, '公共文件');
  res = res.replace(/詳細檔案/g, '詳細文件');
  res = res.replace(/編寫檔案/g, '編寫文件');
  res = res.replace(/檢視檔案/g, '檢視文件');
  res = res.replace(/在檔案中新增/g, '在文件中新增');
  res = res.replace(/Markdown 檔案/g, 'Markdown 文件');
  res = res.replace(/故障排除檔案/g, '故障排除文件');

  // 3. UI items (accordion, list, tree, table items): 項目, not 專案
  res = res.replace(/此面板中沒有專案/g, '此面板中沒有項目');
  res = res.replace(/Accordion 專案標題/g, 'Accordion 項目標題');
  res = res.replace(/摺疊專案/g, '摺疊項目');
  res = res.replace(/折疊專案/g, '折疊項目');
  res = res.replace(/剪下專案/g, '剪下項目');
  res = res.replace(/刪除專案/g, '刪除項目');
  res = res.replace(/複製專案/g, '複製項目');
  res = res.replace(/展開專案/g, '展開項目');
  res = res.replace(/貼上專案/g, '貼上項目');
  res = res.replace(/重新命名專案/g, '重新命名項目');
  res = res.replace(/下移專案/g, '下移項目');
  res = res.replace(/上移專案/g, '上移項目');
  res = res.replace(/下一專案/g, '下一項目');
  res = res.replace(/上一專案/g, '上一項目');
  res = res.replace(/下一個專案/g, '下一個項目');
  res = res.replace(/上一個專案/g, '上一個項目');
  res = res.replace(/選擇專案/g, '選擇項目');
  res = res.replace(/專案分組/g, '項目分組');
  res = res.replace(/側邊欄專案/g, '側邊欄項目');
  res = res.replace(/個專案/g, '個項目');
  res = res.replace(/每頁專案數/g, '每頁項目數');
  res = res.replace(/最近的專案/g, '最近的項目');
  res = res.replace(/喜愛的專案/g, '喜愛的項目');
  res = res.replace(/歷史專案/g, '歷史項目');
  res = res.replace(/所選專案/g, '所選項目');
  res = res.replace(/沒有專案/g, '沒有項目');
  res = res.replace(/移動專案/g, '移動項目');
  res = res.replace(/無法載入專案/g, '無法載入項目');
  res = res.replace(/這些專案/g, '這些項目');
  res = res.replace(/無法對所選專案執行操作/g, '無法對所選項目執行操作');
  res = res.replace(/組專案/g, '組項目');
  res = res.replace(/重複專案/g, '重複項目');
  res = res.replace(/聚焦下一個專案/g, '聚焦下一個項目');
  res = res.replace(/此專案類型/g, '此項目類型');
  res = res.replace(/此專案的類型/g, '此項目的類型');
  res = res.replace(/不支援的專案類型/g, '不支援的項目類型');
  res = res.replace(/新增專案/g, '新增項目');
  res = res.replace(/已成功移動專案/g, '已成功移動項目');
  res = res.replace(/刪除所選專案/g, '刪除所選項目');
  res = res.replace(/已成功刪除專案/g, '已成功刪除項目');
  res = res.replace(/該面板中沒有專案/g, '該面板中沒有項目');
  res = res.replace(/專案名稱/g, '項目名稱');
  res = res.replace(/無法貼上專案/g, '無法貼上項目');
  res = res.replace(/刪除專案提示/g, '刪除項目提示');
  res = res.replace(/新專案/g, '新項目');

  // 4. UI terms
  res = res.replace(/全屏/g, '全螢幕');

  return res;
}

function convertObject(obj, filePath) {
  if (Array.isArray(obj)) {
    return obj.map((item, idx) => {
      if (typeof item === 'string') return convertValue(item, String(idx), filePath);
      if (item && typeof item === 'object') return convertObject(item, filePath);
      return item;
    });
  }
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      result[k] = convertValue(v, k, filePath);
    } else if (v && typeof v === 'object') {
      result[k] = convertObject(v, filePath);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error(`[錯誤] 解析失敗 ${filePath}:`, e.message);
    return false;
  }

  const converted = convertObject(data, filePath);

  // Scratchpad zh-CN.json is minified single line
  const isMinified = !content.includes('\n') || content.trim().split('\n').length === 1;
  const outText = isMinified ? JSON.stringify(converted) : JSON.stringify(converted, null, 2) + '\n';

  fs.writeFileSync(filePath, outText, 'utf8');
  return true;
}

function walkDir(dir) {
  let count = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      count += walkDir(full);
    } else if (f.name.endsWith('.json')) {
      if (processFile(full)) {
        count++;
      }
    }
  }
  return count;
}

function main() {
  console.log('開始轉換 locales 目錄下的所有翻譯檔案至繁體中文 (zh-TW)...');
  const localesDir = path.join(ROOT, 'locales');
  const convertedCount = walkDir(localesDir);
  console.log(`[完成] 共成功轉換 ${convertedCount} 個翻譯檔案！`);
}

main();
