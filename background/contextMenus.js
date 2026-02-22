import { getEnginesByIds } from "../shared/engines.js";

export const MENU_IDS = {
  ROOT: "booster-root"
};

export function engineMenuId(engineId) {
  return `booster-engine-${engineId}`;
}

export function parseEngineIdFromMenu(menuItemId) {
  const match = String(menuItemId || "").match(/^booster-engine-(.+)$/);
  return match ? match[1] : null;
}

export async function rebuildContextMenus(settings) {
  await chrome.contextMenus.removeAll();

  const selectedEngineIds = (settings.enabledEngineIds && settings.enabledEngineIds.length)
    ? settings.enabledEngineIds
    : [];

  const engines = getEnginesByIds(selectedEngineIds, settings);
  if (!engines.length) {
    return;
  }

  chrome.contextMenus.create({
    id: MENU_IDS.ROOT,
    title: "Search with",
    contexts: ["selection", "link"]
  });

  engines.forEach((engine) => {
    chrome.contextMenus.create({
      id: engineMenuId(engine.id),
      parentId: MENU_IDS.ROOT,
      title: engine.name,
      contexts: ["selection", "link"]
    });
  });
}
