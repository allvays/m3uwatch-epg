// m3uwatch: список каналов + AVPlay + EPG. ES5 без зависимостей, движок Tizen 4.0 не знает ES2016+.
(function () {
  'use strict';
  var ROWS = 14, OSD_MS = 3500, DIGIT_MS = 1500, NOW_MS = 300;
  var $ = function (id) { return document.getElementById(id); };
  var panelEl = $('panel'), listEl = $('list'), groupsEl = $('groups'), nowEl = $('now');
  var osdEl = $('osd'), osdCh = $('osd-ch'), osdProg = $('osd-prog'), osdBar = $('osd-bar'), osdFill = osdBar.firstChild;
  var rows = [], grows = [], all = [], groups = [], items = [], fav = {};
  var cursor = 0, top = 0, gcursor = 1, gtop = 0, col = 'c', playing = null, panelOn = true;
  var osdTimer, digitTimer, nowTimer, digits = '';

  function mkRows(parent, arr) {
    for (var r = 0; r < ROWS; r++) { var d = document.createElement('div'); d.className = 'row'; parent.appendChild(d); arr.push(d); }
  }
  mkRows(listEl, rows); mkRows(groupsEl, grows);
  try { var f = JSON.parse(localStorage.getItem('fav') || '[]'); for (var i = 0; i < f.length; i++) fav[f[i]] = 1; } catch (e) {}

  // ---------- плейлист ----------
  function load() {
    var cached = null;
    try { cached = localStorage.getItem('m3u'); } catch (e) {}
    if (cached) apply(cached);
    fetchText(PLAYLIST_URL || 'playlist.m3u', function (text) {
      if (text === cached) return;
      try { localStorage.setItem('m3u', text); } catch (e) {}
      apply(text);
    }, function () { if (!cached) osd('Не удалось загрузить плейлист'); });
  }
  function fetchText(url, ok, fail) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onload = function () { (x.status === 200 || x.status === 0) && x.responseText ? ok(x.responseText) : fail(); };
    x.onerror = fail;
    x.send();
  }
  function apply(text) {
    all = parseM3U(text);
    var counts = {}, names = [];
    for (var i = 0; i < all.length; i++) {
      var g = all[i].group;
      if (!g) continue;
      if (!counts[g]) { counts[g] = 0; names.push(g); }
      counts[g]++;
    }
    groups = [{ name: '★ Избранное', key: 'fav' }, { name: 'Все каналы', key: 'all', count: all.length }];
    for (var j = 0; j < names.length; j++) groups.push({ name: names[j], key: names[j], count: counts[names[j]] });
    setGroup(gcursor < groups.length ? gcursor : 1);
    if (!playing) {
      var last = null;
      try { last = localStorage.getItem('last'); } catch (e) {}
      for (var k = 0; last && k < all.length; k++) if (all[k].url === last) { play(all[k]); break; }
    }
  }
  function setGroup(gi) {
    gcursor = gi;
    var g = groups[gi];
    items = g.key === 'all' ? all : all.filter(g.key === 'fav' ? function (c) { return fav[c.url]; } : function (c) { return c.group === g.key; });
    if (cursor >= items.length) cursor = 0;
    top = 0;
    render();
  }

  // ---------- виртуальные списки ----------
  function render() {
    if (cursor < top) top = cursor;
    if (cursor >= top + ROWS) top = cursor - ROWS + 1;
    for (var r = 0; r < ROWS; r++) {
      var i = top + r, c = items[i], el = rows[r];
      el.textContent = c ? (i + 1) + '  ' + c.name : '';
      el.className = 'row' + (i === cursor ? ' focus' : '') + (c && c === playing ? ' now' : '') + (c && fav[c.url] ? ' fav' : '');
    }
    if (gcursor < gtop) gtop = gcursor;
    if (gcursor >= gtop + ROWS) gtop = gcursor - ROWS + 1;
    for (var q = 0; q < ROWS; q++) {
      var gi = gtop + q, g = groups[gi], gel = grows[q];
      gel.textContent = '';
      if (g) {
        gel.appendChild(document.createTextNode(g.name + ' '));
        var cnt = g.key === 'fav' ? countFav() : g.count;
        var s = document.createElement('small'); s.textContent = cnt; gel.appendChild(s);
      }
      gel.className = 'row' + (gi === gcursor ? ' focus' : '');
    }
    panelEl.className = (panelOn ? 'on ' : '') + col;
    scheduleNow();
  }
  function countFav() { var n = 0; for (var i = 0; i < all.length; i++) if (fav[all[i].url]) n++; return n; }
  function move(d) {
    if (!items.length) return;
    cursor = (cursor + d + items.length) % items.length;
    render();
  }
  function moveGroup(d) {
    setGroup((gcursor + d + groups.length) % groups.length);
  }
  function showPanel(on) {
    panelOn = on; col = 'c';
    if (on && playing) { var i = items.indexOf(playing); if (i >= 0) cursor = i; }
    render();
  }
  function toggleFav(c) {
    if (!c) return;
    if (fav[c.url]) delete fav[c.url]; else fav[c.url] = 1;
    try { localStorage.setItem('fav', JSON.stringify(Object.keys(fav))); } catch (e) {}
    osd(fav[c.url] ? '★ Добавлен в избранное' : 'Убран из избранного');
    if (groups[gcursor].key === 'fav') setGroup(gcursor); else render();
  }

  // ---------- EPG ----------
  var epgCache = {}, epgN = 0;
  function epgFor(c, cb) {
    if (!EPG_URL || !c || !c.id) return cb(null);
    if (epgCache[c.id]) return cb(epgCache[c.id]);
    var url = EPG_URL + c.id.replace(/[^A-Za-z0-9_.\-]/g, '_') + '.json';
    var done = function (list) {
      if (epgN++ > 300) { epgCache = {}; epgN = 0; } // ponytail: сброс кэша вместо LRU, хватает на вечер переключений
      epgCache[c.id] = list; cb(list);
    };
    fetchText(url, function (t) { var l = []; try { l = JSON.parse(t); } catch (e) {} done(l); }, function () { done([]); });
  }
  function nowProg(list) {
    var t = Date.now() / 1000;
    for (var i = 0; list && i < list.length; i++) if (list[i][0] <= t && t < list[i][1]) return list[i];
    return null;
  }
  function nextProg(list, p) {
    for (var i = 0; list && i < list.length; i++) if (list[i][0] >= p[1]) return list[i];
    return null;
  }
  function hm(ts) { var d = new Date(ts * 1000), h = d.getHours(), m = d.getMinutes(); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  function scheduleNow() {
    clearTimeout(nowTimer);
    nowEl.textContent = '';
    if (!panelOn || !EPG_URL) return;
    var c = items[cursor];
    nowTimer = setTimeout(function () {
      epgFor(c, function (list) {
        if (items[cursor] !== c) return;
        var p = nowProg(list), n = p && nextProg(list, p);
        nowEl.textContent = p ? hm(p[0]) + ' ' + p[2] + (n ? '  ·  далее ' + hm(n[0]) + ' ' + n[2] : '') : (list && list.length ? 'Нет данных о текущей передаче' : '');
      });
    }, NOW_MS);
  }

  // ---------- OSD ----------
  function osdShow() { osdEl.className = 'on'; clearTimeout(osdTimer); osdTimer = setTimeout(function () { osdEl.className = ''; }, OSD_MS); }
  function osd(text) { osdCh.textContent = text; osdProg.textContent = ''; osdBar.className = 'off'; osdShow(); }
  function osdChannel(c, suffix) {
    var i = all.indexOf(c);
    osdCh.textContent = (items.indexOf(c) + 1) + '  ' + c.name + (c.group ? '  ·  ' + c.group : '') + (suffix || '');
    osdProg.textContent = ''; osdBar.className = 'off';
    osdShow();
    epgFor(c, function (list) {
      if (playing !== c) return;
      var p = nowProg(list);
      if (!p) return;
      osdProg.textContent = hm(p[0]) + '–' + hm(p[1]) + '  ' + p[2];
      osdFill.style.width = Math.round(100 * (Date.now() / 1000 - p[0]) / (p[1] - p[0])) + '%';
      osdBar.className = '';
    });
  }

  // ---------- плеер ----------
  function play(c) {
    if (!c) return;
    playing = c;
    try { localStorage.setItem('last', c.url); } catch (e) {}
    showPanel(false);
    osdChannel(c);
    try {
      stopPlayer();
      webapis.avplay.open(c.url);
      webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
      webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
      webapis.avplay.setListener({
        onbufferingstart: function () { if (playing === c) osdChannel(c, '  ·  буферизация…'); },
        onbufferingcomplete: function () { if (playing === c) osdChannel(c); },
        onstreamcompleted: function () { osd('Поток завершён'); },
        onerror: function (e) { osd('Ошибка потока: ' + e); }
      });
      webapis.avplay.prepareAsync(function () { webapis.avplay.play(); },
        function (e) { osd('Не удалось открыть: ' + e); });
    } catch (e) { osd('AVPlay: ' + (e.message || e)); }
  }
  function stopPlayer() {
    try {
      var s = webapis.avplay.getState();
      if (s === 'NONE') return;
      if (s !== 'IDLE') webapis.avplay.stop();
      webapis.avplay.close();
    } catch (e) {}
  }
  function zap(d) {
    if (!items.length) return;
    var i = items.indexOf(playing);
    play(items[(i + d + items.length) % items.length]);
  }
  function digit(n) {
    digits += n;
    osd('Канал ' + digits);
    clearTimeout(digitTimer);
    digitTimer = setTimeout(function () {
      var c = items[parseInt(digits, 10) - 1];
      digits = '';
      c ? play(c) : osd('Нет такого канала');
    }, DIGIT_MS);
  }
  function exit() {
    stopPlayer();
    try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
  }

  // ---------- пульт ----------
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode, inG = panelOn && col === 'g';
    if (k >= 48 && k <= 57) { digit(k - 48); e.preventDefault(); return; }
    switch (k) {
      case 38: panelOn ? (inG ? moveGroup(-1) : move(-1)) : zap(-1); break;         // Up
      case 40: panelOn ? (inG ? moveGroup(1) : move(1)) : zap(1); break;            // Down
      case 37: if (!panelOn) showPanel(true); col = 'g'; render(); break;            // Left → группы
      case 39: if (!panelOn) showPanel(true); col = 'c'; render(); break;            // Right → каналы
      case 13: !panelOn ? showPanel(true) : inG ? (col = 'c', render()) : play(items[cursor]); break; // Enter
      case 405: toggleFav(panelOn && !inG ? items[cursor] : playing); break;         // Yellow
      case 457: if (playing) osdChannel(playing); break;                             // Info
      case 427: zap(1); break;                                                       // ChannelUp
      case 428: zap(-1); break;                                                      // ChannelDown
      case 10009: playing ? showPanel(!panelOn) : exit(); break;                     // Return: список/видео
      default: return;
    }
    e.preventDefault();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPlayer(); else if (playing) play(playing);
  });

  try {
    var keys = ['ChannelUp', 'ChannelDown', 'ColorF2Yellow', 'Info', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (var i = 0; i < keys.length; i++) { try { tizen.tvinputdevice.registerKey(keys[i]); } catch (e) {} }
  } catch (e) {}
  try { webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF); } catch (e) {}

  showPanel(true);
  load();
})();
