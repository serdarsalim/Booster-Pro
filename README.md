# Searcher X

Searcher X is a Chrome Manifest V3 extension for fast search from selected text and quick engine launching from a unified popup UI.

## Core Features
- Right-click context search across enabled engines
- Popup command center for:
  - query input and one-click engine search
  - per-engine enable/disable
  - edit mode (rename/delete engines and rename section headers)
  - settings and shortcut access
- Left-click quick search support for selected content
- Built-in AI, web, research, social, productivity, and utilities engine groups

## Default Starter Layout
On fresh install/reset, the popup starts with 6 categories (3 engines each):
- Row 1: `AI` (ChatGPT, Perplexity, Exa), `Social Media` (YouTube, Reddit, Twitter/X), `Utilities` (Wikipedia, Google Maps, Grokopedia)
- Row 2: `Productivity` (Gmail, Google Drive, Notion), `Tech` (GitHub, Stack Overflow, CodePen), `Web` (Google, Bing, DuckDuckGo)

By default, only `AI`, `Social Media`, and `Utilities` engines are enabled.

## Project Structure
- `background/` service worker, routing, context menus, commands, storage
- `content/` in-page quick action menu
- `ui/` command center HTML/CSS/JS
- `shared/` engine registry and settings sanitization

## Local Development
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `/Users/slm/my-portfolio/booster pro`
5. Reload the extension after source changes

## Notes
- Chrome shortcut bindings are managed by Chrome itself at `chrome://extensions/shortcuts`.
- Context menu labels follow current saved engine names.

## License
GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`).
See `LICENSE` for details.
