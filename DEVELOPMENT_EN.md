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
| Mobile shell | Capacitor 8 (Android WebView wrapper, produces APK) |

## Commands

```bash
npm install
npm run dev       # Dev server (default http://localhost:5173)
npm run build     # tsc -b + vite build
npm run preview   # Preview production build
npm run lint      # oxlint

# Android (APK build)
npx cap sync android        # copies dist/ into android/app/src/main/assets/public + syncs native config
cd android && ./gradlew assembleDebug   # debug APK → android/app/build/outputs/apk/debug/app-debug.apk

# Desktop shells
npm run electron:dev        # Electron dev mode
npm run electron:build      # Package Windows EXE (output to release/, offline using electron-dist/ local runtime)
npm run tauri               # Tauri CLI
```

> **Android build environment** (see "Mobile adaptation" below): JDK 21 + Android SDK (platform 36, build-tools 34.0.0). Behind the GFW, configure Maven/Gradle mirrors (`~/.gradle/init.gradle` + `android/gradle/wrapper/gradle-wrapper.properties`); `sdk.dir` in `android/local.properties` must use forward slashes (`sdk.dir=C:/android-sdk` — backslashes are eaten by Java Properties escaping).

## Directory Structure

```
src/
├── core/           # Shared types, ServiceRegistry singleton, five abstract interfaces
├── adapters/       # Storage adapter (IndexedDBAdapter)
├── engines/        # Reading engine (EpubEngine, with touch gesture events)
├── parsers/        # Metadata parser (EpubParser)
├── features/       # Feature plugins (reserved extension points)
├── stores/         # Zustand stores (8 independent stores)
├── hooks/          # React hooks (useReader, useKeyboard, useTheme, useIsTouch)
├── components/     # UI components (LibraryPage, ReaderPage, OnboardingOverlay, AboutOverlay, ErrorBoundary, ToastContainer)
└── plugins/        # App startup wiring (default-plugins)

android/            # Capacitor Android project (Gradle; managed by cap sync)
capacitor.config.ts # Capacitor config (appId: com.chapterbound.app, webDir: dist)
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

### Mobile Adaptation (Capacitor Android)

The same web app is distributed through three shells: Electron / Tauri (desktop) and Capacitor WebView (Android APK). Key mobile adaptation mechanisms:

**Touch detection (single source)** — `useIsTouch`: auto-detection via `matchMedia('(hover: none), (pointer: coarse)')`, overridable with `localStorage['force-touch']='1'/'0'` (debug only, no UI toggle). No scattered matchMedia across the app.

**Page-turn gestures (engine level)** — `EpubEngine` binds touch events on the iframe `contents` (epub.js forwards iframe DOM events), emitting `gesture:swipe` (|dx|≥60px, |dx|>2·|dy|, ≤600ms) and `gesture:tap` (≤350ms, ≤10px movement); long-press selection (non-empty selection) suppresses page turns. Not registered on desktop — zero impact.

**Safe-area injection (native bridge)** — Android WebView's `env(safe-area-inset-*)` is always 0. `android/app/src/main/java/com/chapterbound/app/MainActivity.java` reads the real status-bar height (WindowInsets) at startup and injects it as the CSS variable `--safe-top` (auto-retries until the page is ready); the toolbar/sidebar/compendium detail offset by it to clear the status bar and notch anti-accidental-touch zone. CSS side has a 16px fallback under `@media (hover: none)` that only applies when injection failed (no `data-safe-top-injected` marker). `--safe-top`/`--safe-bottom` are 0 on desktop — zero regression.

**edge-to-edge** — Android 15/16 enforce edge-to-edge for targetSdk 35+, which would push WebView content under the status bar. `android/app/src/main/res/values-v35/styles.xml` opts out via `windowOptOutEdgeToEdgeEnforcement` (double insurance alongside native injection); status bar colors match the web theme (`values-night-v35` dark variant).

**Back-button layer-by-layer exit** — `ReaderPage` uses a single-entry `history.replaceState` scheme: opening the sidebar/compendium detail/bookmark picker only updates the entry state (no new history entries); on popstate, refs dispatch closing the topmost overlay (detail → sidebar → reader), then the entry is pushed back. The history stack stays two entries deep, giving stable back-button semantics. (Capacitor `@capacitor/app` backButton events can layer on top in Phase 3.)

**Android build environment notes**:
- JDK 21 (`JAVA_HOME` must be a Windows absolute path; unix-style paths break the .bat launcher)
- Android SDK: `C:/android-sdk` (platforms/android-36 + build-tools/34.0.0 + platform-tools + cmdline-tools)
- Mirrors: `~/.gradle/init.gradle` injects Tencent Cloud nexus maven-public + official Google + Aliyun fallback; `gradle-wrapper.properties` distributionUrl uses the Tencent Cloud gradle mirror
- **After changing web code you MUST** `npm run build && npx cap sync android` before `assembleDebug`, otherwise the APK contains stale web assets

### Known Issues

- **epub.js pagination**: Some books only show 1–2 pages. The EPUB engine renders via CSS columns — if the container height is 0 at initial render, columns collapse. `useReader`'s ResizeObserver handles post-render resize, but initial render timing is sensitive.
- **epub.js types**: 5 `as any` casts in `EpubEngine.ts` and `EpubParser.ts`. epub.js v0.3.93 TypeScript definitions are incomplete — `currentLocation()` return value and `metadata` properties are untyped.
- **Feature plugins are skeletons**: The 4 plugins under `src/features/` register lifecycle hooks but have no UI extensions. The plugin system is wired but unused.
- **EPUB only**: No PDF or TXT engine yet; `registry.getEngine()` returns `undefined` for non-EPUB formats. Import is converged to `.epub` only (with extension validation, other formats rejected with a toast).
- **Android WebView persistence**: IndexedDB lives in the WebView's app data directory — uninstalling or clearing app data loses the library/bookmarks/progress/compendium (no backup export in this phase).
- **Android backlog (Phase 3+)**: intent-filter import (SAF currently falls back to the system file picker), `@capacitor/app` back button, release signing, real-device selection-search redesign, mobile compendium workflow (dropped by decision).
- **Related docs**: `docs/technical-audit.md` — code health reference: error handling conventions, persistence details, risk inventory, module navigation index.

### Key Patterns

**Page-turn animation**: The reading card uses the `useAnimate` hook to trigger page-turn animations rather than changing the `key` prop to remount. Changing the key of the motion.div would destroy and recreate the epub.js iframe, breaking the entire reader.

**epub.js engine lifecycle**: `EpubEngine.load()` creates a Book and Rendition, renders into the given container, and fires the `'ready'` event. On `'relocated'`, it emits `locationChange` (cfi, progress, page, total). Always call `destroy()` during cleanup — it tears down both rendition and book.

**Chapter detection**: `getChapterMap()` recursively walks the TOC tree, mapping TOC item `href` values to epub.js spine indices, producing a bidirectional `chapterNumber → spineIndex` map. This map is used by the compendium system for automatic chapter detection.
