<p align="center">
  <a href="./README.md">← 返回用户文档</a> | <a href="./README_EN.md">← Back to English README</a>
</p>

# 开发者文档

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 状态管理 | Zustand |
| 存储 | Dexie.js (IndexedDB) |
| 样式 | Tailwind CSS v4 |
| 渲染 | epub.js |
| 动效 | motion (formerly framer-motion) |
| 图标 | Lucide |

## 开发命令

```bash
npm install
npm run dev       # 开发服务器（默认 http://localhost:5173）
npm run build     # tsc -b + vite build
npm run preview   # 预览生产构建
npm run lint      # oxlint 代码检查
```

## 目录结构

```
src/
├── core/           # 共享类型、ServiceRegistry 单例、五大抽象接口
├── adapters/       # 存储适配器（IndexedDBAdapter）
├── engines/        # 阅读引擎（EpubEngine）
├── parsers/        # 元数据解析器（EpubParser）
├── features/       # 功能插件（预留扩展点）
├── stores/         # Zustand store（5 个独立 store）
├── hooks/          # React hooks（useReader, useKeyboard, useTheme）
├── components/     # UI 组件（LibraryPage, ReaderPage, AboutOverlay）
└── plugins/        # 应用启动注册（default-plugins）
```

## 架构

插件化设计——引擎、解析器、存储、功能模块全部通过 `ServiceRegistry` 独立注册，不修改核心代码即可扩展。

### 核心层 (`src/core/`)

- `types.ts` — 共享类型：`BookRecord`, `Bookmark`, `Highlight`, `ReadingProgress`, `TOCItem`, `CompendiumEntry` 等
- `registry.ts` — `ServiceRegistry` 单例，管理引擎/解析器/存储/功能插件的注册和查询，支持拓扑排序激活
- `interfaces/` — 五个抽象接口：`IReaderEngine`, `IStorageAdapter`, `IBookParser`, `IFeaturePlugin`

### 状态管理 (Zustand)

五个独立 store：

| Store | 职责 |
|-------|------|
| `bookshelfStore` | 书架列表、导入/删除书籍 |
| `bookmarkStore` | 书签 CRUD，按 bookId 过滤 |
| `highlightStore` | 高亮 CRUD，支持备注 |
| `progressStore` | 阅读位置保存/加载，按 bookId |
| `compendiumStore` | 图鉴导入/加载/解锁/查看 |

### 设计系统

暖色系配色（参考 Apple Books），所有颜色通过 CSS 自定义属性管理：

| 变量 | 亮色 | 暗色 |
|------|------|------|
| Page bg | `#F5F1EA` | `#2B2420` |
| Text | `#3C3226` | `#F5EFE6` |
| Accent | `#B87C4B` | `#D4996A` |

圆角卡片（16px），暖色调阴影。

### 动效

motion/react 提供，三套 spring 配置：
- `springDefault`: bounce 0, duration 0.3s（UI 进出）
- `springPress`: bounce 0, duration 0.2s（按钮点击反馈）
- `springSlide`: bounce 0.15, duration 0.3s（侧栏滑入）

### 已知问题

- **epub.js 分页**：部分书籍只显示 1-2 页。EPUB 引擎通过 CSS columns 渲染，初始渲染时若容器高度为 0，columns 会坍缩。`useReader` 中的 ResizeObserver 处理了 post-render resize，但初始渲染时序敏感。
- **epub.js 类型**：`EpubEngine.ts` 和 `EpubParser.ts` 中有 5 处 `as any` 转换。epub.js v0.3.93 的 TypeScript 定义不完整，`currentLocation()` 返回值和 `metadata` 属性未类型化。
- **功能插件是骨架**：`src/features/` 下的 4 个插件注册了生命周期钩子但没有 UI 扩展。插件系统已接线但未使用。
- **仅支持 EPUB**：尚无 PDF 或 TXT 引擎，`registry.getEngine()` 对非 EPUB 格式返回 `undefined`。

### 关键模式

**翻页动画**：阅读卡使用 `useAnimate` hook 触发翻页动画，而非通过改变 `key` prop 来重挂载组件。给 motion.div 改 key 会销毁并重建 epub.js iframe，破坏整个阅读器。

**epub.js 引擎生命周期**：`EpubEngine.load()` 创建 Book 和 Rendition，渲染到传入的容器，触发 `'ready'` 事件。在 `'relocated'` 时触发 `locationChange`（含 cfi、progress、page、total）。清理时务必调用 `destroy()`——它会销毁 rendition 和 book。

**章节检测**：`getChapterMap()` 通过递归遍历 TOC 树，将 TOC 项的 `href` 映射到 epub.js spine index，生成 `章节号 → spine索引` 的双向映射。这个映射被图鉴系统用于自动检测当前章节。
