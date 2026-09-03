<p align="center">
  <a href="./README.md">中文</a> | <a href="./DEVELOPMENT.md">Developer Docs</a> | <a href="./DEVELOPMENT_EN.md">Developer Docs (EN)</a>
</p>

<h1 align="center">E-Reader</h1>
<p align="center">A browser-based ebook reader with an RPG-inspired character glossary system.</p>

---

## Screenshots

<div align="center">
  <img src="public/shelf.png" alt="Bookshelf" width="45%" />
  <img src="public/reader.png" alt="Reader" width="45%" />
</div>
<div align="center">
  <img src="public/compendium-detail.png" alt="Character Compendium" width="45%" />
  <img src="public/compendium-location.png" alt="Location Compendium" width="45%" />
</div>

---

## Compendium System

The project's standout feature. As you read, characters, locations, and monsters progressively unlock in the compendium — no spoilers ahead of time.

> **Inspiration**: The character glossary from *The Witcher 3*. Every chapter reveals new information, like picking up scattered pieces of the story.

**Core design:**

- **Characters / Locations / Monsters** — three categories with independent tabs
- **Auto-unlock by chapter** — based on epub.js spine index, unlocks as you read, no manual marking needed
- **Layered discovery log** — each entry's information is split by chapter, revealed as you progress
- **Relationship web** — link entries together (lover, mentor, nemesis, contains, etc.), click to jump
- **In-universe quotations** — embedded excerpts from the world's own literature
- **Unlock indicator** — a small golden dot on the compendium button when new content appears, gone after you check
- **Independent color scheme** — the compendium has its own dark parchment palette, separate from global theme
- **AI-assisted generation** — built-in writing guide, send it to any AI along with your book to generate compendium JSON
- **Re-import support** — re-import updated JSON, old data is auto-purged, chapter progress resets
- **Independent font scaling** — separate text size control for the compendium, four levels, doesn't affect reader settings
- **Dual-column on ultrawide** — profile info and reading content side-by-side for efficient screen use

---

## Features

- Import EPUB with automatic cover and metadata extraction
- Custom cover upload and reset
- Auto-saved reading progress, picks up where you left off
- Reading progress bar: drag-to-seek with precise page display
- Adjustable font size, family, and line height, preferences persist
- Page themes: 5 preset color schemes, independent of light/dark mode
- Light / dark mode, manual toggle or follow system
- Warm dark palette, easy on the eyes
- Dual-page spread on wide screens, responsive library grid
- Colored bookmarks (5 colors), sidebar management with jump-to
- Text highlighting
- TOC chapter navigation
- Onboarding guide: 9-step interactive walkthrough on first visit, can be permanently dismissed

---

## Platforms

| Platform | How |
|----------|-----|
| Browser | `npm run dev` or deploy the static `dist/` directory |
| Windows desktop | Tauri v2 (`npm run desktop:build`, produces an NSIS installer) |
| Android phone | Capacitor wrapper, one-command APK build, sideload to distribute |

One codebase, two shells, identical behavior. On Android you additionally get: **swipe / tap page turning**, status-bar safe-area handling (toolbar automatically avoids notches/gesture zones), 44px touch hit targets, and back-button layer-by-layer exit.

## Quick Start

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run lint     # lint

# Android APK (requires JDK 21 + Android SDK, see Developer Docs)
npx cap sync android
cd android && ./gradlew assembleDebug   # output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Links

- [中文 README](./README.md)
- [Developer Documentation](./DEVELOPMENT.md)
- [Developer Documentation (EN)](./DEVELOPMENT_EN.md)
- [Compendium Writing Guide](public/guides/compendium-guide.md) — send to AI to generate compendium JSON
- [Compendium Schema Reference](public/guides/compendium-schema.md)
- [Compendium User Guide](public/guides/compendium-readme.md)

---

## Changelog

**v1.5.0** (2026-09)
- Desktop migrated to Tauri v2: Electron removed; NSIS installer (`npm run desktop:build`, ~4.5 MB) rendered by the native Windows WebView2
- Version unified: desktop / web / Android all aligned at v1.5.0
- Dev docs synced: desktop build toolchain (MSYS2 + China-network bundling mirror workaround) documented in DEVELOPMENT.md; distribution sections updated in technical-audit.md

**v1.4.0** (2026-08)
- Mobile adaptation: Capacitor 8 wrapper — build an Android APK for sideload distribution
- Touch page turning: swipe left/right to turn pages, tap either side of the screen (no conflict with long-press text selection)
- Status-bar adaptation: toolbar automatically clears the notch / anti-accidental-touch zone; safe-area height injected natively; light/dark status bar follows the theme
- Full-width sidebar: the sidebar spans the screen on phones with its own close button; back button exits layers in order (detail → sidebar → bookshelf)
- Touch interaction completeness: delete/cover buttons always visible on the bookshelf, unified 44px hit targets, onboarding cards auto-scale to screen width
- App icon: Android icon matches the EXE (dark brown background + red book)
- Import convergence: EPUB only — other formats now show a clear message (previously they imported but couldn't open)

**v1.3.2** (2026-08)
- Security hardening: React Error Boundary for render-crash recovery, global unhandledrejection handler, transactional IndexedDB writes
- User feedback: Toast notification system (success/error/info, animated via motion)
- Data validation: Compendium JSON import runtime schema check, settings type validation
- Compendium performance: search debounce, infinite scroll (50 per batch), animation delay cap, image lazy loading
- Code health docs: `docs/technical-audit.md` — long-term maintained codebase reference

**v1.3.0** (2026-08)
- Onboarding system: auto-triggered on first visit, SVG mask capsule cutout highlights target elements with spring transitions, 6 steps covering import → open book → page turn → settings → compendium → bookmarks
- Page theme system: 5 preset color schemes (White / Warm Yellow / Warm Brown / Dark Brown / Dark Green), theme selector in settings panel, reader background independent from light/dark mode
- Reading progress bar: drag-to-seek bottom bar with precise page-ratio calculation
- Dark mode color refinements
- Fixed spread leakage with explicit field picking to prevent JSON contamination in IndexedDB

**v1.2.0** (2026-08)
- Compendium dual-column layout: profile info and reading content side-by-side on ultrawide screens
- Independent compendium font scaling: Apple-style 4-level control with persistent preference
- Compact relation chips: horizontal tag layout with importance-sorted fold, handles 113+ relations gracefully
- Typography overhaul: bumped body/heading sizes for comfortable reading on dark parchment background
- Ultrawide reading area expansion: epub.js dual-page spread adapts to 1600px+ screens
- Search precision: filtered out description-only noise matches
- Selection search fix: clicking results no longer triggers accidental page turns
- Import compatibility fix

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

---

## License

[MIT](LICENSE) © ahine Yang
