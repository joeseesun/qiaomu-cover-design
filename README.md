# Qiaomu Cover Design · 乔木封面设计

在 Obsidian 中，把笔记标题和选文做成封面。离线编辑，设计文件与 PNG 都保存在你的库内。

基于 [cover4xiaohongshu](https://github.com/joeseesun/cover4xiaohongshu) 改造，保留上游 Git 历史；插件代码采用原生 Obsidian FileView 与 Fabric.js 7 重新实现。[原项目分析与功能映射](docs/ANALYSIS.md)。

![由插件实际导出的封面](docs/preview.png)

## 功能

- **平台预设**：小红书 3:4 / 1:1、YouTube 缩略图、B 站、抖音 / 视频号、公众号头图、X 封面等；切换平台时内容按比例适配，并可显示平台安全区（时长标签、数据条等会遮挡的区域）。
- **字体**：读取本机全部已安装字体（支持中文名搜索、收藏、最近使用）；也可导入 TTF / OTF / WOFF / WOFF2 到库内字体文件夹，随库同步；缺失字体会提示。
- **10 个模板**，套用时保留你的标题与副标题；文字预设（荧光笔、描边、投影、标签）、形状、本地 / 库内 / 粘贴 / 拖入图片（超大图自动压缩）。
- 文字：字重、斜体、行高、字距、描边、阴影、底色；图片圆角、翻转、铺满；纯色与渐变背景；吸附参考线、对齐、图层拖拽排序、锁定、复制粘贴、右键菜单。
- **导出**：PNG / JPEG / WebP，1–3 倍，超出平台限制（如 YouTube 2MB）自动压缩；位置可选库内文件夹、笔记所在文件夹或系统文件夹；文件名模板；导出后可插入笔记、写入 `cover` 属性、复制到剪贴板。
- **对话面板**：所有操作已抽象为指令协议，当前提供离线中文 / 英文指令；其他插件可通过 `registerAssistant` 接入模型。
- `.qcover` 自动保存；撤销 / 重做；冲突不覆盖；乔木 Home 集成；中文 / English。

## 安装与使用

开发源码在 [`codex/obsidian-plugin`](https://github.com/joeseesun/qiaomu-cover-design/tree/codex/obsidian-plugin) 分支；首版安装包准备为 0.1.0 草稿 Release，官方预扫描完成后才公开。

开发版本安装：检出 `codex/obsidian-plugin` 分支，运行 `npm ci && npm run build`，将根目录的 `main.js`、`manifest.json`、`styles.css` 放入库的 `.obsidian/plugins/qiaomu-cover-design/`，在第三方插件中启用。

命令面板选择「新建封面」或「从当前笔记创建封面」。也可右键 Markdown 笔记创建。双击画布文字可直接输入，选中对象后在属性面板修改；打开库中的 `.qcover` 文件继续编辑。

设计默认放在 `Cover designs/`，PNG 默认放在 `Cover designs/Exports/`；均可在设置中修改。导出到来源笔记会在笔记末尾添加图片链接。重复导出创建新文件，不覆盖已有 PNG。

画布聚焦时：⌘/Ctrl+Z 撤销、Shift+⌘/Ctrl+Z 重做、⌘/Ctrl+D 复制、⌘/Ctrl+S 保存、Delete 删除、方向键移动，Shift+方向键移动 10px。文本编辑期间保留正常输入快捷键。

## 隐私与边界

无联网、账号、遥测、服务器或用户数据上传。默认不访问库外文件系统；仅当你选择「系统文件夹」导出时，才会写入你指定的库外目录（桌面端）。只接受 PNG/JPEG/WebP，单张不超过 10MB，图片内嵌于设计文件，可随库同步。设计中远程图片和 SVG 地址会被拒绝。

使用本机已安装字体或库内导入的字体，不下载字库；库内字体随库同步，系统字体换设备时可能不同。首版仅支持桌面端，最低 Obsidian 1.8.7。语言设置在重新打开设计标签页后生效。剪贴板取决于系统权限，失败时可使用 PNG 导出。

支持 AI 文案与版式候选、按需生成主体/背景图、Unsplash 搜索及内置字体；未移植网页的公开分享、手绘和路径编辑等全部能力。当前仍处于开发候选阶段，未提交或通过 Obsidian 官方目录审核。

## 开发

```sh
npm ci
npm run check
npm run dev
```

`check` 包含 lint、数据/安全/并发/i18n 测试与类型检查、生产构建。产物只外置 `obsidian`，不带 Next.js、Node/Electron、React 或任何远程加载代码。`npm ci` 安装的 Fabric 可选 Node canvas 不参与浏览器 bundle。

[测试与发布状态](docs/VERIFICATION.md) · [来源与许可](THIRD_PARTY.md) · [问题反馈](https://github.com/joeseesun/qiaomu-cover-design/issues)

MIT © 向阳乔木。


## AI 设计师（一句话出整版封面）

设置 → AI 设计师里填入 OpenAI 兼容接口或 Claude 的地址、密钥和模型名，即可在左侧「AI 设计」里粘贴一段话：模型会选平台、模板、文案和配色并自动排版；开启生图后还会生成背景或图位配图。内置 18 个模板（含数字干货、油管冲击、B 站热血、对比、金句卡、新粗野等）和按平台分组的起手提示词。命令「用 AI 把当前笔记 / 选中文字做成封面」可直接从笔记生成。

模型只能返回有限的画布指令（不能导出、读写文件）；文字与画布摘要只会发送到你填写的地址。不接入模型时插件完全离线。


## Offline asset pack

`assets/pack.json.gz` (Fluent Emoji Flat stickers, MIT, and Lucide line icons, ISC) must be installed beside `main.js` as `assets-pack.json.gz`. Rebuild it with `python3 scripts/build-asset-pack.py`.


## Bundled fonts

`assets/fonts/` (subset WOFF2 of open-licence fonts plus `index.json`) must be installed beside `main.js` as a `fonts/` folder. Rebuild it with `scripts/build-font-pack.py` (needs fonttools and brotli).

### AI 封面设计

输入主题或粘贴文章，先比较三个文案与版式预览，点击方案后应用到可编辑画布。默认不生成图片；在「配图可选」里选择「本次生成配图」，或应用方案后点击「添加配图」。图片服务配置与本次生成选择独立，正常排版处理不再逐条展示。
