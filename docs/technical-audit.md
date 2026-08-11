# 代码库技术审计档案

> 长期维护的代码健康参考文档。覆盖错误处理惯例、数据持久化细节、已知风险模式、代码库导航索引。适合新贡献者快速了解代码库的边界情况和潜在问题。
>
> **维护原则：** 记录模式而非行号（行号会过时），解释"为什么是问题"让未来维护者自行判断是否仍然适用。
>
> **最近更新：** 2026-08-11 — P0/P1/P2 风险大部分已修复，图鉴渲染性能已优化，详见 §4 标注。

---

## 1. 错误处理惯例

### 1.1 整体策略：静默降级

代码库采用**静默降级为主**的错误处理哲学——出错时返回安全默认值，不中断用户操作。这是一种刻意选择，而非遗漏。

**降级值约定：**

| 层级 | 出错返回值 | 示例 |
|------|-----------|------|
| 引擎方法（EpubEngine） | `''` / `0` / `null` / `[]` | `getCurrentLocation()` → `''`，`getProgress()` → `0`，`getCover()` → `null` |
| 解析器（EpubParser） | `null` | `getCover()` / `extractCover()` → `null` |
| 存储适配器 | `null` | 所有 `get*()` 方法返回 `null` 表示未找到 |
| Store 加载 | 默认值 | settings → `defaults`，onboarding dismissed → `false` |

**设计意图：** 电子书阅读器的核心路径（翻页、渲染）不应因辅助功能（封面提取、TOC 映射、进度保存）的失败而中断。

### 1.2 try/catch 分布

代码库共约 16 个 try/catch 块，按处理方式分：

| 处理方式 | 数量 | 典型场景 |
|----------|------|---------|
| 返回默认值继续 | ~10 | 引擎/解析器的 getter 方法 |
| 设置 UI 错误状态 | 2 | useReader 加载失败、ReaderPage JSON 导入失败 |
| 降级后重试 | 1 | EpubEngine 渲染时 corrupt CFI → 回退 display() |
| 完全忽略 | ~3 | storage 写入 fire-and-forget、onboarding localStorage |

**模式识别：** 引擎层和解析器层的 try/catch 几乎全是"返回默认值"模式。UI 层的错误提示集中在两个入口（`useReader` 初始化、图鉴 JSON 导入），其他 UI 操作没有错误反馈。

### 1.3 Promise Rejection 处理

- **启动阶段：** `main.tsx` 的 `initializeApp().catch()` 是唯一的全局守卫——仅在 IndexedDB 完全不可用时显示"应用启动失败"
- **运行时 Promise：** 大量 store 方法（`loadBooks`、`importBook`、`removeBook`、`updateCover`、`loadBookmarks`、`loadHighlights`）在组件中直接调用，**没有 `.catch()`**，失败会变成 unhandled rejection
- **Fire-and-forget：** 翻页进度保存（`useReader` 中每次 `relocated` 事件触发 `saveProgress`）既不 await 也不 catch，是最高频的无保护异步写入

### 1.4 TypeScript 严格度

`tsconfig.app.json` 中**未启用 `strict`、`strictNullChecks`、`noUncheckedIndexedAccess`**。编译器不会标记潜在的 null/undefined 访问。

代码库手动使用 `?.` / `??` / `?? []` 进行补偿，覆盖度在适配器层和引擎层较完整，但在组件渲染路径上存在缺口（详见 §4.1）。

---

## 2. 数据持久化全景

### 2.1 存储架构

```
┌─────────────────────────────────────────────────────┐
│  React 组件                                          │
│    ↓ 调用                                            │
│  Zustand Store（内存缓存）                            │
│    ↓ await registry.getStorage()                     │
│  IndexedDBAdapter（Dexie.js 封装）                    │
│    ↓                                                 │
│  IndexedDB: EBookReader                              │
│    ├── books          (id, format, addedAt, lastReadAt)│
│    ├── files          (id → ArrayBuffer)              │
│    ├── bookmarks      (id, bookId, createdAt)         │
│    ├── highlights     (id, bookId, createdAt)         │
│    ├── readingProgress (bookId)                       │
│    ├── kvStore        (key → unknown)                 │
│    └── compendium     (id, bookId, category) [v2]     │
│                                                       │
│  localStorage（旁路，不用 zustand persist 中间件）      │
│    ├── ereader-settings      → ReaderSettings JSON    │
│    └── ereader-onboarding-dismissed-v1 → 'true' | null│
└─────────────────────────────────────────────────────┘
```

### 2.2 Dexie 版本历史

| 版本 | 新增 | 迁移回调 |
|------|------|---------|
| v1 | 6 张表（books, files, bookmarks, highlights, readingProgress, kvStore） | 无 |
| v2 | 新增 compendium 表 | **无** — 旧用户升级时表自动创建，无数据迁移逻辑 |

**注意：** 版本升级声明中只有索引定义，没有 `upgrade()` 函数。如果未来某表需要改数据结构（加字段、改类型），需要通过 `upgrade()` 处理旧数据。当前所有字段向后兼容，所以没问题。

### 2.3 数据流调用链

```
用户操作 → 组件事件处理函数
  → store 方法（zustand action）
    → await registry.getStorage().someMethod()
      → await this.db.<table>.<dexieOp>()
        → store.setState() 更新 UI
```

Store 方法遵循"先写后更新 UI"模式：只在 IndexedDB 写入成功后更新 React 状态。读操作从 IndexedDB 加载后写入 store 的 in-memory state。

### 2.4 多步写入非原子操作

以下操作包含多个独立的 IndexedDB 写入，没有被 Dexie 显式事务包裹：

| 操作 | 步骤数 | 失败影响 |
|------|--------|---------|
| `deleteBook` | 6 步（books→files→bookmarks→highlights→progress→compendium） | 中途失败留下孤儿行 |
| `importCompendium` | 3 步（delete→bulkPut→kvDelete） | delete 成功但 bulkPut 失败 → 该书的图鉴变空 |
| `importBook`（importBook store 方法） | 2 步（saveFileData→saveBook） | saveFileData 成功但 saveBook 失败 → 文件二进制孤儿 |

### 2.5 localStorage 使用模式

- **settingsStore：** 读写 `ereader-settings`。`load()` 有 try/catch 保护（损坏数据回退默认值），但 `save()` **没有 try/catch**——QuotaExceededError 会直接抛出
- **onboardingStore：** 读写 `ereader-onboarding-dismissed-v1`。读写都有 try/catch，存储布尔值字符串 `'true'`
- **版本化：** 仅 onboarding 的 key 名称有 `-v1` 后缀。settings 无存储版本号，通过 `pageTheme` 缺失检测做了一次迁移

### 2.6 数据恢复/校验机制

**当前没有：**
- 数据完整性校验
- 备份/导出/恢复功能
- 损坏数据的修复路径
- Dexie 的 `on('error')`、`on('blocked')`、`on('versionchange')` 均未注册

**隐式恢复：** settings 的 `load()` 在 JSON 损坏时回退到默认值，下次用户修改设置时 `save()` 会覆盖损坏数据。这是一种被动的自愈。
- `getUsageInfo()` 方法已实现但从未被调用——存储配额的监控是死代码

---

## 3. 用户反馈机制

### 3.1 现有的错误提示入口

| 入口 | 触发场景 | 用户看到什么 |
|------|---------|------------|
| `main.tsx` 启动失败 | IndexedDB 完全不可用 | 全屏静态提示："应用启动失败 / 请检查浏览器是否启用了 IndexedDB 存储" |
| `ReaderPage` 加载失败 | 书籍引擎初始化失败 | 内联提示："加载失败：{错误原文}" + "返回书架"按钮 |
| `ReaderPage` JSON 导入 | 图鉴 JSON 导入失败 | 红色文字："导入失败，请检查 JSON 格式"（3 秒消失） |
| `ReaderPage` JSON 导入成功 | 图鉴 JSON 导入成功 | 绿色文字："导入成功"（2 秒消失） |

**不存在的通用组件：**
- 没有 Toast / Snackbar / Notification 组件
- 没有 Modal 确认/错误对话框
- 没有 React Error Boundary（渲染崩溃 → 白屏）
- 没有 `unhandledrejection` 全局处理器
- 没有 `aria-live` / `role="alert"` 无障碍错误提示

### 3.2 各页面的加载态/空态/错误态覆盖

| 页面/组件 | 加载态 | 空态 | 错误态 |
|-----------|--------|------|--------|
| LibraryPage（书架） | "加载中…" | "书架是空的…" | **无** |
| ReaderPage（阅读器主体） | — | — | "加载失败…" |
| ReaderPage 书签面板 | **无** | "还没有书签哦…" | **无** |
| ReaderPage 图鉴面板 | **无** | "暂无图鉴数据" / "未找到匹配条目" / "继续阅读以发现…" | 导入失败提示（仅有） |
| AboutOverlay | — | — | — |
| OnboardingOverlay | — | — | — |

"**无**" 表示该场景下如果异步操作失败，用户不会看到任何反馈，UI 保持之前的状态不动。

### 3.3 日志现状

整个 `src/` 仅 5 处 `console.*` 调用：

| 级别 | 数量 | 说明 |
|------|------|------|
| `console.log` | 1 | EpubEngine 每次翻页打印 spineIndex（调试残留） |
| `console.warn` | 2 | 引擎/解析器被重复注册时警告 |
| `console.error` | 2 | 图鉴 JSON 导入失败、启动失败 |

没有日志工具类、没有分级、没有生产环境日志过滤。

---

## 4. 风险清单

### 4.1 崩溃风险（可能导致白屏或应用不可用）

| 风险 | 为什么是问题 | 涉及模块 | 状态 |
|------|-------------|---------|------|
| 无 React Error Boundary | 任何渲染期异常 → 整棵树卸载 → 白屏 | `ErrorBoundary.tsx` + `main.tsx` | 已修复 |
| 无 unhandledrejection 处理 | 所有未 catch 的异步异常静默丢失 | `main.tsx` | 已修复 |
| 图鉴 JSON 导入无运行时结构校验 | 缺失字段导致渲染/search 时崩溃 | `compendiumStore.validateImportData` | 已修复 |
| localStorage 设置无类型校验 | 非法类型值流入 DOM | `settingsStore.load()` | 已修复 |
| `settingsStore.save()` 无 try/catch | QuotaExceededError 穿透到事件处理器 | `settingsStore.save()` | 已修复 |
| 图鉴列表无上限渲染 | 条目多时全部 DOM 节点 + 图片一次性渲染，stagger 动画 `delay: i * 0.04` 线性增长导致界面假死 | `ReaderPage.tsx` 图鉴面板 | 已修复：搜索防抖（>50条 150ms）、无限滚动（每批 50）、动画延迟上限 0.5s、图片懒加载、关联计数 useMemo |

### 4.2 数据完整性风险

| 风险 | 为什么是问题 | 涉及模块 | 状态 |
|------|-------------|---------|------|
| `deleteBook` 无事务 | 6 步独立写入，中途失败 → 数据不一致 | `IndexedDBAdapter.deleteBook` | 已修复：用 `db.transaction()` 包裹 |
| `importCompendium` 无事务 | delete 成功但 bulkPut 失败 → 图鉴永久丢失 | `IndexedDBAdapter.importCompendium` | 已修复：用事务包裹 |
| `importBook` 两步非原子 | saveFileData 成功但 saveBook 失败 → 孤儿文件 | `bookshelfStore.importBook` | 已修复：catch 中调用 deleteFileData 回滚 |
| 翻页进度写入无错误处理 | 每次翻页 saveProgress，不 await 不 catch | `useReader` relocated 事件 | 已修复：加节流（1s）+ `.catch()` |
| Dexie 无错误回调 | IndexedDB 异常无法追踪 | — | 已撤销：Dexie 4.x 构造函数中 `db.on()` 不可用，`unhandledrejection` 兜底 |

### 4.3 静默失效风险

| 风险 | 为什么是问题 | 涉及模块 | 状态 |
|------|-------------|---------|------|
| `App.tsx` 中 `ensureTestData` 吞错 | 测试书播种失败 → 引导永远不显示，无提示 | `App.tsx` | 已修复：加 `console.warn` |
| `LibraryPage` 操作无错误反馈 | importBook/removeBook 失败 → UI 不动 | `LibraryPage` | 已修复：加 toast.error |
| 书签/高亮加载无错误处理 | 加载失败时列表一直为空 | `ReaderPage` useEffect | 保持静默（非关键路径，不打扰用户） |
| `useReader` 中 `loadCompendium` 吞错 | 图鉴加载失败 → 空数据 | `useReader` | 保持静默（非关键路径） |
| `bookshelfStore.importBook` 元数据解析失败静默降级 | EPUB 解析失败用文件名当标题 | `bookshelfStore.importBook` | 设计如此（降级可用优于报错） |
| `EpubEngine` 调试日志残留 | 每次翻页打印 console.log | `EpubEngine.ts` | 已修复：已注释 |

---

## 5. 代码库快速索引

### 5.1 模块职责速查

| 文件 | 职责 | 关键导出 |
|------|------|---------|
| `src/main.tsx` | 应用入口：初始化插件 → 渲染 React | `initializeApp()` |
| `src/App.tsx` | 根组件：页面路由（书架/阅读器）、引导触发、测试数据播种 | `App` |
| `src/core/registry.ts` | IoC 容器：注册/获取引擎、解析器、存储适配器、功能插件 | `ServiceRegistry` |
| `src/core/types.ts` | 所有共享 TypeScript 类型定义 | `BookRecord`, `Bookmark`, `CompendiumEntry` 等 |
| `src/core/interfaces/` | 4 个抽象接口：`IReaderEngine`、`IBookParser`、`IStorageAdapter`、`IPlugin` | 接口定义 |
| `src/adapters/IndexedDBAdapter.ts` | Dexie.js 封装，实现 `IStorageAdapter` | `IndexedDBAdapter` |
| `src/engines/EpubEngine.ts` | epub.js Book + Rendition 封装，实现 `IReaderEngine` | `EpubEngine` |
| `src/parsers/EpubParser.ts` | EPUB 元数据/封面提取，实现 `IBookParser` | `EpubParser` |
| `src/plugins/default-plugins.ts` | 启动时注册所有适配器/引擎/解析器到 registry | `initializeApp` |
| `src/features/` | 功能插件骨架（空壳，生命周期钩子已注册、无 UI） | `BookshelfPlugin` 等 |
| `src/stores/bookshelfStore.ts` | 书架：导入/删除书籍、封面管理 | `useBookshelfStore` |
| `src/stores/bookmarkStore.ts` | 书签：5 色书签 CRUD、按书过滤 | `useBookmarkStore` |
| `src/stores/highlightStore.ts` | 高亮：文本高亮 CRUD、备注编辑 | `useHighlightStore` |
| `src/stores/progressStore.ts` | 阅读进度：按 bookId 读写位置（CFI + 百分比） | `useProgressStore` |
| `src/stores/settingsStore.ts` | 阅读设置：字体/行高/主题/图鉴缩放，持久化 localStorage | `useSettingsStore` |
| `src/stores/compendiumStore.ts` | 图鉴：导入/搜索/章节解锁/条目管理 | `useCompendiumStore` |
| `src/stores/onboardingStore.ts` | 引导：步骤状态、localStorage 持久化、跨页面导航 | `useOnboardingStore` |
| `src/stores/toastStore.ts` | Toast 通知：auto-dismiss、success/error/info 三类型 | `useToastStore` |
| `src/hooks/useReader.ts` | 阅读器核心 hook：引擎生命周期、进度/图鉴联动 | `useReader` |
| `src/hooks/useTheme.ts` | 主题 hook：明暗切换 | `useTheme` |
| `src/hooks/useKeyboard.ts` | 键盘快捷键 hook | `useKeyboard` |
| `src/components/LibraryPage.tsx` | 书架页面：书籍列表、导入/删除/封面操作 | `LibraryPage` |
| `src/components/ReaderPage.tsx` | 阅读器页面：渲染区 + 设置/书签/高亮/图鉴/目录侧边栏 | `ReaderPage` |
| `src/components/OnboardingOverlay.tsx` | 引导覆盖层：9 步引导、高亮定位、跳过/永久关闭 | `OnboardingOverlay` |
| `src/components/AboutOverlay.tsx` | 关于页面：项目信息、贡献者 | `AboutOverlay` |
| `src/components/ErrorBoundary.tsx` | React 错误边界：捕获渲染期异常，显示友好恢复页面 | `ErrorBoundary` |
| `src/components/ToastContainer.tsx` | Toast 通知容器：固定顶部居中，motion 动画进出 | `ToastContainer` |
| `src/data/project-info.ts` | 项目元数据：名称、版本、仓库地址、贡献者 | `projectInfo` |
| `electron/main.cjs` | Electron 主进程：BrowserWindow 创建、dev/prod 模式切换 | — |
| `src-tauri/src/lib.rs` | Tauri Rust 后端：WebView 配置、debug 日志插件 | — |

### 5.2 关键调用链速查

**导入一本书：**
```
LibraryPage.handleImport (file input onChange)
  → bookshelfStore.importBook(file)
    → EpubParser.getMetadata(buffer)         // 提取元数据
    → IndexedDBAdapter.saveFileData(id, buf) // 存二进制
    → IndexedDBAdapter.saveBook(record)      // 存元数据记录
    → bookshelfStore.loadBooks()             // 刷新列表
```

**打开一本书进入阅读：**
```
App.tsx: setReadingBookId(id) → <ReaderPage bookId={id}>
  → useReader(bookId).init()
    → IndexedDBAdapter.getFileData(id)       // 读二进制
    → EpubEngine.load(data, container)       // 创建 Rendition
    → progressStore.loadProgress(id)         // 恢复上次位置
    → compendiumStore.loadCompendium(id)     // 加载图鉴数据
```

**翻页时的连锁反应：**
```
EpubEngine: rendition.on('relocated', ...)
  → useReader 事件回调:
    → progressStore.saveProgress(bookId, cfi, progress)  // 保存进度
    → compendiumStore.checkUnlock(bookId, spineIndex)    // 检查解锁
      → IndexedDBAdapter.saveCompendiumChapter(...)       // 持久化章节进度
```

**修改一个设置项：**
```
ReaderPage 设置面板 onChange
  → settingsStore.updateSettings({ fontSize: 18 })
    → save(next) → localStorage.setItem('ereader-settings', JSON.stringify(next))
```

**错误反馈流程：**
```
组件 catch 异常
  → useToastStore.getState().toast(msg, 'error')
    → toastStore 写入 toast 条目 → auto-dismiss 定时器
    → ToastContainer（AnimatePresence）渲染/动画/退出
```

### 5.3 常见修改场景导航

| 场景 | 涉及文件 |
|------|---------|
| 加一个新设置项 | `types.ts`（如需要）、`settingsStore.ts`（default + interface）、`ReaderPage.tsx`（UI 控件） |
| 加一种新的书签颜色 | `types.ts`（如果颜色是枚举）、`bookmarkStore.ts`、`ReaderPage.tsx`（书签渲染和选择器） |
| 加一个新的存储表 | `IndexedDBAdapter.ts`（DB 类 + 新 version + 方法）、`IStorageAdapter.ts`（接口）、`types.ts`（类型） |
| 加一个新的引导步骤 | `OnboardingOverlay.tsx`（步骤定义数组 + 渲染逻辑）、`onboardingStore.ts`（如需要新状态） |
| 加一个 toast/通知组件 | `src/components/` 新建文件、各页面引入使用 |
| 加 Error Boundary | `src/components/` 新建文件、`main.tsx` 包裹 `<App/>` |
| 修改电子书渲染行为 | `EpubEngine.ts`、`useReader.ts`、`ReaderPage.tsx`（阅读器容器和控件） |
| 修改 EPUB 元数据提取 | `EpubParser.ts`、`bookshelfStore.ts`（importBook 中使用解析结果的逻辑） |
| 修改数据导入导出逻辑 | `compendiumStore.ts`、`IndexedDBAdapter.ts`（importCompendium）、`ReaderPage.tsx`（导入 UI） |

---

## 6. 维护说明

- **更新频率：** 代码库结构变化、新的风险被发现或修复后更新相应章节
- **定位策略：** 本文档不记录精确行号。需要定位代码时，使用文档中的模块名 + 方法名在 IDE 中搜索，或根据项目目录结构按文件名查找
- **阅读顺序：** 建议先读项目架构文档了解整体设计，再读本文档了解风险分布，然后按需查看具体源文件
