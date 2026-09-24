#!/usr/bin/env node
'use strict';
/**
 * 向下相容入口：引導至 postman-traditional-chinese-injector.js
 */
const injector = require('./postman-traditional-chinese-injector.js');

module.exports = injector;

if (require.main === module) {
  if (typeof injector.main === 'function') {
    injector.main().catch((e) => {
      console.error(`[錯誤] ${e.message}`);
      process.exit(1);
    });
  }
}
