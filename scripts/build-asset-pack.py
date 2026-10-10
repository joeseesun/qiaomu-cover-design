#!/usr/bin/env python3
"""Builds assets/pack.json.gz: ~1200 Fluent Emoji Flat stickers (MIT, Microsoft) with Chinese names and tags from CLDR (emojibase),
plus ~1900 Lucide line icons (ISC). The plugin reads it offline, so insertion never depends on a network.
Run: python3 scripts/build-asset-pack.py"""
import gzip, json, re, urllib.request

def get(url: str):
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)

def slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace('&', 'and')).strip('-')

fluent = get('https://cdn.jsdelivr.net/npm/@iconify-json/fluent-emoji-flat@1.2.5/icons.json')['icons']
lucide = get('https://cdn.jsdelivr.net/npm/@iconify-json/lucide/icons.json')['icons']
en = get('https://cdn.jsdelivr.net/npm/emojibase-data@16.0.3/en/data.json')
zh = {e['hexcode']: e for e in get('https://cdn.jsdelivr.net/npm/emojibase-data@16.0.3/zh/data.json')}
KEEP = {0, 3, 4, 5, 6, 7, 8}  # smileys, animals, food, travel, activities, objects, symbols (no people with skin tones, no flags)
emoji = []
for e in en:
    if e.get('group') not in KEEP or 'skin' in e['label']:
        continue
    s = slug(e['label'])
    if s not in fluent:
        s = s.replace('-and-', '-')
        if s not in fluent:
            continue
    z = zh.get(e['hexcode'], {})
    emoji.append([s, z.get('label', ''), ' '.join(z.get('tags') or []), e['label'] + ' ' + ' '.join(e.get('tags') or []), fluent[s]['body']])
line = [[k, v['body']] for k, v in lucide.items()]
data = json.dumps({'emoji': emoji, 'line': line}, ensure_ascii=False, separators=(',', ':')).encode()
open('assets/pack.json.gz', 'wb').write(gzip.compress(data, 9))
print(len(emoji), 'emoji,', len(line), 'line icons,', len(data) // 1024, 'KB raw')
