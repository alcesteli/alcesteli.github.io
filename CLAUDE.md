# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static portfolio website for Alceste Li (alcesteli.com), deployed on GitHub Pages. No build system, bundler, package manager, or test framework — all code is vanilla HTML/CSS/JS served directly.

## Development

To preview locally, serve the directory with any static file server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no linting, testing, or CI pipeline.

## Architecture

### File structure

```
index.html                  — HTML skeleton (~119 lines), loads all JS/CSS
css/style.css               — All styling (690 lines)
js/
  config.js                 — Global constants (language, anti-spam thresholds, API key)
  utils.js                  — Storage helpers, HTML sanitisation, UI text fallbacks
  data.js                   — Project catalog, HOME_SLIDES config, mutable site state
  translations-inline.js    — Full FR/EN translation object (embedded at load)
  home.js                   — Home slider: collapsed pile ↔ expanded grid
  gallery.js                — Project page rendering, image loading, lightbox
  contact.js                — Form validation, anti-spam logic, Web3Forms submission
  app.js                    — Language switching, page routing, sidebar nav, init
images/
  COVER/, ARCHI/, SCENO/, INTERIOR/, EVENT/, GRAPHIC/, OTHERS/
CNAME                       — Custom domain (alcesteli.com)
```

Scripts are loaded in dependency order: `config → utils → data → translations-inline → home → gallery → contact → app`.

### Single-page app structure

Navigation between sections (Home, project categories, About, Contact) is done by showing/hiding `<section>` elements via `showPage(id)` in `app.js` — no URL routing, no history API. The back button is not supported by design.

### JS modules

**config.js** — Constants only: `SUPPORTED_LANGS`, `DEFAULT_LANG` (`'fr'`), Web3Forms API key/endpoint, and all anti-spam thresholds (`CONTACT_MIN_FILL_TIME_MS`, `CONTACT_RATE_LIMIT_MS`, `CONTACT_MIN_INTERACTIONS`, etc.).

**utils.js** — Three responsibilities:
- `safeReadStorage` / `safeWriteStorage`: localStorage with in-memory fallback for private browsing
- `escapeHtml` / `sanitizeRichText`: XSS prevention; `sanitizeRichText` whitelists only `<p>`, `<br>`, `<em>`, `<strong>`
- `UI_TEXT` + `getUiText(path, replacements)`: fallback UI strings in FR/EN, with `{key}` token interpolation

**data.js** — Project catalog as `DATA` object with 7 categories (`stageDesign`, `windowDisplay`, `architecture`, `interior`, `event`, `graphic`, `others`). Each item has `title`, `desc`, `type`, `client`, `year`, `images[]`, and optional `cover`. Also defines `HOME_SLIDES` (5 slides), and holds mutable site state: `siteLang`, `currentProjectState`, `homeExpanded`, `lbIndex`, `projectRenderToken`.

**translations-inline.js** — `window.INLINE_TRANSLATIONS` with `fr` and `en` keys. Covers sidebar labels, About/Contact page content, all project category names, project titles, descriptions, and all form status messages (with `{placeholder}` tokens). French is the default; all switches are synchronous.

**home.js** — Renders the home slider. `computeExpandedLayout()` calculates pixel positions for a two-row grid based on viewport and natural image dimensions. Each slide gets CSS custom properties (`--tx-collapsed`, `--tx-expanded`, etc.) for smooth CSS transitions. Single click expands; double click opens the linked project.

**gallery.js** — `openProject(cat, idx)` is the entry point. Uses a `projectRenderToken` to cancel stale async image loads when the user navigates away. Hero image loads eagerly; gallery images load lazily. `openLightbox(index)` / `changeLightboxImg(step)` handle the modal with keyboard support (Escape, arrows).

**contact.js** — `initContactForm()` binds the submit handler. `validateFormInputs()` runs checks in sequence: API key present, honeypot fields empty, min fill time, rate limit cooldown, min field lengths, min interaction count, no URLs in name/subject, max 2 URLs in message body, no 6+ repeated characters. A dynamic honeypot field (random name) is injected at init. Submissions POST to Web3Forms.

**app.js** — `switchLanguage(lang)` coordinates the full switch: re-clone `BASE_DATA`, apply translations to project data, update static page content, rebuild sidebar, re-render home slider, re-init contact form. `renderSidebarNav()` builds collapsible category groups. `showPage(id)` handles page visibility and mobile menu state.

### Language system (FR/EN)

Single-source translation system — French is the default:

- **`js/translations-inline.js`** is the only translation source. It is loaded synchronously; no async fetch is ever performed.
- Language preference is persisted via `safeWriteStorage('lang', ...)`.
- `switchLanguage(lang)` in `app.js` applies translations; `getTranslationText(path)` in `app.js` resolves dot-notation paths (e.g. `'categories.stageDesign'`).

> `data/fr.json`, `data/en.json`, and `js/lang.js` have been deleted — they were the old async-fallback system.

### Project gallery

Projects are organised into 7 categories. The home slider is driven by the `HOME_SLIDES` array in `data.js`. Opening a project calls `openProject(cat, idx)` in `gallery.js`, which renders a hero image, scrollable gallery, and info panel. Clicking any image opens the lightbox.

### Contact form

`initContactForm()` in `contact.js`. Submissions go to the Web3Forms API (key in `config.js`). Spam-protection layers: static and dynamic honeypot fields, minimum fill time, rate limiting, minimum interaction count, URL detection in name/subject, repeated-character detection.

### CSS theming

All styles live in `css/style.css`. CSS custom properties at `:root`:

- `--black`, `--white`, `--panel`, `--gray`, `--accent` (`#0000ff`) for colours
- `--side-safe: clamp(84px, 9vw, 140px)` for the fixed sidebar width
- Mobile breakpoint at 768px
- Fonts: **DM Mono** (body), **Cormorant Garamond** (serif accents), **Avenir** (navigation)

## Deployment

Push to `main` — GitHub Pages serves the repository root automatically. The custom domain is configured via the `CNAME` file (`alcesteli.com`).
