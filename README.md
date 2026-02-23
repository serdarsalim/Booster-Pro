# Booster PRO

Booster PRO is a Chrome Manifest V3 extension for fast search from selected text and quick engine launching from a unified popup UI.

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
- Column 1: `AI` (ChatGPT, Perplexity, You.com), `Social Media` (YouTube, Reddit, Twitter/X)
- Column 2: `Web` (Google, Bing, DuckDuckGo), `Productivity` (Gmail, Google Drive, Notion)
- Column 3: `Utilities` (Wikipedia, Google Maps, Grokopedia), `Tech` (GitHub, Stack Overflow, CodePen)

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
