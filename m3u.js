// Парсер M3U. Возвращает массив {name, url, group, id}. ES5, работает и в браузере ТВ, и в node.
function parseM3U(text) {
  var lines = text.split(/\r?\n/), out = [], pending = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^\s+|\s+$/g, '');
    if (!line) continue;
    if (line.indexOf('#EXTINF') === 0) {
      var comma = firstCommaOutsideQuotes(line);
      var attrs = comma < 0 ? line : line.substring(0, comma);
      var name = comma < 0 ? '' : line.substring(comma + 1).replace(/^\s+|\s+$/g, '');
      var g = /group-title="([^"]*)"/.exec(attrs), id = /tvg-id="([^"]*)"/.exec(attrs);
      pending = { name: name || '?', group: g ? g[1] : '', id: id ? id[1] : '', url: '' };
    } else if (line.charAt(0) === '#') {
      if (line.indexOf('#EXTGRP:') === 0 && pending && !pending.group) pending.group = line.substring(8).replace(/^\s+|\s+$/g, '');
    } else {
      if (!pending) pending = { name: line, group: '', id: '', url: '' };
      pending.url = line;
      out.push(pending);
      pending = null;
    }
  }
  return out;
}

function firstCommaOutsideQuotes(s) {
  var q = false;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '"') q = !q;
    else if (c === ',' && !q) return i;
  }
  return -1;
}

if (typeof module !== 'undefined') module.exports = parseM3U;
