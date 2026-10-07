# 0.1.0 验证与发布账本

2026-10-07，macOS，Obsidian 1.14.4，隔离的 qiaomu-home-dashboard-qa 测试库。

## 已通过

- `npm run check`：ESLint、6 个模型/并发/i18n/安全测试、TypeScript、生产 esbuild。
- `npm audit --omit=dev`：0 漏洞。完整开发依赖审计有 Obsidian SDK 带入的 moment 中危项；moment 不进入生产 bundle，不将 SDK 降级为旧版本。
- 浏览器 CJS bundle 约 305KB，仅 external Obsidian，无 Node/Electron/React/Next.js。Fabric MIT 全文保留在 bundle banner 与 licenses/。
- 真实库创建设计、添加文字/形状、撤销/重做、库文件读取，5 个对象保存。
- 导出 PNG IHDR 精确 960×1280，文件魔数正确；调整为 1500×600 后仍按原尺寸导出，不含预览缩放。
- 导出并插入来源笔记，已有正文保留，嵌入链接指向实际文件。
- PNG 图片内嵌，关闭重开后恢复图片与文字，路径冲突不覆盖，恢复文件真实创建。
- 非法设计原文保留，没有默认数据回写。
- 乔木 Home provider 最近文件、新建及本地搜索；无 Home 时主编辑流程可运行。
- 中文、英文界面，属性输入后焦点仍在原输入框，620px 区域没有横向溢出；浅色/深色截图与主按钮颜色检查。
- 新版 Fabric 原点显式 left/top；导出后的 viewport transform 和边界恢复，解决首次真实验收发现的偏移与 959px 导出。

QA 自动检查源码保留于 `tests/host/`，用技能的 host_eval.py 在 QA 库中运行。宿主截图未进入仓库，避免携带无关插件窗口内容。README 的 preview.png 是插件实际导出的封面。

## 宿主基线问题

首次验收捕获 `TypeError: e.isShown is not a function`，插件停用后仍重复出现，证明该次错误不随插件停用消失。冷启动 QA 窗口后重跑编辑/导出/重开/冲突/图片/语言流程，errors 均为空。没有将含该错误的首轮结果算作最终通过。此处不对根因作未经证明的归属。

## 尚未覆盖

Windows/Linux、移动真机、弹出多窗口、剪贴板系统权限、远程同步服务端冲突合并、大尺寸多图长期性能、输入法候选窗人工检查。自动 textarea 输入验证不等于真人输入法验证。

## 分发状态

本地源码、构建及 QA 安装已完成。源码放在 feature branch/PR；根 manifest 在官方预扫描缺证时暂不进入默认分支。0.1.0 tag 与 Draft Release 为安装审阅准备。官方 Preview Scan、正式目录审核、公开 Release 匿名下载、客户端索引/原生安装尚未确认。CI 结果与最终候选 SHA 见 PR 和 GitHub Actions；不是官方商店上架。
