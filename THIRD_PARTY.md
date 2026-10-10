# 来源与第三方许可

本项目由 [cover4xiaohongshu](https://github.com/joeseesun/cover4xiaohongshu) 改造，作者均为向阳乔木（joeseesun）。上游 README 标示 MIT，但未提供独立 LICENSE；本仓库补齐 MIT 许可文本并保留完整上游提交历史。插件运行时代码重新实现，历史中的网页源码仅供溯源，不参与构建。

- Fabric.js 7.4.0 — MIT — https://github.com/fabricjs/fabric.js 。生产 bundle 包含 Fabric.js，原始许可见 `node_modules/fabric/LICENSE`。
- qiaomu-home v1 协议 — MIT — Copyright (c) 2026 向阳乔木。原样来自个人技能的协议文件。
- Obsidian API — 宿主提供，构建不打包。https://github.com/obsidianmd/obsidian-api

## 默认字库

默认字库（[qiaomu-cover-fonts](https://github.com/joeseesun/qiaomu-cover-fonts)）中的 34 个字体均采用 SIL Open Font License 1.1，随插件分发、不单独出售。中文字体子集化为《通用规范汉字表》8105 字 + GB2312 并转为 WOFF2；声明了保留字体名、且保留名出现在字体名中的字体（抖音美好体）只提供未修改的原文件。每款字体的版权声明与完整许可文本见字库仓库与插件目录 `fonts/licenses/`。

思源黑体 / 思源宋体（Noto Sans SC / Noto Serif SC，Adobe 与 Google）· 朱雀仿宋（TrionesType）· 霞鹜文楷（LXGW）· 得意黑（atelier-anchor）· 抖音美好体（北京字节跳动）· 未来荧黑（welai）· 站酷庆科黄油体 / 站酷快乐体（站酷）· 江城圆体（刘鹏）· 猫啃什锦黑（猫啃网）· 铁蒺藜体（Buernia）· 马善政楷书 · 志莽行书 · 缝合像素字体（TakWolf）· Inter · Space Grotesk · Bricolage Grotesque · Unbounded · Anton · Bebas Neue · Archivo Black · DM Serif Display · Fraunces · Instrument Serif · Cormorant Garamond · JetBrains Mono · Caveat。

《通用规范汉字表》字表（`scripts/charset-8105.txt`）为教育部、国家语委 2013 年发布的规范汉字列表。

不打包上游素材、云上传 SDK、Next.js 或 React。

## 生图交互参考

[Poster Studio](https://github.com/joeseesun/poster-studio) commit `a5e991ccabf30edf50d5e7ce8a8a4f47728b1d1d` — MIT — Copyright (c) 2026 向阳乔木。参考其快捷提示词管理与图片改写工作流，插件使用独立实现和重新编写的中英提示词，不打包 React / Next.js 或网页服务端代码。

## 平滑笔迹

perfect-freehand 1.2.3 — https://github.com/steveruizok/perfect-freehand — MIT. 用于自由绘制的平滑轮廓与压感；随生产 bundle 打包，完整许可如下。

```text
MIT License

Copyright (c) 2021 Stephen Ruiz Ltd

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
