# Searcher X

Searcher X is a Chrome Manifest V3 extension built for fast multi-platform search directly from the app.

Instead of opening tabs and typing each platform one by one, you enter a query once and run it across selected engines in one click.

## Core Features
- One-click multi-platform search directly from the app
- Run one query across selected engines without tab-by-tab manual typing
- Search with Google mode:
  - combines your query with selected exact-match keywords
  - supports multi-tab and one-tab methods
- Supports AI-first and traditional web search engines
- Editable engine names and section headers
- Enable/disable engines with modern toggles
- Built-in categories: AI, Web, Tech, Shopping, News, Research, Social, Productivity, Utilities
- Optional standalone Searcher X window from toolbar icon
- Quick access to Chrome tab keyboard shortcuts from Settings
- Right-click text search in Chrome (included as secondary workflow)

## Default Starter Layout
On fresh install/reset, the popup starts with 6 categories (3 engines each):
- Row 1: `AI` (ChatGPT, Perplexity, Exa), `Social Media` (YouTube, Reddit, Twitter/X), `Utilities` (Wikipedia, Google Maps, Grokopedia)
- Row 2: `Productivity` (Gmail, Google Drive, Notion), `Tech` (GitHub, Stack Overflow, CodePen), `Web` (Google, Bing, DuckDuckGo)

By default, only `AI`, `Social Media`, and `Utilities` engines are enabled.

## Project Structure
- `background/` service worker, routing, context menus, commands, storage
- `content/` in-page quick action menu
- `ui/` app UI HTML/CSS/JS
- `shared/` engine registry and settings sanitization

## Local Development
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `/Users/slm/my-portfolio/search-x`
5. Reload the extension after source changes

## Notes
- Chrome shortcut bindings are managed by Chrome itself at `chrome://extensions/shortcuts`.
- Context menu labels follow current saved engine names.

## License
GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`).
See `LICENSE` for details.
