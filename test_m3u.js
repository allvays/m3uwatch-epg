var assert = require('assert');
var parseM3U = require('./m3u.js');

var r = parseM3U([
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="X1" group-title="Новости, РФ",Россия 24, HD',
  'http://a/1.m3u8',
  '#EXTINF:-1,Без группы',
  '#EXTGRP:Кино',
  'http://a/2.ts',
  'http://a/3.ts',
  ''
].join('\r\n'));

assert.strictEqual(r.length, 3);
assert.deepStrictEqual(r[0], { name: 'Россия 24, HD', group: 'Новости, РФ', id: 'X1', url: 'http://a/1.m3u8' });
assert.deepStrictEqual(r[1], { name: 'Без группы', group: 'Кино', id: '', url: 'http://a/2.ts' });
assert.deepStrictEqual(r[2], { name: 'http://a/3.ts', group: '', id: '', url: 'http://a/3.ts' });
console.log('ok');
