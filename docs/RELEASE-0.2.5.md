# Qiaomu Design 0.2.5

- 设计、导出和字体目录可直接浏览选择，中心线默认关闭（保留已有选择）。
- 模型添加分为选择服务、连接账号、勾选模型三步，支持批量添加和保留草稿。ChatGPT/Codex、OpenRouter 与词元跳动提供账号登录入口；服务支持范围见 [AI 模型说明](AI-MODELS.md#账号登录)。
- 移除“让 AI 给封面配图”模块，生图仍从 AI 生图和明确的配图请求发起。
- Unsplash 增加免费图库介绍、申请链接和 Access Key 获取步骤，区分 App ID / AK / SK；可选代理默认收起。

保留旧模型的默认选择、别名、Seedream 版本参数和继承的服务连接。API Key 沿用库内插件设置存储，可能随设置同步；ChatGPT 凭据由 Codex CLI 管理。

验证：lint/typecheck/build；121 项完整自动测试及新增继承连接回归；10 项认证/设置定向测试；Obsidian 1.14.4 macOS 测试库的 18 项界面和持久化验收。OAuth 回调、PKCE、错误、取消、超时、迟到结果使用受控服务验证；第三方账号完整授权及付费生图未在本次执行。未验证 Windows/Linux。
