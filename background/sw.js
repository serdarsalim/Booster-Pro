import { getSettings, saveSettings } from "./storage.js";
import { handleCommand } from "./commands.js";
import { MENU_IDS, parseEngineIdFromMenu, rebuildContextMenus } from "./contextMenus.js";
import { buildGoogleAnySearchUrls, buildSearchUrls, openUrls } from "./router.js";

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

async function runGoogleAnySearch({ query }) {
  if (!query || !query.trim()) {
    return { opened: 0 };
  }

  const settings = await getSettings();
  const entries = buildGoogleAnySearchUrls(query, settings);
  await openUrls(entries, settings);

  return {
    opened: entries.length,
    mode: settings && settings.googleAnyPlatform ? settings.googleAnyPlatform.mode : "combined"
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
  if (info.menuItemId === MENU_IDS.GOOGLE_ANY_PLATFORM) {
    const query = getQueryFromInfo(info);
    await runGoogleAnySearch({ query });
    return;
  }

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

    if (message.type === "RUN_GOOGLE_ANY") {
      const result = await runGoogleAnySearch({
        query: message.query
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
