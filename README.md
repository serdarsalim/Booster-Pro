# Booster PRO (Modern Context Search Extension)

Booster PRO is a Manifest V3 Chrome extension that provides:
- smart right-click context search
- left-click quick search on selected text
- AI + classic engine routing (including Perplexity)
- a unified Command Center modal for settings, profiles, and shortcut visibility

## Highlights
- Dynamic context menus with favorites and profile engines
- Smart Search Stack that routes by query intent
- Profile-based search presets (`Research`, `Developer`, `Shopping`, `Academic`)
- Left-click quick menu with configurable modifier key
- Keyboard shortcut visibility inside Command Center (with direct system shortcut link)

## Architecture
- `shared/`: engine registry, default settings, intent detection
- `background/`: MV3 service worker orchestration, menu build, routing, commands
- `content/`: left-click quick-action UI on web pages
- `ui/`: Command Center modal page and styling

## Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `/Users/slm/my-portfolio/booster pro`

## Command Center
- Open extension popup from toolbar to access the modal settings UI.
- You can also open Command Center from the context menu.

## Notes
- Chrome requires final keyboard shortcut assignment in `chrome://extensions/shortcuts`.
- Legacy files from the original version are still present, but runtime now uses the modular MV3 architecture above.
