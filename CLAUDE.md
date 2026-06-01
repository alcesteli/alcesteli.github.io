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
index.html                  — HTML skeleton (~115 lines), loads all JS/CSS
css/style.css               — All styling (~736 lines)
js/
  config.js                 — Global constants (language keys, anti-spam thresholds, validation lengths, Web3Forms credentials)
  utils.js                  — Storage helpers, language normalisation, HTML sanitisation, UI text fallbacks
  data.js                   — Project catalog, HOME_SLIDES config, mutable site state
  translations-inline.js    — Full FR/EN translation object (embedded at load, ~424 lines)
  home.js                   — Home slider: collapsed pile ↔ expanded grid
  gallery.js                — Project page rendering, image loading, lightbox (with touch swipe)
  contact.js                — Form validation, anti-spam logic, Web3Forms submission
  app.js                    — Language switching, page/panel routing, sidebar nav, init
images/
  COVER/, ARCHI/, SCENO/, INTERIOR/, EVENT/, GRAPHIC/, OTHERS/
CNAME                       — Custom domain (alcesteli.com)
debug-lang.html             — Standalone language-debug harness (not linked from index.html)
refresh.html                — Cache-busting redirect helper (not linked from index.html)
```

Scripts are loaded in dependency order: `translations-inline → config → utils → data → home → gallery → contact → app`. (Note: `translations-inline.js` is loaded first so `window.INLINE_TRANSLATIONS` is defined before any consumer runs.)

### Single-page app structure

Navigation between sections (Home, project pages, About, Contact) is done by showing/hiding `.page` elements via `showPage(id)` / `openPanel(panel)` in `app.js` — no URL routing, no history API. The back button is not supported by design.

`app.js` distinguishes between **pages** (home, project) reached via `showPage`, and **panels** (about, contact, mobile menu) reached via `openPanel`. Panels track `_activePanel` (`'menu' | 'about' | 'contact' | null`) and remember `_prevPage` so closing a panel returns to the previously-viewed page.

### JS modules

**config.js** — Constants only: `SUPPORTED_LANGS`, `DEFAULT_LANGUAGE` (`'fr'`), `LANGUAGE_STORAGE_KEY`, Web3Forms access key/endpoint, all anti-spam thresholds (`CONTACT_MIN_FILL_TIME_MS`, `CONTACT_RATE_LIMIT_MS`, `CONTACT_MIN_INTERACTIONS`, `CONTACT_MAX_URLS_IN_MESSAGE`, `CONTACT_REPEAT_CHAR_LIMIT`), and a `VALIDATION` object (`NAME_MIN_LENGTH`, `SUBJECT_MIN_LENGTH`, `MESSAGE_MIN_LENGTH`).

**utils.js** — Four responsibilities:
- `safeReadStorage` / `safeWriteStorage`: localStorage with in-memory fallback for private browsing
- `normalizeSiteLanguage`: clamps any input to a value in `SUPPORTED_LANGS`, defaulting to `DEFAULT_LANGUAGE`
- `escapeHtml` / `sanitizeRichText`: XSS prevention; `sanitizeRichText` whitelists only `<p>`, `<br>`, `<em>`, `<strong>`
- `UI_TEXT` + `getUiText(path, replacements)`: fallback UI strings in FR/EN with `{key}` token interpolation; resolves through `window.getTranslationText` first, then falls back to the local table

**data.js** — Project catalog as `DATA` object with 7 categories (`stageDesign`, `windowDisplay`, `architecture`, `interior`, `event`, `graphic`, `others`). Each item has `title`, `desc`, `type`, `client`, `year`, `images[]`, and optional `cover`. Also defines `HOME_SLIDES` (6 slides) and holds mutable site state: `BASE_DATA` (deep clone for FR re-application), `siteLang`, `currentProjectState`, `homeExpanded`, `SLIDE_NATURAL_DIMS`, `rerenderPending`, `currentProjImages`, `lbIndex`, `projectRenderToken`.

**translations-inline.js** — `window.INLINE_TRANSLATIONS` with `fr` and `en` keys. Covers sidebar labels, About/Contact page content, all project category names, project titles, descriptions, and all form status messages (with `{placeholder}` tokens). The base data in `data.js` is in English; French is applied as overrides on top.

**home.js** — Renders the home slider. `computeExpandedLayout()` calculates pixel positions for a two-row grid based on viewport and natural image dimensions; rows are split as `floor(N/2)` and `ceil(N/2)`. Each slide gets CSS custom properties (`--tx-collapsed`, `--ty-collapsed`, `--scale-collapsed`, `--rot-collapsed`, `--z-collapsed`, `--tx-expanded`, `--ty-expanded`, `--scale-expanded`, `--z-expanded`) for smooth CSS transitions. A single click on a collapsed slide expands the pile; a click on an expanded slide opens its linked project. Clicking the empty track toggles the expanded state.

**gallery.js** — `openProject(cat, idx)` is the entry point. Uses a monotonically incremented `projectRenderToken` to cancel stale async image loads when the user navigates away. Hero image loads eagerly; gallery images use `loading="lazy"`. `openLightbox(index)` / `changeLightboxImg(step)` handle the modal with keyboard support (Escape, arrows) **and** touch-swipe (≥40px horizontal delta on `touchend`).

**contact.js** — `initContactForm()` binds the submit handler (idempotent via `dataset.bound`). The visible form has three fields: `name`, `email`, `message` (no subject field). `validateFormInputs()` runs checks in sequence: API key present, honeypot fields empty (static `website` + `botcheck` + dynamic `company_<random>`), min fill time, rate-limit cooldown, min name + min message length, min interaction count, no URLs in name, max URLs in message body, no `N+`-repeated characters. A dynamic honeypot field (random suffix) is injected at init via `ensureDynamicHoneypot`. Submissions POST to Web3Forms.

**app.js** — `switchLanguage(lang)` coordinates the full switch: re-clone `BASE_DATA`, apply translations to project data (FR only — EN is the base), update static page content, rebuild sidebar, re-render home slider, re-init contact form, and re-open the current project if any. `applyDataTranslations(lang)` is the early-return switch: it always restores `DATA` from `BASE_DATA`, then applies FR overrides only when `lang === 'fr'`. `renderSidebarNav()` builds collapsible category groups. `showPage(id)` handles page visibility; `openPanel(panel)` handles overlay panels (about/contact/menu) and remembers the previous page so closing returns there.

### Language system (FR/EN)

Single-source translation system — French is the default, but the underlying project data is authored in English:

- **`js/translations-inline.js`** is the only translation source. It is loaded synchronously; no async fetch is ever performed.
- Language preference is persisted via `safeWriteStorage(LANGUAGE_STORAGE_KEY, ...)`.
- `switchLanguage(lang)` in `app.js` applies translations; `getTranslationText(path)` in `app.js` resolves dot-notation paths (e.g. `'categories.stageDesign'`).
- `applyDataTranslations` clones `BASE_DATA` back into `DATA` first, then applies FR overrides — so EN is restored simply by skipping the override step.

> `data/fr.json`, `data/en.json`, and `js/lang.js` have been deleted — they were the old async-fallback system.

### Project gallery

Projects are organised into 7 categories. The home slider is driven by the `HOME_SLIDES` array in `data.js`; each entry is either a pure project reference (`{ project: { cat, idx } }`) or a custom-image slide (`{ image: 'images/...', title?, project? }`). Opening a project calls `openProject(cat, idx)` in `gallery.js`, which renders a hero image, scrollable gallery, and info panel. Clicking any image opens the lightbox.

### Contact form

`initContactForm()` in `contact.js`. Submissions go to the Web3Forms API (key in `config.js`). Spam-protection layers: static honeypots (`website`, `botcheck`) + a dynamically named honeypot (`company_<random>`), minimum fill time, rate limiting via `localStorage`, minimum interaction count (focus/input across fields), URL detection in name, repeated-character detection.

### CSS theming

All styles live in `css/style.css`. CSS custom properties at `:root`:

- `--black`, `--white`, `--panel`, `--gray`, `--line`, `--hover`, `--accent` (`#0000ff`) for colours
- `--side-safe: clamp(84px, 9vw, 140px)` for the fixed sidebar width
- `--nav-size: clamp(18px, 1.4vw, 22px)` for navigation typography
- Mobile breakpoint at 768px
- Fonts (loaded from Google Fonts in `index.html`):
  - **Marcellus** — body default
  - **Poppins** — sidebar logo, navigation, UI
  - **Cormorant Garamond** — serif accents and large headings (e.g. `.heading`)

## Deployment

Push to `main` — GitHub Pages serves the repository root automatically. The custom domain is configured via the `CNAME` file (`alcesteli.com`).
