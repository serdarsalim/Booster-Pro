import { getEnginesByIds } from "../shared/engines.js";

export const MENU_IDS = {
  ROOT: "booster-root",
  GOOGLE_ANY_PLATFORM: "booster-google-any-platform",
};

export function engineMenuId(engineId) {
  return `booster-engine-${engineId}`;
}

export function parseEngineIdFromMenu(menuItemId) {
  const match = String(menuItemId || "").match(/^booster-engine-(.+)$/);
  return match ? match[1] : null;
}

let rebuildQueue = Promise.resolve();

function removeAllMenus() {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function createMenu(properties) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(properties, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function rebuildContextMenusNow(settings) {
  await removeAllMenus();

  const selectedEngineIds = (settings.enabledEngineIds && settings.enabledEngineIds.length)
    ? settings.enabledEngineIds
    : [];

  const engines = getEnginesByIds(selectedEngineIds, settings);

  await createMenu({
    id: MENU_IDS.ROOT,
    title: "Searcher X",
    contexts: ["selection", "link"]
  });

  await createMenu({
    id: MENU_IDS.GOOGLE_ANY_PLATFORM,
    parentId: MENU_IDS.ROOT,
    title: "Search with Google",
    contexts: ["selection", "link"]
  });

  for (const engine of engines) {
    await createMenu({
      id: engineMenuId(engine.id),
      parentId: MENU_IDS.ROOT,
      title: engine.name,
      contexts: ["selection", "link"]
    });
  }
}

export function rebuildContextMenus(settings) {
  // Serialize rebuilds to prevent duplicate-ID races during rapid saves/startup.
  rebuildQueue = rebuildQueue
    .catch(() => undefined)
    .then(() => rebuildContextMenusNow(settings))
    .catch((error) => {
      const message = String((error && error.message) || "").toLowerCase();
      if (message.includes("duplicate id")) {
        return;
      }
      throw error;
    });

  return rebuildQueue;
}
