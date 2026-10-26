"""Режет XMLTV провайдера на маленькие JSON по каналу: [[start, stop, title], ...] (unix-секунды).
Окно: от -6 часов до +48 часов от момента запуска. Использование: build_epg.py <url|файл .xml.gz> <папка>"""
import gzip, json, os, re, sys, time, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

src, out = sys.argv[1], sys.argv[2]
now = time.time()
lo, hi = now - 6 * 3600, now + 48 * 3600
os.makedirs(out, exist_ok=True)

def ts(s):
    return int(datetime.strptime(s.strip(), '%Y%m%d%H%M%S %z').timestamp())

raw = urllib.request.urlopen(src, timeout=120) if src.startswith('http') else open(src, 'rb')
progs, root, n = {}, None, 0
with gzip.GzipFile(fileobj=raw) as f:
    for ev, el in ET.iterparse(f, events=('start', 'end')):
        if ev == 'start':
            if root is None: root = el
            continue
        if el.tag == 'programme':
            try:
                a, b = ts(el.get('start')), ts(el.get('stop'))
                if b > lo and a < hi:
                    progs.setdefault(el.get('channel'), []).append([a, b, (el.findtext('title') or '').strip()])
            except (ValueError, TypeError):
                pass
        if el.tag in ('programme', 'channel'):
            el.clear(); n += 1
            if n % 5000 == 0: root.clear()  # не копим пустые элементы под корнем

for cid, lst in progs.items():
    lst.sort()
    name = re.sub(r'[^A-Za-z0-9_.-]', '_', cid) + '.json'
    with open(os.path.join(out, name), 'w', encoding='utf-8') as fh:
        json.dump(lst, fh, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(out, 'index.json'), 'w') as fh:
    json.dump({'generated': int(now), 'channels': len(progs)}, fh)
print('channels:', len(progs))
