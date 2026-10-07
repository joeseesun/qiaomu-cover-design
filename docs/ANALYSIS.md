# 原项目分析与改造评估

调研日期：2026-10-07。结论：Go，改造为离线、笔记驱动的封面编辑器。

## 上游核对

仓库 https://github.com/joeseesun/cover4xiaohongshu ，默认 main，固定提交 `1a36a7fd53a607b04707209d4a04d4fe74f0d1c3`，最后提交日期 2025-10-29。README 声称 MIT，原仓库没有独立 LICENSE；作者和当前用户的 GitHub 账号均为 joeseesun。新仓库补充 MIT 并完整保留历史。仅静态分析上游，没有执行其服务器或上传素材。

README 描述 Next.js 14，package.json 实际使用 15.5.5 / React 19.1 / Fabric 5.3。网页约 4,500 行 canvas-manager 与大型 page.tsx 混合事件、状态、字体、上传和图层管理。原项目有 3:4、1:1、4:3、16:9、21:9、9:16 多尺寸，图片裁剪、文字高亮、图形属性、版本、模板、素材、AI 生成和分享，比 README 列出的能力丰富。

- `lib/canvas-manager.ts`：画布编辑、图层、撤销、裁剪、高亮。依赖七牛上传、素材库、React 转 SVG；构造时改变全局 body/html overflow、添加全局滚动监听。不能直接带入多标签 Obsidian 宿主。
- `lib/version-manager.ts`、`template-manager.ts`、`image-library.ts`：localStorage 持久化；不同 vault 无隔离，浏览器容量不足时有清理逻辑。迁移为可同步、可备份的库文件。
- `app/api/*`：AI、图生图、抠图、Unsplash、字体、素材共享、Vercel KV。依赖 Next 服务端及凭据，插件无对应服务器。
- `lib/types.ts`：字体列表涉及 Google Fonts、npm 中文字体和第三方 CDN。完整搬入会引入包体、离线和字体许可问题。
- `app/components/home/*`：网页面板和弹窗耦合 Tailwind/Radix/React，包含网页分享和赞助组件；只参考用户动作，重建原生视图。

## 官方及相近项目

| 依据 | 固定版本 / 许可 | 判断 |
| --- | --- | --- |
| [Obsidian sample](https://github.com/obsidianmd/obsidian-sample-plugin) | `07ceb81d1fb3384af611ebf665a1ec42a7e5926d`，0BSD | 核对 registerView、命令、设置、生命周期；独立实现 |
| [Obsidian API](https://github.com/obsidianmd/obsidian-api) | npm 锁定 SDK，最低宿主 1.8.7 | FileView / registerExtensions / Vault.process / createBinary / getLanguage |
| [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) | `f30b4c5d3dcb66ac76ced8f05d9e95409ee94c79`，AGPL-3.0，2.28.1，2026-10-03 | 成熟通用绘图，查看核心注册方式与 manifest；不复制源码，封面任务有独立价值 |
| [Fabric Canvas](https://fabricjs.com/api/classes/canvas/) | 7.4.0，MIT | 使用浏览器模块，弃用网页全局 hack；JSON 读写、交互、栅格导出 |
| [开发者政策](https://docs.obsidian.md/community-directory/developer-policies) | 本轮读取 | 离线、网络披露、许可与商标边界 |

GitHub 检索式 `obsidian image export`、`obsidian diagram editor`、`obsidian excalidraw`。前两者没有找到额外适合借鉴的封面编辑器；本轮没有对整个社区目录做穷尽检索。竞品问题列表和移动真机未全面核验。

## 复用与功能映射

| 网页能力 | 插件方案 |
| --- | --- |
| Fabric 5.3 | 升级 Fabric 7.4，运行时重新实现，显式左上坐标原点 |
| 文本 / 高亮 / 形状 / 对象变换 | Textbox、荧光笔、下划线、文字描边、矩形、圆形、旋转、颜色、不透明度 |
| 上传图片 | 本地 PNG/JPEG/WebP 或库内文件，嵌入为 data URL，单张上限 10MB |
| 多版本 | 复制整个设计文件；无限数量，40 步会话内撤销，重开后撤销历史不保留 |
| localStorage 自动保存 | `.qcover` 库文件、700ms 防抖、串行写入、Vault.process 防止冲突覆盖 |
| 网页模板 | 3 个独立实现的离线起始模板；已有文件不会被模板按钮清空 |
| 下载 / 复制 | 原生尺寸 PNG 写入库、来源笔记插入链接、系统剪贴板 |
| 云素材 / 分享 / 七牛 / AI / 抠图 | 首版暂不迁移，需明确服务配置、许可与网络隐私后单独设计 |
| 图片裁剪 / 图标库 / 手绘 / 高级路径 / 完整字体库 | 首版未实现，不声称与网页全功能等价 |

## 架构与差异化

主类型是 FileView + 导入导出。核心动作是从笔记标题或选文创建封面、编辑、导出回同一库。每个文件拥有自己的 canvas、尺寸和来源笔记路径；插件 data.json 只保存目录与语言。无账户、网络请求、遥测或服务器依赖。乔木 Home 可列出最近封面、新建和本地搜索；未加入 AI 入口。

来源笔记通过创建时捕获的路径定位，不使用导出时的 activeFile；插入用原生 Vault.process 和 FileManager 链接生成。打开文件前验证 schema、尺寸、深度及图片地址，拒绝远程 URL、SVG 或原型污染字段。同步冲突保留原文件并提示；不静默用默认设计覆盖坏文件。

声明桌面端，未测试的移动端不开放兼容。中英文词典跟随宿主或用户设置，重新打开视图生效。UI 用插件作用域黑白灰，无全局颜色或滚动改写。图片内嵌有文件大小代价，跨机器字体不一致会改变排版；使用两台设备相同已安装字体可减少差异。

## 验证计划

类型检查、lint、模型与并发测试；QA 库真实对象修改、撤销重做、PNG 魔数与 IHDR 尺寸、笔记链接、图片嵌入、关闭重开、失败不覆盖、Home、中英与暗色。Clipboard 权限、多窗口弹出和不同 OS 尚需单独验证。正式目录提交前需最终 SHA 官方 Preview Scan。
