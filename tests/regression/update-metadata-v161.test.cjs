'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const target = require('../harness/current-script');

const UPDATE_URL = 'https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js';

test('v161 release uses one stable first-party GitHub update artifact', () => {
  const source = fs.readFileSync(target, 'utf8');
  const values = name => [...source.matchAll(new RegExp(`^//\\s*@${name}\\s+(\\S+)\\s*$`, 'gm'))].map(match => match[1]);
  assert.deepEqual(values('version'), ['1.6.1']);
  assert.deepEqual(values('updateURL'), [UPDATE_URL]);
  assert.deepEqual(values('downloadURL'), [UPDATE_URL]);
  assert.deepEqual(values('homepageURL'), ['https://github.com/YUIAOI7592/BiliCDN_TW']);
  assert.equal(source.includes('@require'), false);
});
