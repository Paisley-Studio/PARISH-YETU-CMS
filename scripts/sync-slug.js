#!/usr/bin/env node
/* Regenerates r2-worker/src/slug.js (ES module) from js/slug.js so the browser preview and the
 * Worker always produce identical parish web addresses.   Usage: node scripts/sync-slug.js */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const s = fs.readFileSync(path.join(root, 'js/slug.js'), 'utf8');
const j = s.indexOf('function () {', s.indexOf('})(typeof self'));
const body = s.slice(j, s.lastIndexOf('});'));
fs.writeFileSync(path.join(root, 'r2-worker/src/slug.js'),
  '/* GENERATED from js/slug.js (ES module copy for the Worker). Edit js/slug.js, then run: node scripts/sync-slug.js */\n' +
  'const factory = ' + body + '};\nexport default factory();\n');
console.log('r2-worker/src/slug.js updated');
