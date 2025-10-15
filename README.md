# 小红书封面生成器

一个基于 Next.js 14 + Fabric.js 的在线小红书封面制作工具。

## ✨ 核心功能

- **画布编辑**：1242×1660px 标准小红书封面尺寸
- **文字高亮**：支持荧光笔、下划线、边框三种高亮样式
- **版本管理**：最多支持 5 个版本，可自由切换和复制
- **导出功能**：下载 PNG 图片或复制到剪贴板
- **自动保存**：每 2 秒自动保存当前版本

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm start
```

## 📁 项目结构

```
cover4xiaohongshu/
├── app/
│   ├── components/          # React 组件
│   │   ├── Header.tsx       # 头部组件
│   │   ├── VersionBar.tsx   # 版本栏组件
│   │   ├── Toolbar.tsx      # 工具栏组件
│   │   └── PropertyPanel.tsx # 属性面板组件
│   ├── page.tsx             # 主页面
│   ├── layout.tsx           # 布局
│   └── globals.css          # 全局样式
├── lib/
│   ├── types.ts             # 类型定义
│   ├── canvas-manager.ts    # 画布管理器
│   └── version-manager.ts   # 版本管理器
└── package.json
```

## 🛠️ 技术栈

- **框架**：Next.js 14 (App Router)
- **语言**：TypeScript
- **画布**：Fabric.js 5.3
- **样式**：Tailwind CSS
- **字体**：思源黑体、思源宋体

## 📖 使用说明

1. **添加文本**：点击左侧工具栏的"添加文本"按钮
2. **添加高亮文字**：在右侧属性面板输入文字，选择样式和颜色，点击"添加到画布"
3. **编辑文本**：双击画布上的文字进行编辑
4. **调整样式**：选中文字后，在右侧属性面板调整字号、字体、颜色
5. **版本管理**：点击顶部版本栏切换版本，点击"+"复制当前版本
6. **导出**：点击右上角"下载"或"复制"按钮

## 🎨 高亮样式

- **荧光笔**：半透明彩色背景
- **下划线**：文字下方彩色线条
- **边框**：文字周围彩色边框

## 💾 数据存储

所有版本数据自动保存在浏览器的 localStorage 中，无需担心数据丢失。

## 📄 License

MIT
