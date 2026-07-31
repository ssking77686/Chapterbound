<p align="center">
  <a href="#中文">中文</a> | <a href="#english">English</a>
</p>

\---

<h1 align="center">电子阅读器</h1>
<p align="center">一个跑在浏览器里的电子书阅读器。</p>

\---

## 中文

### 这是什么

一个用 Web 技术做的电子书阅读器。目前支持 EPUB，后面可能会加 PDF 和 TXT。

代码上用了插件化的思路——引擎、存储、功能模块都走接口，换存储或者加新格式不用动已有代码。UI 上参考了 Apple Books 的暖色系，亮暗主题都支持，手机到带鱼屏都能看。

### 能干什么

* 导入 EPUB，自动取封面和作者信息。封面不满意可以自己换
* 阅读进度自动记，下次打开接着看
* 字号、字体、行间距随便调，偏好会记住
* 日间/夜间模式，手动切或者跟系统走都行。暗色是暖棕底，不刺眼
* 宽屏会自动双页展开，书架也会多放几列
* 书签是彩色标签（五色可选），侧栏里能看能删能跳
* 选中文字可以划高亮
* 点目录直接跳章节

**v1.1.1 新增了图鉴系统**，灵感来自《巫师 3》里的角色词条。主要特点：

* 人物、地点、怪物三大类，各自一个 tab
* 数据靠 AI 生成的 JSON 文件批量导入（编写规范见 `compendium-guide.md`）
* 读到对应章节，条目才会在列表里出现 —— 不会提前剧透
* 每个人的"发现日志"按章节分层，新章节自动解锁，没读到的内容会模糊
* 地点条目有历史沿革，条目之间可以建关系网（恋人、导师、宿敌、栖息地……），点关联卡片直接跳过去看
* 支持嵌入世界观内的文献引述（像《北方诸国名人录》·丹德里恩这种），有章节标注的会跟着进度解锁
* 有新东西解锁时图鉴按钮上亮个金色小光点，点进去看过就熄了
* 图鉴内部是独立的深羊皮纸配色，跟全局日夜间模式互不干扰
* 章节检测全自动，基于 epub.js 的 spine index，不需要手动标
* 内置写作指南下载，把指南 + 全文发给 AI 就能生成图鉴 JSON

### 怎么跑

```bash
npm install
npm run dev      # 开发
npm run build    # 构建
npm run lint     # 检查
```

### 技术栈

React 19 + TypeScript，Vite 8 构建，Zustand 管状态，Dexie.js 套 IndexedDB，Tailwind CSS v4 写样式，epub.js 渲染，motion 做动效，Lucide 图标。

### 目录结构

```
src/
├── core/           # 接口和类型，ServiceRegistry
├── adapters/       # 存储适配器（目前只有 IndexedDB）
├── engines/        # 阅读引擎（目前只有 EPUB）
├── parsers/        # 格式解析
├── features/       # 功能插件
├── stores/         # Zustand store
├── hooks/          # React hooks
├── components/     # UI 组件
└── plugins/        # 启动注册
```

### 更新日志

**v1.1.1** (2026-08)
- 新增项目介绍页（关于按钮），展示仓库、所有者和贡献者
- 图鉴面板内置写作指南下载，一键获取发给 AI 即可生成 JSON
- 写作指南去特定世界观化，任何书籍通用
- 多项 Bug 修复（宽屏点击、引擎错误处理、页面闪烁、图鉴持久化）

**v1.1.0** (2026-07)
- 图鉴系统：人物/地点/怪物三大类，JSON 批量导入，按章节自动解锁
- 书籍封面自定义（上传 + 重置）
- 彩色书签系统（五色可选）
- 阅读设置（字号/字体/行间距）
- 明暗主题切换（暖棕暗色）
- 宽屏双页展开 + 书架响应式列数

**v1.0.0** (2026-06)
- 初始版本：EPUB 阅读、阅读进度、书签、高亮、目录导航

### 许可

[MIT](LICENSE) © ahine Yang

\---

## English

### What is this

An ebook reader that runs in the browser. EPUB is supported, PDF and TXT maybe on the way .

The code is plugin-based — engines, storage, and features all sit behind interfaces, so swapping storage or adding a format doesn't touch existing code. The UI follows Apple Books' warm palette, works in light and dark mode, and scales from phones to ultrawide monitors.

### Features

* Import EPUBs with automatic cover and metadata extraction. Swap the cover if you don't like it
* Reading progress saved automatically, picks up where you left off
* Adjustable font size, family, and line spacing; preferences persist
* Light/dark theme with warm dark palette, manual toggle or follow system
* Dual-page spread on wide screens, responsive grid in the library
* Color-coded bookmarks (5 colors), manage in sidebar with jump-to
* Text highlighting
* Table of contents with chapter jump
* About page with repo link, owner and contributor info

**v1.1.1 adds a compendium system** inspired by RPG in-game character glossaries:

* Three categories: Characters, Locations, Monsters — each with its own tab
* Bulk import via AI-generated JSON (see `compendium-guide.md` for the writing guide)
* Read-to-unlock: entries only appear after you've reached the relevant chapter — no spoilers
* Discovery log entries unlock progressively per chapter; unread content stays blurred
* Location entries include a history field; entries can link to each other via relationships (lover, mentor, nemesis, habitat, etc.)
* In-universe literature quotations that unlock alongside the story
* A small golden dot on the compendium button when something new unlocks, gone after you check
* The compendium has its own dark parchment color scheme, separate from the global theme
* Chapter detection is automatic via epub.js spine index
* Built-in writing guide download — send it to any AI along with your book to generate compendium JSON

### Quick start

```bash
npm install
npm run dev      # development
npm run build    # production build
npm run lint     # lint
```

### Tech

React 19 + TypeScript, Vite 8, Zustand, Dexie.js (IndexedDB), Tailwind CSS v4, epub.js, motion, Lucide icons.

### Changelog

**v1.1.1** (2026-08)
- About page with repo link and contributor info
- Built-in compendium writing guide download
- Universal writing guide (no setting-specific references)
- Bug fixes (wide-screen click, engine error handling, page flash, compendium persistence)

**v1.1.0** (2026-07)
- Compendium system: Characters/Locations/Monsters, JSON import, chapter-based unlock
- Custom book covers (upload + reset)
- Colored bookmark system (5 colors)
- Reading settings (font size/family/line height)
- Light/dark theme toggle (warm dark palette)
- Wide-screen dual-page spread + responsive library grid

**v1.0.0** (2026-06)
- Initial release: EPUB reading, progress tracking, bookmarks, highlights, TOC navigation

### License

[MIT](LICENSE) © ahine Yang

