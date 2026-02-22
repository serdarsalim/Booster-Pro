import { getSettings, saveSettings } from "./storage.js";
import { handleCommand } from "./commands.js";
import { parseEngineIdFromMenu, rebuildContextMenus } from "./contextMenus.js";
import { buildSearchUrls, openUrls } from "./router.js";

function getQueryFromInfo(info) {
  return (info.selectionText || info.linkUrl || "").trim();
}

async function runSearch({ query, engineId, engineIds }) {
  if (!query || !query.trim()) {
    return { opened: 0 };
  }

  const settings = await getSettings();

  let targetEngineIds = [];
  if (engineId) {
    targetEngineIds = [engineId];
  } else if (Array.isArray(engineIds) && engineIds.length) {
    targetEngineIds = engineIds;
  } else {
    targetEngineIds = (settings.enabledEngineIds || []).slice(0, 1);
  }

  const entries = buildSearchUrls(query, targetEngineIds, settings);
  await openUrls(entries, settings);

  return {
    opened: entries.length,
    engineIds: entries.map((entry) => entry.engineId)
  };
}

async function bootstrap() {
  const settings = await getSettings();
  await rebuildContextMenus(settings);
}

chrome.runtime.onInstalled.addListener(() => {
  bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  bootstrap();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const engineId = parseEngineIdFromMenu(info.menuItemId);
  if (!engineId) {
    return;
  }

  const query = getQueryFromInfo(info);
  await runSearch({ query, engineId });
});

chrome.commands.onCommand.addListener((command) => {
  handleCommand(command);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  (async () => {
    if (message.type === "GET_SETTINGS") {
      const settings = await getSettings();
      sendResponse({ ok: true, settings });
      return;
    }

    if (message.type === "SAVE_SETTINGS") {
      const settings = await saveSettings(message.settings || {});
      await rebuildContextMenus(settings);
      sendResponse({ ok: true, settings });
      return;
    }

    if (message.type === "RUN_SEARCH") {
      const result = await runSearch({
        query: message.query,
        engineId: message.engineId,
        engineIds: message.engineIds
      });
      sendResponse({ ok: true, result });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })().catch((error) => {
    sendResponse({ ok: false, error: String(error) });
  });

  return true;
});

bootstrap();
