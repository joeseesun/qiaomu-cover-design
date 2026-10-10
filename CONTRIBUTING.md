# 参与贡献 · Contributing

欢迎复现报告、文档修订和范围明确的 PR。较大的功能请先开 Issue 说明用户问题与预期结果。

1. 基于 `main` 新建分支，保持一次 PR 聚焦一个问题。
2. 使用 Node.js 22，执行 `npm ci --ignore-scripts` 和 `npm run check`。
3. 涉及界面时在独立 Obsidian 测试库验证，并附不含私人信息的截图；涉及保存、升级、导出时检查真实文件结果。
4. 修改用户文案时同步中文和英文；修改功能时同步 README。文档配图必须区分真实截图、实际输出和概念插图。
5. 不提交 API 密钥、`data.json`、私人笔记、缓存或个人路径。不要把 `npm run deploy` 当作通用安装脚本，它指向维护者 QA 环境。
6. 在 PR 中写明改动、验证和未验证范围；不要把跳过或历史测试说成本次通过。

字体与素材保留许可；完整包只通过 `npm run package` 生成。安全问题请先阅读 [SECURITY.md](SECURITY.md)，讨论遵循[行为准则](CODE_OF_CONDUCT.md)。

English: open focused PRs from a branch based on `main`. Use Node.js 22 and run `npm ci --ignore-scripts` followed by `npm run check`. Validate UI/file changes in a separate test vault, include sanitized evidence, maintain Chinese/English documentation, preserve third-party licenses, and never commit credentials or private vault data. State exactly what was and was not tested.
