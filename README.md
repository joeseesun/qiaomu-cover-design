# Qiaomu Cover Design · 乔木封面设计

在 Obsidian 中，把笔记标题和选文做成封面。离线编辑，设计文件与 PNG 都保存在你的库内。

基于 [cover4xiaohongshu](https://github.com/joeseesun/cover4xiaohongshu) 改造，保留上游 Git 历史；插件代码采用原生 Obsidian FileView 与 Fabric.js 7 重新实现。[原项目分析与功能映射](docs/ANALYSIS.md)。

![由插件实际导出的封面](docs/preview.png)

## 功能

- 从当前笔记或选文创建封面，或独立新建；简约、杂志、醒目标题 3 个起始模板。
- 文字、荧光笔、下划线、文字描边，矩形、圆形，本地及库内图片。
- 拖动、缩放、旋转，字体、字号、颜色、透明度、对齐、图层顺序和锁定。
- 40 步会话内撤销/重做、复制对象及整个设计文件。
- 3:4、1:1、16:9、9:16、5:2 画布，按原生尺寸导出 PNG；可插入来源笔记、复制到剪贴板。
- `.qcover` 文件自动保存；冲突不覆盖原文件，关闭时另存恢复草稿。
- 乔木 Home 最近封面、新建及本地搜索；中文 / English。

## 安装与使用

开发源码在 [`codex/obsidian-plugin`](https://github.com/joeseesun/qiaomu-cover-design/tree/codex/obsidian-plugin) 分支；首版安装包准备为 0.1.0 草稿 Release，官方预扫描完成后才公开。

开发版本安装：检出 `codex/obsidian-plugin` 分支，运行 `npm ci && npm run build`，将根目录的 `main.js`、`manifest.json`、`styles.css` 放入库的 `.obsidian/plugins/qiaomu-cover-design/`，在第三方插件中启用。

命令面板选择「新建封面」或「从当前笔记创建封面」。也可右键 Markdown 笔记创建。双击画布文字可直接输入，选中对象后在属性面板修改；打开库中的 `.qcover` 文件继续编辑。

设计默认放在 `Cover designs/`，PNG 默认放在 `Cover designs/Exports/`；均可在设置中修改。导出到来源笔记会在笔记末尾添加图片链接。重复导出创建新文件，不覆盖已有 PNG。

画布聚焦时：⌘/Ctrl+Z 撤销、Shift+⌘/Ctrl+Z 重做、⌘/Ctrl+D 复制、⌘/Ctrl+S 保存、Delete 删除、方向键移动，Shift+方向键移动 10px。文本编辑期间保留正常输入快捷键。

## 隐私与边界

无联网、账号、遥测、服务器或用户数据上传。不访问库外文件系统；用户手动选择图片时由文件选择器读取该图片。只接受 PNG/JPEG/WebP，单张不超过 10MB，图片内嵌于设计文件，可随库同步。设计中远程图片和 SVG 地址会被拒绝。

使用本机已安装字体，不下载字库；换设备时字体差异可能影响版式。首版仅支持桌面端，最低 Obsidian 1.8.7。语言设置在重新打开设计标签页后生效。剪贴板取决于系统权限，失败时可使用 PNG 导出。

首版未移植网页的 AI 图像、抠图、云素材、公开分享、图片裁剪、手绘、路径编辑及完整字体库。不是网页全部功能的等价替代。当前仍处于开发候选阶段，未提交或通过 Obsidian 官方目录审核。

## 开发

```sh
npm ci
npm run check
npm run dev
```

`check` 包含 lint、数据/安全/并发/i18n 测试与类型检查、生产构建。产物只外置 `obsidian`，不带 Next.js、Node/Electron、React 或任何远程加载代码。`npm ci` 安装的 Fabric 可选 Node canvas 不参与浏览器 bundle。

[测试与发布状态](docs/VERIFICATION.md) · [来源与许可](THIRD_PARTY.md) · [问题反馈](https://github.com/joeseesun/qiaomu-cover-design/issues)

MIT © 向阳乔木。
