#!/usr/bin/env python3
"""Builds assets/fonts/: subset WOFF2 files of open-licence fonts that ship with the plugin, so the common fonts work offline and instantly.
Chinese fonts keep ASCII plus the 6,763 GB2312 hanzi and punctuation (anything rarer falls back to a system font). Needs fonttools and brotli:
  python3 -m venv .venv && .venv/bin/pip install fonttools brotli && .venv/bin/python scripts/build-font-pack.py"""
import io, json, os, sys, urllib.parse, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts'); os.makedirs(OUT, exist_ok=True)
NPM = lambda pkg, f: f'https://cdn.jsdelivr.net/npm/@fontpkg/{pkg}/{urllib.parse.quote(f)}'
GF = lambda path: f'https://cdn.jsdelivr.net/gh/google/fonts@main/{urllib.parse.quote(path, safe="/")}'
RAW = lambda path: f'https://raw.githubusercontent.com/google/fonts/main/{urllib.parse.quote(path, safe="/")}'  # jsDelivr refuses files over 20 MB

def gb2312() -> str:
    chars = []
    for hi in range(0xA1, 0xF8):
        for lo in range(0xA1, 0xFF):
            try: chars.append(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError: pass
    return ''.join(chars)
CJK = set(gb2312()) | {chr(c) for c in range(0x20, 0x7F)} | {chr(c) for c in range(0x3000, 0x3040)} | {chr(c) for c in range(0xFF00, 0xFFF0)} | {chr(c) for c in range(0x2010, 0x2028)} | {'·', '—', '“', '”', '‘', '’', '…'}
LATIN = {chr(c) for c in range(0x20, 0x7F)} | {chr(c) for c in range(0xA0, 0x100)} | {chr(c) for c in range(0x2010, 0x2028)} | {'€', '™', '·', '…'}

# id, family, english, mood, zh blurb, hint, url, weight to instantiate (variable fonts) or None, cjk?, licence, home
F = [
 ('zhuque', '朱雀仿宋', 'Zhuque Fangsong', 'serif', '开源仿宋，典雅克制，杂志感、文化类标题', '文化 · 书籍 · 深度', NPM('zhuque-fangsong-technical-preview@0.212.0', 'ZhuqueFangsong-Regular.ttf'), None, True, 'OFL', 'https://github.com/TrionesType/zhuque'),
 ('wenkai', '霞鹜文楷', 'LXGW WenKai', 'serif', '温润的开源楷体，有手写温度', '生活 · 读书 · 温暖', NPM('lxgw-wen-kai@1.520.0', 'LXGWWenKai-Regular.ttf'), None, True, 'OFL', 'https://github.com/lxgw/LxgwWenKai'),
 ('notoserif', '思源宋体', 'Noto Serif SC', 'serif', 'Adobe 与 Google 的宋体，最稳的标题宋体', '通用 · 严肃 · 编辑', GF('ofl/notoserifsc/NotoSerifSC[wght].ttf'), 500, True, 'OFL', 'https://fonts.google.com/noto/specimen/Noto+Serif+SC'),
 ('notoserif-bold', '思源宋体 Bold', 'Noto Serif SC Bold', 'serif', '思源宋体的粗体，做大标题', '标题 · 编辑', GF('ofl/notoserifsc/NotoSerifSC[wght].ttf'), 800, True, 'OFL', 'https://fonts.google.com/noto/specimen/Noto+Serif+SC'),
 ('notosans', '思源黑体', 'Noto Sans SC', 'sans', '标准黑体，屏显清晰', '通用 · 正文', GF('ofl/notosanssc/NotoSansSC[wght].ttf'), 400, True, 'OFL', 'https://fonts.google.com/noto/specimen/Noto+Sans+SC'),
 ('notosans-bold', '思源黑体 Bold', 'Noto Sans SC Bold', 'sans', '思源黑体的粗体，做标题有冲击', '标题 · 冲击', GF('ofl/notosanssc/NotoSansSC[wght].ttf'), 800, True, 'OFL', 'https://fonts.google.com/noto/specimen/Noto+Sans+SC'),
 ('smiley', '得意黑', 'Smiley Sans', 'display', '斜体黑体，轻快有设计感', '科技 · 潮流 · 产品', NPM('smiley-sans@2.0.4', 'SmileySans-Oblique.ttf'), None, True, 'OFL', 'https://github.com/atelier-anchor/smiley-sans'),
 ('neoxihei', '霞鹜新晰黑', 'LXGW Neo XiHei', 'sans', '清爽的开源黑体', '现代 · 干净', NPM('lxgw-neo-xi-hei@1.110.0', 'LXGWNeoXiHei.ttf'), None, True, 'OFL', 'https://github.com/lxgw/LxgwNeoXiHei'),
 ('huangyou', '站酷庆科黄油体', 'ZCOOL QingKe HuangYou', 'display', '圆润饱满的标题体', '种草 · 亲切 · 活泼', GF('ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf'), None, True, 'OFL', 'https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou'),
 ('kuaile', '站酷快乐体', 'ZCOOL KuaiLe', 'display', '活泼可爱的标题体', '快乐 · 儿童 · 美食', GF('ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf'), None, True, 'OFL', 'https://fonts.google.com/specimen/ZCOOL+KuaiLe'),
 ('xiaowei', '站酷小薇体', 'ZCOOL XiaoWei', 'serif', '纤细优雅的宋风体', '文艺 · 女性 · 优雅', GF('ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf'), None, True, 'OFL', 'https://fonts.google.com/specimen/ZCOOL+XiaoWei'),
 ('mashan', '马善政楷书', 'Ma Shan Zheng', 'brush', '毛笔楷书，国风、情绪', '国风 · 书法', GF('ofl/mashanzheng/MaShanZheng-Regular.ttf'), None, True, 'OFL', 'https://fonts.google.com/specimen/Ma+Shan+Zheng'),
 ('zhimang', '志莽行书', 'Zhi Mang Xing', 'brush', '潇洒行书', '行书 · 励志', GF('ofl/zhimangxing/ZhiMangXing-Regular.ttf'), None, True, 'OFL', 'https://fonts.google.com/specimen/Zhi+Mang+Xing'),
 ('longcang', '龙藏体', 'Long Cang', 'brush', '洒脱草书', '草书 · 古风', GF('ofl/longcang/LongCang-Regular.ttf'), None, True, 'OFL', 'https://fonts.google.com/specimen/Long+Cang'),
 ('maocao', '刘建毛草', 'Liu Jian Mao Cao', 'brush', '潇洒草书', '草书 · 古风', GF('ofl/liujianmaocao/LiuJianMaoCao-Regular.ttf'), None, True, 'OFL', 'https://fonts.google.com/specimen/Liu+Jian+Mao+Cao'),
 ('pixel', '缝合像素字体', 'Fusion Pixel', 'display', '像素风，游戏、复古', '像素 · 游戏', NPM('fusion-pixel@20220405.0.0', 'fusion-pixel.ttf'), None, True, 'OFL', 'https://github.com/TakWolf/fusion-pixel-font'),
 ('glow', '未来荧黑', 'Glow Sans SC Heavy', 'display', '几何感粗黑，科技现代', '科技 · 现代', NPM('glow-sans-sc@0.93.2', 'GlowSansSC-Normal-Heavy.otf'), None, True, 'OFL', 'https://github.com/welai/glow-sans'),
]
LATIN_F = [  # id, family, mood, blurb, path, weight
 ('playfair', 'Playfair Display', 'serif', '高对比衬线，杂志感大标题', 'ofl/playfairdisplay/PlayfairDisplay[wght].ttf', 700), ('anton', 'Anton', 'display', '窄粗无衬线，冲击力', 'ofl/anton/Anton-Regular.ttf', None),
 ('bebas', 'Bebas Neue', 'display', '全大写窄体，海报标题', 'ofl/bebasneue/BebasNeue-Regular.ttf', None), ('montserrat', 'Montserrat', 'sans', '几何无衬线，现代通用', 'ofl/montserrat/Montserrat[wght].ttf', 800),
 ('oswald', 'Oswald', 'display', '紧凑粗体，标题与榜单', 'ofl/oswald/Oswald[wght].ttf', 700), ('archivoblack', 'Archivo Black', 'display', '厚重黑体，冲击标题', 'ofl/archivoblack/ArchivoBlack-Regular.ttf', None),
 ('abril', 'Abril Fatface', 'serif', '时尚高对比粗衬线', 'ofl/abrilfatface/AbrilFatface-Regular.ttf', None), ('dmserif', 'DM Serif Display', 'serif', '优雅展示衬线', 'ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf', None),
 ('lora', 'Lora', 'serif', '耐看的正文衬线', 'ofl/lora/Lora[wght].ttf', 600), ('spacegrotesk', 'Space Grotesk', 'sans', '科技感无衬线', 'ofl/spacegrotesk/SpaceGrotesk[wght].ttf', 700),
 ('bangers', 'Bangers', 'display', '漫画拟声风', 'ofl/bangers/Bangers-Regular.ttf', None), ('pacifico', 'Pacifico', 'brush', '圆润手写招牌体', 'ofl/pacifico/Pacifico-Regular.ttf', None),
 ('lobster', 'Lobster', 'brush', '流行招牌手写体', 'ofl/lobster/Lobster-Regular.ttf', None), ('caveat', 'Caveat', 'brush', '随手笔记手写体', 'ofl/caveat/Caveat[wght].ttf', 600),
 ('dancing', 'Dancing Script', 'brush', '优雅连笔手写', 'ofl/dancingscript/DancingScript[wght].ttf', 700), ('permanentmarker', 'Permanent Marker', 'brush', '马克笔涂鸦', 'ofl/permanentmarker/PermanentMarker-Regular.ttf', None),
 ('bungee', 'Bungee', 'display', '街头招牌体', 'ofl/bungee/Bungee-Regular.ttf', None), ('righteous', 'Righteous', 'display', '复古几何展示体', 'ofl/righteous/Righteous-Regular.ttf', None),
]
def get(url: str) -> bytes:
    if 'jsdelivr' in url and ('NotoSerifSC' in url or 'NotoSansSC' in url): url = url.replace('https://cdn.jsdelivr.net/gh/google/fonts@main/', 'https://raw.githubusercontent.com/google/fonts/main/')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'qiaomu-font-pack'}), timeout=180) as r: return r.read()
        except Exception as e: err = e
    raise err
def build(data: bytes, chars: set, wght):
    font = TTFont(io.BytesIO(data))
    if wght and 'fvar' in font: font = instancer.instantiateVariableFont(font, {'wght': wght}, inplace=False)
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']; opts.name_IDs = ['*']; opts.notdef_outline = True; opts.drop_tables += ['DSIG']
    sub = subset.Subsetter(opts); sub.populate(unicodes=[ord(c) for c in chars]); sub.subset(font)
    out = io.BytesIO(); font.flavor = 'woff2'; font.save(out); return out.getvalue()

index = []; cache = {}
def one(id, family, en, mood, zh, hint, url, wght, cjk, lic, home):
    if os.path.exists(os.path.join(OUT, f'{id}.woff2')) and '--force' not in sys.argv:
        try: kb = round(os.path.getsize(os.path.join(OUT, f'{id}.woff2')) / 1024)
        except OSError: kb = 0
        index.append({'id': id, 'family': family, 'en': en, 'mood': mood, 'zh': zh, 'hint': hint, 'file': f'{id}.woff2', 'kb': kb, 'cjk': cjk, 'license': lic, 'home': home}); return
    try:
        data = cache.get(url) or get(url); cache[url] = data
        blob = build(data, CJK if cjk else LATIN, wght)
    except Exception as e:
        print('SKIP', id, e, file=sys.stderr); return
    open(os.path.join(OUT, f'{id}.woff2'), 'wb').write(blob)
    index.append({'id': id, 'family': family, 'en': en, 'mood': mood, 'zh': zh, 'hint': hint, 'file': f'{id}.woff2', 'kb': round(len(blob) / 1024), 'cjk': cjk, 'license': lic, 'home': home})
    print(f'{id:16} {len(blob)//1024:6} KB', flush=True)
for row in F: one(*row)
for id, fam, mood, zh, path, w in LATIN_F: one(id, fam, fam, mood, zh, '西文 · 标题', GF(path), w, False, 'OFL', 'https://fonts.google.com/specimen/' + fam.replace(' ', '+'))
json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
print(len(index), 'fonts,', sum(i['kb'] for i in index) // 1024, 'MB')
