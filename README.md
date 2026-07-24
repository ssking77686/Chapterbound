<p align="center">
  <a href="#中文">中文</a> | <a href="#english">English</a>
</p>

---

<h1 align="center">电子阅读器</h1>
<p align="center">一个基于 Web 的现代化电子书阅读应用，支持多种格式，采用可插拔架构。</p>

---

## 中文

### 简介

电子阅读器是一款 Web-first 的电子书阅读 PWA，支持 EPUB、PDF、TXT 等主流格式。采用**插件化架构**设计，所有功能模块独立注册，新增格式或功能只需实现对应接口即可，无需修改已有代码。

### 功能

- **书架管理** — 导入、浏览、删除电子书，自动提取封面和元数据
- **阅读进度** — 自动保存阅读位置，下次打开自动恢复
- **阅读设置** — 字号、字体、行间距实时调节，偏好持久化
- **明暗主题** — 手动切换或跟随系统，暖色调暗夜模式
- **自适应宽屏** — 支持 34 寸带鱼屏双页展开，响应式列数
- **书签** — 添加和管理书签，快速跳转
- **高亮与笔记** — 选中文字添加高亮标注，支持 CFI 精确定位
- **目录导航** — 解析书籍目录，一键跳转章节

### 支持的格式

| 格式 | 状态 |
|------|------|
| EPUB | 已完成 |
| PDF | 计划中 |
| TXT | 计划中 |
| AZW3 | 计划中 |

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 状态管理 | Zustand |
| 数据库 | Dexie.js (IndexedDB) |
| 样式 | Tailwind CSS v4 |
| EPUB 渲染 | epub.js |
| 动效 | motion |
| PDF 渲染 | pdf.js |
| 图标 | Lucide React |

### 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build
```

### 项目结构

```
src/
├── core/          # 接口定义 + ServiceRegistry（不可变核心）
├── adapters/      # 存储适配器（可替换）
├── engines/       # 阅读器引擎（可插拔）
├── parsers/       # 格式解析器（可插拔）
├── features/      # 功能插件（可插拔）
├── plugins/       # 插件注册入口
├── stores/        # Zustand 状态管理
├── hooks/         # React Hooks
└── components/    # UI 组件
```

### 许可

[MIT](LICENSE) © ahine Yang

---

## English

### Overview

E-Reader is a web-first eBook reading application supporting EPUB, PDF, TXT, and more. Built with a **plugin-based architecture**, all features and format engines are independently registered — adding a new format or feature means implementing an interface, with zero changes to existing code.

### Features

- **Library Management** — Import, browse, and delete books with automatic cover and metadata extraction
- **Reading Progress** — Auto-saves reading position, restores on next open
- **Reading Settings** — Real-time font size, family, and line spacing adjustment with persistence
- **Light/Dark Theme** — Manual toggle or follow system preference with warm dark palette
- **Ultrawide Support** — Dual-page spread on 34" monitors, responsive grid columns
- **Bookmarks** — Add and manage bookmarks with quick navigation
- **Highlights & Notes** — Select text to highlight with precise CFI positioning
- **Table of Contents** — Parse book TOC for one-click chapter navigation

### Supported Formats

| Format | Status |
|--------|--------|
| EPUB | Done |
| PDF | Planned |
| TXT | Planned |
| AZW3 | Planned |

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| State | Zustand |
| Database | Dexie.js (IndexedDB) |
| Styling | Tailwind CSS v4 |
| EPUB | epub.js |
| PDF | pdf.js |
| Animation | motion |
| PDF | pdf.js |
| Icons | Lucide React |

### Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build
```

### Project Structure

```
src/
├── core/          # Interfaces + ServiceRegistry
├── adapters/      # Storage adapters (swappable)
├── engines/       # Reader engines (pluggable)
├── parsers/       # Format parsers (pluggable)
├── features/      # Feature plugins (pluggable)
├── plugins/       # Plugin registration
├── stores/        # Zustand state management
├── hooks/         # React hooks
└── components/    # UI components
```

### License

[MIT](LICENSE) © ahine Yang
