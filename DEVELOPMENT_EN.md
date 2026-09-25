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
| Desktop shell | Tauri v2 (Windows WebView2 wrapper, NSIS installer) |

## Commands

```bash
npm install
npm run dev       # Dev server (default http://localhost:5173)
npm run build     # tsc -b + vite build
npm run preview   # Preview production build
npm run lint      # oxlint

# Android (APK build)
npm run android:build       # One-shot: npm run build → cap sync → gradlew assembleDebug → APK auto-copied to release/

# Desktop shell (Tauri v2 — the only desktop distribution)
npm run desktop:dev         # Dev mode (starts Vite dev server + compiles/runs)
npm run desktop:build       # Package Windows installer (NSIS — latest artifact auto-copied to release/)
```

> **Desktop (Tauri) build environment**: rustup `x86_64-pc-windows-gnu` toolchain + MSYS2 mingw64 (`C:\msys64`). Three external tools are required — none optional: ① binutils' `dlltool.exe` (raw-dylib import libs) → `C:\msys64\mingw64\bin` (persisted into the User PATH on this machine since 2026-09-03; on a fresh install persist it yourself, or run `export PATH="$PATH:C:/msys64/mingw64/bin"` each session); ② `~/.cargo/config.toml` points the linker at rustup's bundled `rust-lld.exe` (the GNU toolchain ships no external gcc; linking needs none); ③ **mingw `gcc`** (`pacman -S mingw-w64-x86_64-gcc`) — windres invokes `gcc -E` to preprocess `resource.rc`; when missing, the build fails silently (stdout ends at an informational `package.metadata does not exist` line, then exits 101 — the real error is swallowed by tauri-winres' `.unwrap()`, so reproduce by running windres by hand). MSYS2 repo mirrors live in `/etc/pacman.d/mirrorlist.mingw` (this machine uses TUNA `…/msys2/mingw/$repo` — note ucrt64/clang64 are NOT on TUNA).
>
> **Bundling behind the GFW**: `tauri build` downloads the NSIS toolchain from GitHub Releases (tauri-bundler 2.9.4 needs two assets: `nsis-3.11.zip` (SHA1 `ef7ff767…bb10d`) and the `nsis_tauri_utils-v0.5.3` dll (SHA1 `75197fee…49b860`)). Direct GitHub access may return 502. Two options: ① set `TAURI_BUNDLER_TOOLS_GITHUB_MIRROR=https://gh-proxy.com/https://github.com` (value = proxy prefix + full github domain) and re-run; ② most reliable — download both assets by hand through the proxy, extract the zip flat into `%LOCALAPPDATA%\tauri\NSIS` (strip the `nsis-3.11/` top-level directory) and drop the dll into `Plugins\x86-unicode\additional\` (the bundler verifies all required files are present and skips downloading). Already pre-staged on this machine — plain `npm run desktop:build` works.
>
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

src-tauri/          # Tauri v2 desktop shell (Rust entry + tauri.conf.json config)
android/            # Capacitor Android project (Gradle; managed by cap sync)
capacitor.config.ts # Capacitor config (appId: com.chapterbound.app, webDir: dist)
ui-console.html     # UI console (dev tool; root-level HTML, never in the build output or the APK)
console/            # Console implementation (audit.ts verdicts / viewports.ts presets / mirror.ts / ConsoleApp.tsx UI)
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

The same web app is distributed through two shells: Tauri (Windows desktop) and Capacitor WebView (Android APK). Key mobile adaptation mechanisms:

**Touch detection (single source)** — `useIsTouch`: auto-detection via `matchMedia('(hover: none), (pointer: coarse)')`, overridable with `localStorage['force-touch']='1'/'0'` (debug only, no UI toggle). No scattered matchMedia across the app. `applyTouchMode()` mirrors the verdict onto `<html data-touch="1">`, and **CSS reads that attribute — never `@media (hover: none)`**. The media query used to be a *second* judgement source, so under `force-touch` JS and CSS disagreed (historical bug: JS said touch, CSS said not, so the 44px `.icon-btn` hit-target rule silently didn't apply). `data-touch` is **derived — do not write it directly**; switch modes via `force-touch` + reload. It is set in `main.tsx` before first paint so touch devices don't flash desktop layout.

**Page-turn gestures (engine level)** — `EpubEngine` binds touch events on the iframe `contents` (epub.js forwards iframe DOM events), emitting `gesture:swipe` (|dx|≥60px, |dx|>2·|dy|, ≤600ms) and `gesture:tap` (≤350ms, ≤10px movement); long-press selection (non-empty selection) suppresses page turns. Not registered on desktop — zero impact.

**Safe-area injection (native bridge)** — Android WebView's `env(safe-area-inset-*)` is always 0. `MainActivity.injectSafeArea()` reads `statusBars()` / `navigationBars()` / `displayCutout()` at startup and injects **all four values together** as the CSS variables `--safe-top`/`--safe-bottom`/`--safe-left`/`--safe-right` (auto-retries until the page is ready); the toolbar/sidebar/reading area/compendium detail offset by them to clear the status bar, notch and gesture bar. Three traps: **(1) divide by `density`** — `WindowInsetsCompat.getInsets()` returns *physical* pixels while 1 WebView CSS px = 1 dp, so skipping this inflates `--safe-top` by 2.0–3.5× (historical bug: toolbar pushed down dozens of pixels); **(2) write all four together with the marker** — `data-safe-top-injected` means "all four were injected", so writing only `top` while setting the marker silently kills the CSS fallback for the others (historical bug: `--safe-bottom` stuck at 0, page capsule under the gesture bar); **(3) keep taking `top` from `statusBars()` only, never `max()` with `displayCutout()`** — portrait notches are already included in the status-bar height, so widening overshoots (historical bug). Left/right are non-zero only on landscape notch phones. Rotation/fold/split-screen do **not** recreate the Activity (see manifest `configChanges`), so `onConfigurationChanged()` re-injects. The CSS fallback is `:root[data-touch='1']:not([data-safe-top-injected])` (16px) and only applies when injection failed; all four are 0 on desktop — zero regression.

**edge-to-edge** — Android 15/16 enforce edge-to-edge for targetSdk 35+, which would push WebView content under the status bar. `android/app/src/main/res/values-v35/styles.xml` declares `windowOptOutEdgeToEdgeEnforcement`, and status bar colors match the web theme (`values-night-v35` dark variant).

> ⚠️ **`windowOptOutEdgeToEdgeEnforcement` is effectively inert — do not treat it as the first line of defence for safe areas.** Capacitor's `BridgeActivity.onCreate` swaps the theme to `AppTheme_NoActionBar`, which does not carry that flag, so the opt-out is never read and the app really does run edge-to-edge. **Only native injection + the CSS fallback actually work.** (The "About-panel close button sits under the status bar" bug is itself proof that the viewport reaches under the status bar.)

**Back-button layer-by-layer exit** — `ReaderPage` uses a single-entry `history.replaceState` scheme: opening the sidebar/compendium detail/bookmark picker only updates the entry state (no new history entries); on popstate, refs dispatch closing the topmost overlay (detail → sidebar → reader), then the entry is pushed back. The history stack stays two entries deep, giving stable back-button semantics. (Capacitor `@capacitor/app` backButton events can layer on top in Phase 3.)

**Android build environment notes**:
- JDK 21 (`JAVA_HOME` must be a Windows absolute path; unix-style paths break the .bat launcher)
- Android SDK: `C:/android-sdk` (platforms/android-36 + build-tools/34.0.0 + platform-tools + cmdline-tools)
- Mirrors: `~/.gradle/init.gradle` injects Tencent Cloud nexus maven-public + official Google + Aliyun fallback; `gradle-wrapper.properties` distributionUrl uses the Tencent Cloud gradle mirror
- **After changing web code run `npm run android:build`** (it re-runs `npm run build` + `cap sync android` internally) — a bare `assembleDebug` packages stale web assets

## UI Console (dev tool)

`npm run dev`, then open `http://localhost:5173/ui-console.html`.

A graphical harness for the one bug class that actually bites this project — *invisible therefore unclickable*. It runs the **real app** in a same-origin iframe (so it audits the composed UI; occlusion bugs like the scrim below only exist once things are assembled), you set viewport / safe-area / touch on the left, the real app sits on the right, and "check" runs four verdicts (out of bounds / hit-testable / ≥44px target / does `fixed inset-0` really fill the viewport), drawing red boxes you can jump to from the list.

- **Two panes**, each with its own viewport + insets (touch mode and zoom are shared). Includes a manual "mirror A's UI onto B" sync.
- The four safe-area values you set are exactly what native injection does — same variables, same marker.
- **It depends on two project conventions**: ① every clickable element must carry `cursor-pointer`; ② `data-touch` is written by `useIsTouch` and read by CSS. Break either and the console goes **silently** blind to those elements.
- Root-level HTML (not `public/`) — never in the build output or the APK. Type-checked via `tsconfig.console.json`, so `npm run build` fails on a type error in it.
- Full rationale, capability boundary and TODOs live in `CLAUDE.md` ("UI console" + the TODO section). Read the header of `console/audit.ts` before changing any verdict.

### Known Issues

- **epub.js pagination**: Some books only show 1–2 pages. The EPUB engine renders via CSS columns — if the container height is 0 at initial render, columns collapse. `useReader`'s ResizeObserver handles post-render resize, but initial render timing is sensitive.
- **epub.js types**: 5 `as any` casts in `EpubEngine.ts` and `EpubParser.ts`. epub.js v0.3.93 TypeScript definitions are incomplete — `currentLocation()` return value and `metadata` properties are untyped.
- **Feature plugins are skeletons**: The 4 plugins under `src/features/` register lifecycle hooks but have no UI extensions. The plugin system is wired but unused.
- **EPUB only**: No PDF or TXT engine yet; `registry.getEngine()` returns `undefined` for non-EPUB formats. Import is converged to `.epub` only (with extension validation, other formats rejected with a toast).
- **Android WebView persistence**: IndexedDB lives in the WebView's app data directory — uninstalling or clearing app data loses the library/bookmarks/progress/compendium (no backup export in this phase).
- **Android backlog (Phase 3+)**: intent-filter import (SAF currently falls back to the system file picker), `@capacitor/app` back button, release signing, real-device selection-search redesign, mobile compendium workflow (dropped by decision).
- **Reader colour-picker scrim is only as big as the header** (unfixed, registered in the console's known-defect panel): `ReaderPage.tsx`'s scrim is `fixed inset-0`, but it lives inside a header that has `backdrop-filter` — and `backdrop-filter` **establishes a containing block for `fixed` descendants** (same as `transform`/`filter`), so `inset-0` resolves to the header's box (measured 412×88) instead of the viewport. Consequence: **tapping the page does not dismiss the picker**; only the X or a toolbar tap does. Fix: move `backdrop-filter` off the header onto an inner background layer (`absolute inset-0 -z-10 pointer-events-none`) and keep a translucent background on the header — no stacking changes needed.
- **Touch targets below 44px** (found by the console, unfixed): the bookmark picker's 5 colour swatches and its close button are all 32×32; the library header's theme/About buttons are 40×40, "import" is 40 tall, and the cover buttons on book cards are 30×30. The delete button also **has no accessible name** (no `aria-label`). Note the real tension in the swatch group: 5×44 + 44 = 264px will not fit a 270px popover without widening it, and widening reintroduces overflow on narrow screens.
- **`下一页` is a 24×811 invisible hot zone** (unfixed): `absolute right-2`, running the full height, and it covers the right half of the picker's close button — clicking the centre or right half of that button **turns the page**. The fix is not a z-index: the hot zone should neither run the full height nor sit above right-edge overlays.
- **Related docs**: `docs/technical-audit.md` — code health reference: error handling conventions, persistence details, risk inventory, module navigation index.

### Key Patterns

**Page-turn animation**: The reading card uses the `useAnimate` hook to trigger page-turn animations rather than changing the `key` prop to remount. Changing the key of the motion.div would destroy and recreate the epub.js iframe, breaking the entire reader.

**epub.js engine lifecycle**: `EpubEngine.load()` creates a Book and Rendition, renders into the given container, and fires the `'ready'` event. On `'relocated'`, it emits `locationChange` (cfi, progress, page, total). Always call `destroy()` during cleanup — it tears down both rendition and book.

**Chapter detection**: `getChapterMap()` recursively walks the TOC tree, mapping TOC item `href` values to epub.js spine indices, producing a bidirectional `chapterNumber → spineIndex` map. This map is used by the compendium system for automatic chapter detection.
