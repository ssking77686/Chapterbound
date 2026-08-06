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
- Adjustable font size, family, and line height, preferences persist
- Light / dark mode, manual toggle or follow system
- Warm dark palette, easy on the eyes
- Dual-page spread on wide screens, responsive library grid
- Colored bookmarks (5 colors), sidebar management with jump-to
- Text highlighting
- TOC chapter navigation

---

## Quick Start

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run lint     # lint
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
