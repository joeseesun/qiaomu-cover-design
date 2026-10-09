# 平台打法库：小红书 / B 站 / YouTube 高点击封面方法论

本文是调研后的沉淀，对应代码 [src/playbook.ts](../src/playbook.ts)。AI 设计师的系统提示按当前平台注入对应打法；助手面板的“封面套路”画廊由同一份数据渲染。

## 一句话总纲
- **小红书**：3 秒内讲清“对我有什么用”。一个数字/关键词 + 一个主视觉，高对比，文字放上半部。
- **YouTube**：拇指大小的故事。一脸（或一物）+ 一句 3~5 词 + 一个悬念，黄白字加黑描边。
- **B 站**：内容感胜过营销感。明确主体、明亮、6~12 字“谁+做了什么+结果”，承诺必须兑现。
- **公众号 / X**：稳而有质感。公众号转发会裁成中间 1:1，关键内容放中央；X 左下角被头像挡住。

## 共同结构
1. 一个焦点，其余都是配角（见 DESIGN-PRINCIPLES.md）。
2. 文字短到可以在缩略图尺寸读完；字号层级 3~4 级。
3. 高对比 + 2~3 个主色，一个强调色。
4. 背景越简单，主体越突出；复杂背景虚化、压暗或替换。
5. 好奇缺口或具体数字，让人想点进去验证。
6. 封面和内容一致；固定字体与配色形成账号辨识度。

## 平台规则（带数字）
### 小红书
- 3:4（1080×1440）比横版多占约 40% 屏幕；整篇一种比例；点击率低于 6% 要换封面和标题。
- 主标题 3~7 字最好（≤12），副标题约 1/2~1/3；重要信息加红/黄色底框，周围留 ≥20% 空白。
- 暖色（陶土/焦糖/奶油）显可信；科技内容黑底加荧光色；固定 2~3 色。
- 封面类型：高质量单图、拼图合集、海报风、前后对比、纯文字（收藏型）、抠图拼贴。
- 避免：模板化堆砌、低质量随手拍、过度滤镜、混用比例、标题放底部。
### YouTube
- 1280×720；手机上 70%+ 的观看；文字 ≤3~5 词（MrBeast ≤12 字符）；白/黄字 + 8~15px 黑描边。
- 人脸约占 40%，夸张表情 + 直视镜头（有研究给出约 +38% 点击）；视觉元素 ≤3 个（一脸、一物、一问）。
- 主体比背景亮或暗 ≥30%；2~3 个互补色（黄/蓝/红）；饱和度拉高；背景纯色或渐变。
- 箭头、圆圈、遮挡制造好奇缺口；具体数字（$10,457）胜过“很多”；右下角留空给时长。
- 参考基准：游戏约 8.5%、娱乐 6%、金融 5.5%、教育 4.5%（行业均值，作为“好不好”的标尺）。
### B 站
- 16:10 封面；投稿 4:3 在信息流会被裁成 16:10，文字放中间；底部约 16% 被播放数据遮挡。
- 封面贡献的播放量被认为在 50% 以上；三要素：明确主体、明亮、加文字。
- 文字 6~12 字，“谁 + 做了什么 + 结果”；优先真实画面/关键帧；背景加半透明遮罩降饱和以托出主体。
- 零容忍封面欺诈；过度夸张的人物表情是常见错误；在手机首页小尺寸下检查可读性。
### 公众号 / X
- 头图 2.35:1（900×383 比例）；转发封面 1:1（500×500），中间裁切；次条小图 1:1；不要拿竖图当头图。
- X 横幅 5:2，左下角头像区不放字。

## 标题公式
- 小红书：数字榜单、痛点反转、身份+场景+方案、结果对比、亲测背书、收藏清单。
- 视频：谁做了什么结果、数字结果、悬念问句、A vs B、限制挑战、诚实测评。
- 横幅：观点型、深度长文、清单型。

## 封面套路（18 个，每个含版式、配色、装饰、主体画法）
| 平台 | 套路 |
| --- | --- |
| 小红书 | 数字干货 · 避坑警告 · 大字报 · 前后对比 · 清单笔记 · 生活种草 · 金句卡 |
| YouTube/B 站 | 表情冲击 · 产品评测 · 数字结果 · A 对 B · 知识科普 · 游戏高光 · 生活 Vlog · 教程步骤 |
| 横幅 | 杂志长文 · 科技深色 · X 横幅 |

套路是“起点不是笼子”：模型写了的字段会覆盖套路默认值，套路只补空缺（`expandPattern`）。

## 主体画法提示词（英文，写给生图）
- 表情冲击：`close-up of a fictional person with an exaggerated shocked expression, wide eyes, open mouth, looking straight at camera, bright studio lighting, cyan rim light`
- 产品评测：`macro hero shot of a single glossy product, dramatic rim light, floating, clean dark studio`
- 知识科普：`a single clear object that represents the topic, stylised 3D render, bright saturated colours, soft studio lighting`
- 游戏高光：`stylised hero character in a dynamic action pose, dramatic rim lighting, saturated neon colours`
- 生活种草：`a single hero product on a plain surface, soft diffused daylight, warm muted tones, natural shadow, shallow depth of field`
- 生活 Vlog（背景）：`bright candid lifestyle photograph, natural window light, warm tones, shallow depth of field, authentic and unposed`
- 教程步骤：`a clean illustrated laptop or app window floating at an angle, simple shapes, bright flat colours`
- 科技深色：`a friendly stylised 3D clay robot or a glowing floating code window, soft studio lighting, pastel colours`

插件会在这些提示后自动追加“纯色底、无文字、不要 logo”等规则（见 `SUBJECT_RULES`），主体在纯色底上生成再本地抠成透明图层。

## 来源
- 小红书：[封面设计公式与 CTR 门槛](https://zhuanlan.zhihu.com/p/30863774382)、[标题与封面爆款公式](https://www.niaogebiji.com/article-702559-1.html)、[封面创作逻辑](https://www.27sem.com/article/7348)、[图片设计最佳实践](https://www.huasheng.ai/insights/xiaohongshu-image-design/)
- B 站：[封面设计技巧](https://www.lovart.ai/zh/blog/zh-bilibili-cover-design)、[封面秘籍](https://blog.csdn.net/a332324956/article/details/110913771)
- YouTube：[10 条最佳实践](https://touhfa.art/blog/thumbnails/high-ctr-thumbnails-guide/)、[MrBeast 缩略图规则](https://touhfa.art/blog/thumbnails/mrbeast-thumbnail-article/)、[CTR 基准](https://www.thumbmagic.co/blog/youtube-thumbnail-ctr-benchmarks)
- 公众号：[头图与转发封面尺寸](https://www.canva.cn/learn/how-to-make-images-for-wechat-official-accounts/)

> 注：CTR 数字来自各篇文章引用的研究与行业统计，口径不一，作为方向参考，不应当成保证。
