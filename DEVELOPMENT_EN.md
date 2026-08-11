<p align="center">
  <a href="./README.md">返回用户文档</a> | <a href="./README_EN.md">← Back to English README</a>
</p>

# Developer Documentation

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| State | Zustand |
| Storage | Dexie.js (IndexedDB) |
| Styling | Tailwind CSS v4 |
| Rendering | epub.js |
| Animation | motion (formerly framer-motion) |
| Icons | Lucide |

## Commands

```bash
npm install
npm run dev       # Dev server (default http://localhost:5173)
npm run build     # tsc -b + vite build
npm run preview   # Preview production build
npm run lint      # oxlint
```

## Directory Structure

```
src/
├── core/           # Shared types, ServiceRegistry singleton, five abstract interfaces
├── adapters/       # Storage adapter (IndexedDBAdapter)
├── engines/        # Reading engine (EpubEngine)
├── parsers/        # Metadata parser (EpubParser)
├── features/       # Feature plugins (reserved extension points)
├── stores/         # Zustand stores (8 independent stores)
├── hooks/          # React hooks (useReader, useKeyboard, useTheme)
├── components/     # UI components (LibraryPage, ReaderPage, OnboardingOverlay, AboutOverlay, ErrorBoundary, ToastContainer)
└── plugins/        # App startup wiring (default-plugins)
```

## Architecture

Plugin-based design — engines, parsers, storage, and feature modules all register independently through `ServiceRegistry`. Extend functionality without modifying core code.

### Core Layer (`src/core/`)

- `types.ts` — Shared types: `BookRecord`, `Bookmark`, `Highlight`, `ReadingProgress`, `TOCItem`, `CompendiumEntry`, etc.
- `registry.ts` — `ServiceRegistry` singleton, manages engine/parser/storage/feature plugin registration and lookup, with topological sort for activation
- `interfaces/` — Five abstract interfaces: `IReaderEngine`, `IStorageAdapter`, `IBookParser`, `IFeaturePlugin`

### State Management (Zustand)

Eight independent stores:

| Store | Responsibility |
|-------|---------------|
| `bookshelfStore` | Bookshelf list, import/delete books |
| `bookmarkStore` | Bookmark CRUD, per-bookId filtering |
| `highlightStore` | Highlight CRUD, with notes support |
| `progressStore` | Reading position save/load, per-bookId |
| `settingsStore` | Reader settings + page theme + compendium font scale, persisted to localStorage |
| `compendiumStore` | Compendium import/load/unlock/search |
| `onboardingStore` | Onboarding guide state, localStorage persistence, cross-page navigation |
| `toastStore` | Toast notifications: success/error/info, auto-dismiss |

### Design System

Warm color palette (Apple Books-inspired), managed via CSS custom properties:

| Variable | Light | Dark |
|----------|-------|------|
| Page bg | `#F5F1EA` | `#2B2420` |
| Text | `#3C3226` | `#F5EFE6` |
| Accent | `#B87C4B` | `#D4996A` |

Rounded cards (16px radius), warm-toned shadows.

### Animation

Powered by motion/react, three spring presets:
- `springDefault`: bounce 0, duration 0.3s (UI enter/exit)
- `springPress`: bounce 0, duration 0.2s (button press feedback)
- `springSlide`: bounce 0.15, duration 0.3s (sidebar slide-in)

### Known Issues

- **epub.js pagination**: Some books only show 1–2 pages. The EPUB engine renders via CSS columns — if the container height is 0 at initial render, columns collapse. `useReader`'s ResizeObserver handles post-render resize, but initial render timing is sensitive.
- **epub.js types**: 5 `as any` casts in `EpubEngine.ts` and `EpubParser.ts`. epub.js v0.3.93 TypeScript definitions are incomplete — `currentLocation()` return value and `metadata` properties are untyped.
- **Feature plugins are skeletons**: The 4 plugins under `src/features/` register lifecycle hooks but have no UI extensions. The plugin system is wired but unused.
- **EPUB only**: No PDF or TXT engine yet; `registry.getEngine()` returns `undefined` for non-EPUB formats.
- **Related docs**: `docs/technical-audit.md` — code health reference: error handling conventions, persistence details, risk inventory, module navigation index.

### Key Patterns

**Page-turn animation**: The reading card uses the `useAnimate` hook to trigger page-turn animations rather than changing the `key` prop to remount. Changing the key of the motion.div would destroy and recreate the epub.js iframe, breaking the entire reader.

**epub.js engine lifecycle**: `EpubEngine.load()` creates a Book and Rendition, renders into the given container, and fires the `'ready'` event. On `'relocated'`, it emits `locationChange` (cfi, progress, page, total). Always call `destroy()` during cleanup — it tears down both rendition and book.

**Chapter detection**: `getChapterMap()` recursively walks the TOC tree, mapping TOC item `href` values to epub.js spine indices, producing a bidirectional `chapterNumber → spineIndex` map. This map is used by the compendium system for automatic chapter detection.
