# AI 模型与能力边界

[返回中文说明](../README.md#models) · [English guide](../README.en.md)

本文描述 **Qiaomu Design 0.2.1 的适配器实现**，不是对服务商当前售卖版本、价格或账号可用性的承诺。以服务控制台实际权限为准。以下参数表来自 `src/seedream.ts`、`src/jimeng.ts` 和对应测试；协议覆盖不等于所有版本都已运行付费端到端测试。

## 排版与图片服务分开配置

「设置 → 模型与服务」分为排版和生图两类。点击“添加模型”，先选服务，再登录或填写 API Key，最后搜索并勾选模型；可一次添加多个。高级接口地址默认收起。可设置默认模型及显示别名。别名不会改写请求模型 ID；编辑其他配置不会自动切换默认模型。

添加模型时，支持“全选当前结果”和“清空选择”；搜索、刷新列表及返回连接步骤不会清空已选项。底部显示待添加数量，以及有多少已选项不在当前搜索结果中。相同服务地址、账号凭据和模型 ID 的已有配置标记为“已添加”，不能重复勾选；手动填写同一 ID 也不会覆盖原配置。列表超过 150 项可点“显示更多”，全选覆盖全部匹配结果；超过剩余容量时会提示缩小范围，不会静默只选一部分。

新增模型保留已有默认模型、别名与参数；首次配置才将第一个选中的模型设为默认。编辑单个模型仍为单选。排版、生图各最多保存 100 个模型。

排版模型提供文案、模板与受限画布指令。图片服务输出位图。Codex CLI 需要本机环境及账户；云服务需要自己的权限与额度，插件不附赠额度。

## 账号登录

- ChatGPT / Codex：安装本机 Codex CLI 后，点击“登录 ChatGPT / Codex”在浏览器授权。凭据与续期由 Codex 管理，可用于排版和生图；插件不读取浏览器登录信息。
- OpenRouter：排版和生图都支持 OAuth PKCE 登录，也可填写已有 API Key。
- 词元跳动：排版支持授权登录或 API Key。
- 其他 API 服务：填写该服务的 API Key。登录不代表免费，模型权限与费用以服务商账号为准。

可取消正在进行的登录；关闭窗口会取消本次等待，迟到的结果不会保存。API Key 与模型配置沿用库内插件设置存储，同步或备份插件设置时可能复制；ChatGPT 凭据交由 CLI 管理。

## Seedream / 火山方舟

| 版本适配 | 参考图片 | 组图 | 分辨率档位 | 版本能力 |
| --- | --- | --- | --- | --- |
| 3.0（兼容） | 不支持 | 不支持 | 指定像素 | 随机种子、提示词权重 |
| 4.0 | 最多 14 张 | 参考图 + 结果合计 ≤15 | 1K / 2K / 4K | 标准 / 快速提示词优化 |
| 4.5 | 最多 14 张 | 同上 | 2K / 4K | 标准提示词优化 |
| 5.0 Lite | 最多 14 张 | 同上 | 2K / 3K / 4K | 联网搜索、PNG / JPEG |
| 5.0 Pro / Flash | 最多 10 张 | 单图 | 1K / 1.5K / 2K | PNG / JPEG、透明原图编辑、图层拆分；Pro 还支持快速优化 |

接入点 ID 可在生图选项中指定实际版本，并保存在该模型配置里。界面根据版本显示合法参数，支持相应的自定义像素、URL/Base64 返回、水印选项，并检查像素与比例限制。

参考图入口接受 PNG/JPEG/WebP。透明编辑要求一张透明 PNG；拆层要求一张 PNG/JPEG。拆层结果按返回的层序与边界框恢复为组合，解组后可移动、缩放、旋转；这些层仍是图片，不是可编辑文字或矢量路径。组图数量是请求上限，实际张数依服务返回；部分失败时保留成功结果并显示原因。

当前请求采用非流式处理，等待计时不等于服务端精确完成进度。

## 即梦兼容服务

兼容配置可识别 jimeng-api 地址或国内图片模型 ID，按支持的比例发送 `ratio`，默认 `resolution: 2k`，可选 1K / 2K / 4K。列表保留接口模型并补充后端映射候选，排除视频；候选出现不代表账户已开通。

生图与参考编辑使用独立协议。参考编辑调用 `/images/compositions`，最多 10 张参考图；URL 走 JSON，本地图片走 multipart。它不是 Seedream 请求字段的替代名，也不是即梦客户端或网页自动化。

同一请求返回的图片归于一个任务，可多选插入。HTTP 200 内的业务错误、401、429 和图片下载错误都会保留，不自动重发生成 POST。

## 预览、替换与费用

1. 提示词预设只填草稿，确认生成才发送。
2. 默认留在弹窗等待；可主动放到后台。
3. 结果先预览，再选择插入或替换。
4. “继续创作”将所选结果作为下一轮参考，输入新指令后再次提交。
5. 失败请求不自动重提；本机关闭或重载不保证服务端取消或退款。

替换文字、形状或组合选区会产生一张位图；用撤销恢复原对象。为保留编辑能力，可以插入副本。

## 验证级别

0.2.1 发布记录包含 Seedream 5.0 Lite 与即梦 4.5 的真实生图和参考编辑验收。其他版本具有协议/参数测试；Codex 图片编辑尚未完成记录中的实测认证。此文档更新没有重新执行收费生成请求。

## English summary

This is an adapter capability table for plugin 0.2.1, not a current vendor availability or pricing statement. Configure layout and image models separately and supply your own accounts. Reference counts, resolution options and special operations depend on the selected adapter/version. Seedream decomposition still yields bitmap layers. Jimeng reference editing uses its own compositions endpoint. All results are reviewed before insertion/replacement; replacing text or vector selections rasterizes them. Paid failures are not automatically resubmitted. The release record verifies Seedream 5.0 Lite and Jimeng 4.5; other versions have protocol coverage, and Codex image editing remains unverified.
