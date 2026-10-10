#!/usr/bin/env python3
"""Builds the Qiaomu font library: the open-licence fonts every cover can use out of the box.

One list below is the source of truth. For each font it downloads the upstream file, checks the licence written inside it,
and writes either a subset WOFF2 (Chinese: the 8,105 characters of the 通用规范汉字表 plus GB2312, ASCII and punctuation;
Latin: Latin-1 and punctuation) or, when the licence reserves the font name, the untouched original. Outputs:

  assets/fonts/<id>.<ext>        the font files (also what `npm run package` zips for manual installs)
  assets/fonts/licenses/<id>.txt the copyright line and the full SIL OFL 1.1 text for each font
  assets/fonts/index.json        metadata with byte size and SHA-256 per file
  src/fontmanifest.ts            the same list compiled into the plugin, which downloads and verifies the files on first run

Publish the folder to the font repository with --publish <checkout dir>. Needs fonttools and brotli:
  python3 -m venv .venv && .venv/bin/pip install fonttools brotli && .venv/bin/python scripts/build-font-library.py
"""
import hashlib, io, json, os, shutil, sys, urllib.parse, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'fonts'); CACHE = os.path.join(ROOT, '.font-cache')
VERSION = '1.0.0'
REPO = 'joeseesun/qiaomu-cover-fonts'
NPM = lambda pkg, f: f'https://cdn.jsdelivr.net/npm/@fontpkg/{pkg}/{urllib.parse.quote(f)}'
GF = lambda path: f'https://raw.githubusercontent.com/google/fonts/main/{urllib.parse.quote(path, safe="/")}'

# id, family, english, mood, roles, description, tags, source, axes, mode, priority, home
#   mood: sans | serif | display | brush | mono ;  roles: title body number tag ;  mode: subset | original
#   priority 1 = needed by the default templates, downloaded first on a fresh install
CJK = [
 ('notosans', '思源黑体', 'Noto Sans SC', 'sans', 'body', '标准黑体，屏显清晰，最稳的正文和说明文字', '通用 · 正文', GF('ofl/notosanssc/NotoSansSC[wght].ttf'), {'wght': 400}, 'subset', 1, 'https://fonts.google.com/noto/specimen/Noto+Sans+SC'),
 ('notosans-bold', '思源黑体 Bold', 'Noto Sans SC Bold', 'sans', 'title body', '思源黑体粗体，稳重的标题和强调', '标题 · 稳重', GF('ofl/notosanssc/NotoSansSC[wght].ttf'), {'wght': 700}, 'subset', 1, 'https://fonts.google.com/noto/specimen/Noto+Sans+SC'),
 ('notosans-heavy', '思源黑体 Heavy', 'Noto Sans SC Black', 'sans', 'title', '思源黑体最粗一档，干货、清单、大字报式冲击', '干货 · 冲击', GF('ofl/notosanssc/NotoSansSC[wght].ttf'), {'wght': 900}, 'subset', 1, 'https://fonts.google.com/noto/specimen/Noto+Sans+SC'),
 ('notoserif', '思源宋体', 'Noto Serif SC', 'serif', 'body', '简体中文最好的开源明朝体，正文与副标题', '通用 · 编辑', GF('ofl/notoserifsc/NotoSerifSC[wght].ttf'), {'wght': 400}, 'subset', 2, 'https://fonts.google.com/noto/specimen/Noto+Serif+SC'),
 ('notoserif-bold', '思源宋体 Bold', 'Noto Serif SC Bold', 'serif', 'title body', '思源宋体粗体，严肃、权威的标题', '标题 · 编辑', GF('ofl/notoserifsc/NotoSerifSC[wght].ttf'), {'wght': 700}, 'subset', 2, 'https://fonts.google.com/noto/specimen/Noto+Serif+SC'),
 ('notoserif-heavy', '思源宋体 Heavy', 'Noto Serif SC Black', 'serif', 'title', '最粗的宋体，杂志封面与深度长文的大标题', '杂志 · 深度', GF('ofl/notoserifsc/NotoSerifSC[wght].ttf'), {'wght': 900}, 'subset', 1, 'https://fonts.google.com/noto/specimen/Noto+Serif+SC'),
 ('zhuque', '朱雀仿宋', 'Zhuque Fangsong', 'serif', 'title body', '开源仿宋，清瘦克制有书卷气', '文化 · 书籍 · 典雅', NPM('zhuque-fangsong-technical-preview@0.212.0', 'ZhuqueFangsong-Regular.ttf'), None, 'subset', 2, 'https://github.com/TrionesType/zhuque'),
 ('wenkai', '霞鹜文楷', 'LXGW WenKai', 'serif', 'title body', '现代感的开源楷体，有手写温度但不土', '生活 · 读书 · 温暖', NPM('lxgw-wen-kai@1.520.0', 'LXGWWenKai-Regular.ttf'), None, 'subset', 2, 'https://github.com/lxgw/LxgwWenKai'),
 ('smiley', '得意黑', 'Smiley Sans', 'display', 'title', '自带速度感的斜体黑，开源字体里最有设计签名的一款', '科技 · 潮流 · 产品', NPM('smiley-sans@2.0.4', 'SmileySans-Oblique.ttf'), None, 'subset', 1, 'https://github.com/atelier-anchor/smiley-sans'),
 ('douyin', '抖音美好体', 'Douyin Sans', 'display', 'title', '字节跳动开源的粗黑，带一点圆润的现代感', '短视频 · 年轻 · 种草', 'https://raw.githubusercontent.com/bytedance/fonts/main/DouyinSans/DouyinSansBold.ttf', None, 'original', 1, 'https://github.com/bytedance/fonts'),
 ('glow', '未来荧黑', 'Glow Sans SC Heavy', 'display', 'title', '几何骨架的重黑体，科技、发布会、数据结论', '科技 · 未来 · 发布会', NPM('glow-sans-sc@0.93.2', 'GlowSansSC-Normal-Heavy.otf'), None, 'subset', 2, 'https://github.com/welai/glow-sans'),
 ('huangyou', '站酷庆科黄油体', 'ZCOOL QingKe HuangYou', 'display', 'title', '圆润饱满，有招牌字的亲和力', '种草 · 促销 · 亲切', GF('ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf'), None, 'subset', 2, 'https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou'),
 ('kuaile', '站酷快乐体', 'ZCOOL KuaiLe', 'display', 'title', '活泼但不幼稚', '轻松 · 美食 · 亲子', GF('ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf'), None, 'subset', 3, 'https://fonts.google.com/specimen/ZCOOL+KuaiLe'),
 ('jiangcheng', '江城圆体', 'JiangCheng YuanTi', 'display', 'title body', '完成度最高的开源圆体，温和亲切', '圆体 · 生活 · 母婴', NPM('jiang-cheng-yuan-ti@3.6.0', '江城圆体 600W.ttf'), None, 'subset', 2, 'https://www.npmjs.com/package/@fontpkg/jiang-cheng-yuan-ti'),
 ('maoken', '猫啃什锦黑', 'Maoken Assorted Sans', 'display', 'title', '圆头圆脑的粗标题字，俏皮有记忆点', '种草 · 美食 · 俏皮', NPM('maoken-assorted-sans@1.62.1', 'MaokenAssortedSans.ttf'), None, 'subset', 3, 'https://github.com/maoken-fonts/MaokenAssortedSans'),
 ('tiejili', '铁蒺藜体', 'Tiejili SC', 'display', 'title', '棱角锋利的粗体，国潮、热血、武侠', '国潮 · 热血 · 力量', NPM('tiejili-sc@1.100.1', 'TiejiliSC-Regular.ttf'), None, 'subset', 3, 'https://github.com/Buernia/Tiejili'),
 ('mashan', '马善政楷书', 'Ma Shan Zheng', 'brush', 'title', '毛笔楷书，笔画清楚，缩略图里也认得出', '国风 · 书法 · 节气', GF('ofl/mashanzheng/MaShanZheng-Regular.ttf'), None, 'subset', 3, 'https://fonts.google.com/specimen/Ma+Shan+Zheng'),
 ('zhimang', '志莽行书', 'Zhi Mang Xing', 'brush', 'title', '潇洒的行书，金句和情绪', '行书 · 励志 · 金句', GF('ofl/zhimangxing/ZhiMangXing-Regular.ttf'), None, 'subset', 3, 'https://fonts.google.com/specimen/Zhi+Mang+Xing'),
 ('pixel', '缝合像素字体', 'Fusion Pixel', 'display', 'title', '像素风，游戏与复古', '像素 · 游戏 · 复古', NPM('fusion-pixel@20220405.0.0', 'fusion-pixel.ttf'), None, 'subset', 3, 'https://github.com/TakWolf/fusion-pixel-font'),
]
LATIN = [
 ('inter', 'Inter', 'Inter', 'sans', 'body tag', '干净的通用无衬线，英文副标题与界面感', '通用 · 干净', GF('ofl/inter/Inter[opsz,wght].ttf'), {'wght': 400, 'opsz': 14}, 'subset', 2, 'https://fonts.google.com/specimen/Inter'),
 ('inter-bold', 'Inter Bold', 'Inter ExtraBold', 'sans', 'title number', 'Inter 的粗体，英文标题与数字', '标题 · 现代', GF('ofl/inter/Inter[opsz,wght].ttf'), {'wght': 800, 'opsz': 32}, 'subset', 2, 'https://fonts.google.com/specimen/Inter'),
 ('spacegrotesk', 'Space Grotesk', 'Space Grotesk', 'sans', 'title number tag', '科技感无衬线，配未来荧黑', '科技 · 产品', GF('ofl/spacegrotesk/SpaceGrotesk[wght].ttf'), {'wght': 700}, 'subset', 2, 'https://fonts.google.com/specimen/Space+Grotesk'),
 ('bricolage', 'Bricolage Grotesque', 'Bricolage Grotesque', 'display', 'title number tag', '有个性的怪诞体，潮流与创作者话题', '潮流 · 创作者', GF('ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf'), {'wght': 800, 'opsz': 72, 'wdth': 100}, 'subset', 2, 'https://fonts.google.com/specimen/Bricolage+Grotesque'),
 ('unbounded', 'Unbounded', 'Unbounded', 'display', 'title number', '宽体几何，发布会和未来感', '发布会 · 未来', GF('ofl/unbounded/Unbounded[wght].ttf'), {'wght': 800}, 'subset', 3, 'https://fonts.google.com/specimen/Unbounded'),
 ('anton', 'Anton', 'Anton', 'display', 'title number', '窄粗体，YouTube 缩略图标配', '缩略图 · 冲击', GF('ofl/anton/Anton-Regular.ttf'), None, 'subset', 1, 'https://fonts.google.com/specimen/Anton'),
 ('bebas', 'Bebas Neue', 'Bebas Neue', 'display', 'number tag', '全大写窄体，数字、期号、角标', '数字 · 角标', GF('ofl/bebasneue/BebasNeue-Regular.ttf'), None, 'subset', 1, 'https://fonts.google.com/specimen/Bebas+Neue'),
 ('archivoblack', 'Archivo Black', 'Archivo Black', 'display', 'title', '厚重有力的英文标题', '冲击 · 标题', GF('ofl/archivoblack/ArchivoBlack-Regular.ttf'), None, 'subset', 3, 'https://fonts.google.com/specimen/Archivo+Black'),
 ('dmserif', 'DM Serif Display', 'DM Serif Display', 'serif', 'title', '优雅的展示衬线', '优雅 · 生活方式', GF('ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf'), None, 'subset', 3, 'https://fonts.google.com/specimen/DM+Serif+Display'),
 ('fraunces', 'Fraunces', 'Fraunces', 'serif', 'title number', '柔和有温度的衬线，配霞鹜文楷', '温暖 · 人文', GF('ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf'), {'wght': 800, 'opsz': 72, 'SOFT': 50, 'WONK': 0}, 'subset', 2, 'https://fonts.google.com/specimen/Fraunces'),
 ('instrument', 'Instrument Serif', 'Instrument Serif', 'serif', 'title number tag', '当下最流行的编辑衬线', '编辑 · 杂志', GF('ofl/instrumentserif/InstrumentSerif-Regular.ttf'), None, 'subset', 1, 'https://fonts.google.com/specimen/Instrument+Serif'),
 ('instrument-italic', 'Instrument Serif Italic', 'Instrument Serif Italic', 'serif', 'tag number', '编辑斜体，杂志感角标与期号', '编辑 · 角标', GF('ofl/instrumentserif/InstrumentSerif-Italic.ttf'), None, 'subset', 1, 'https://fonts.google.com/specimen/Instrument+Serif'),
 ('cormorant', 'Cormorant Garamond', 'Cormorant Garamond', 'serif', 'title tag', '高级、奢侈品、香氛', '高级 · 奢华', GF('ofl/cormorantgaramond/CormorantGaramond[wght].ttf'), {'wght': 700}, 'subset', 3, 'https://fonts.google.com/specimen/Cormorant+Garamond'),
 ('jetbrains', 'JetBrains Mono', 'JetBrains Mono', 'mono', 'tag number', '代码、教程、工具类封面的标签', '代码 · 教程', GF('ofl/jetbrainsmono/JetBrainsMono[wght].ttf'), {'wght': 700}, 'subset', 2, 'https://fonts.google.com/specimen/JetBrains+Mono'),
 ('caveat', 'Caveat', 'Caveat', 'brush', 'tag', '手写批注，配合荧光笔效果', '手写 · 笔记', GF('ofl/caveat/Caveat[wght].ttf'), {'wght': 600}, 'subset', 3, 'https://fonts.google.com/specimen/Caveat'),
]

def gb2312() -> set:
    out = set()
    for hi in range(0xA1, 0xF8):
        for lo in range(0xA1, 0xFF):
            try: out.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError: pass
    return out
STANDARD = set(open(os.path.join(ROOT, 'scripts', 'charset-8105.txt'), encoding='utf-8').read()) - {'\n', ' '}
COMMON = {chr(c) for c in range(0x20, 0x7F)} | {chr(c) for c in range(0xA0, 0x100)} | {chr(c) for c in range(0x2010, 0x2070)} | {chr(c) for c in range(0x2100, 0x2200)} | {'€', '™', '•'}
CJK_CHARS = STANDARD | gb2312() | COMMON | {chr(c) for c in range(0x3000, 0x3040)} | {chr(c) for c in range(0xFF00, 0xFFF0)} | {chr(c) for c in range(0x2460, 0x2500)}
LATIN_CHARS = COMMON | {chr(c) for c in range(0x100, 0x180)}

def get(url: str) -> bytes:
    os.makedirs(CACHE, exist_ok=True); path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(path): return open(path, 'rb').read()
    err = None
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'qiaomu-font-library'}), timeout=300) as r: data = r.read()
            open(path, 'wb').write(data); return data
        except Exception as e: err = e
    raise err

def licence(font: TTFont) -> tuple[str, str]:
    """(copyright, licence description) as written in the font's name table."""
    n = font['name']; return ((n.getDebugName(0) or '').strip(), (n.getDebugName(13) or '').strip())

# Fonts whose name table has no licence field; checked by hand against the upstream repository's licence file.
VERIFIED = {'pixel': 'Copyright (c) 2022, TakWolf (https://takwolf.com). Licensed under SIL OFL 1.1 (upstream LICENSE-OFL).'}
OFL_TEXT = open(os.path.join(ROOT, 'scripts', 'OFL-1.1.txt'), encoding='utf-8').read()

def make(row, cjk: bool):
    id, family, en, mood, roles, zh, hint, url, axes, mode, priority, home = row
    raw = get(url); font = TTFont(io.BytesIO(raw)); copyright, lic = licence(font)
    if id in VERIFIED: copyright = copyright or VERIFIED[id]
    elif 'Open Font License' not in lic and 'OFL' not in lic and id != 'douyin': raise SystemExit(f'{id}: licence is not OFL: {lic[:120]}')
    # Only a declaration counts ("…, with Reserved Font Name 'X'"), not the definitions inside the licence text itself.
    reserved = 'with Reserved Font Name' in (copyright + lic)
    if reserved and mode == 'subset' and family_name_reserved(copyright + lic, font): raise SystemExit(f'{id}: reserves its name, ship it as original or rename it')
    if mode == 'original':
        ext = 'ttf' if raw[:4] in (b'\x00\x01\x00\x00', b'true') else 'otf'; blob = raw
    else:
        if axes and 'fvar' in font:
            have = {a.axisTag for a in font['fvar'].axes}; font = instancer.instantiateVariableFont(font, {k: v for k, v in axes.items() if k in have}, inplace=False)
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'tnum', 'pnum', 'case']; opts.name_IDs = ['*']; opts.notdef_outline = True; opts.drop_tables += ['DSIG']
        sub = subset.Subsetter(opts); sub.populate(unicodes=[ord(c) for c in (CJK_CHARS if cjk else LATIN_CHARS)]); sub.subset(font)
        out = io.BytesIO(); font.flavor = 'woff2'; font.save(out); blob = out.getvalue(); ext = 'woff2'
    cmap = set(TTFont(io.BytesIO(blob)).getBestCmap() or {})
    coverage = sum(1 for c in STANDARD if ord(c) in cmap) if cjk else None
    file = f'{id}.{ext}'
    open(os.path.join(OUT, file), 'wb').write(blob)
    os.makedirs(os.path.join(OUT, 'licenses'), exist_ok=True)
    head = copyright or f'{en}'
    if id == 'douyin': head = 'Copyright (c) , 2023 Beijing Zitiao Network Technology Co. Ltd.\nwith Reserved Font Names "Douyin", "抖音",  "抖音美好".'
    open(os.path.join(OUT, 'licenses', f'{id}.txt'), 'w', encoding='utf-8').write(f'{family} ({en})\nSource: {home}\nThis copy: {"unmodified original" if mode == "original" else "subset and converted to WOFF2 by Qiaomu Cover Design"}\n\n{head}\n\n{OFL_TEXT}')
    sha = hashlib.sha256(blob).hexdigest()
    print(f'{id:18} {len(blob) // 1024:6} KB  {mode:8} {"8105 coverage " + str(coverage) if cjk else ""}{"  RFN" if reserved else ""}', flush=True)
    return {'id': id, 'family': family, 'en': en, 'mood': mood, 'roles': roles.split(), 'zh': zh, 'hint': hint, 'file': file, 'bytes': len(blob), 'sha256': sha, 'cjk': cjk, 'priority': priority, 'license': 'OFL-1.1', 'home': home, **({'coverage': coverage} if cjk else {})}

def family_name_reserved(text: str, font: TTFont) -> bool:
    """True when the reserved name is part of the family name we would keep after subsetting."""
    import re
    names = [m.strip(' "\'') for m in re.findall(r'Reserved Font Names? ([^.]+)', text)]
    reserved = [x.strip(' "\'“”') for part in names for x in re.split(r',| and ', part) if x.strip(' "\'“”')]
    fam = ' '.join(filter(None, [font['name'].getDebugName(1), font['name'].getDebugName(16)])).lower()
    return any(r.lower() in fam for r in reserved)

def main():
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT)
    index = [make(r, True) for r in CJK] + [make(r, False) for r in LATIN]
    manifest = {'version': VERSION, 'repo': REPO, 'fonts': index}
    json.dump(manifest, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    ts = ('/** Generated by scripts/build-font-library.py. Do not edit by hand. */\n'
          "import type { BundledFont } from './fonts';\n"
          f"export const FONT_LIBRARY_VERSION = '{VERSION}';\nexport const FONT_LIBRARY_REPO = '{REPO}';\n"
          'export const BUNDLED_FONTS: BundledFont[] = ' + json.dumps(index, ensure_ascii=False, indent=1) + ';\n')
    open(os.path.join(ROOT, 'src', 'fontmanifest.ts'), 'w', encoding='utf-8').write(ts)
    total = sum(f['bytes'] for f in index)
    print(f'{len(index)} fonts, {total / 1024 / 1024:.1f} MB')
    if '--publish' in sys.argv:
        dest = sys.argv[sys.argv.index('--publish') + 1]
        for sub in ('fonts', 'licenses'):
            if os.path.isdir(os.path.join(dest, sub)): shutil.rmtree(os.path.join(dest, sub))
        os.makedirs(os.path.join(dest, 'fonts'))
        for f in index: shutil.copy(os.path.join(OUT, f['file']), os.path.join(dest, 'fonts', f['file']))
        shutil.copytree(os.path.join(OUT, 'licenses'), os.path.join(dest, 'licenses'))
        shutil.copy(os.path.join(OUT, 'index.json'), os.path.join(dest, 'index.json'))
        print('published to', dest)

if __name__ == '__main__': main()
