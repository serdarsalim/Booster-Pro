import { buildEngineUrl } from "../shared/engines.js";

export function buildSearchUrls(query, engineIds, settings) {
  return engineIds
    .map((engineId) => ({ engineId, url: buildEngineUrl(engineId, query, settings) }))
    .filter((entry) => Boolean(entry.url));
}

export async function openUrls(entries, settings) {
  if (!entries.length) {
    return;
  }

  const openInBackground = settings.behavior.openInBackground;
  const openNextToCurrent = settings.behavior.openNextToCurrent;

  let insertIndex = null;
  if (openNextToCurrent) {
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];
    insertIndex = currentTab ? currentTab.index + 1 : null;
  }

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const shouldActivate = i === 0 ? !openInBackground : false;

    const createArgs = {
      url: entry.url,
      active: shouldActivate
    };

    if (insertIndex !== null) {
      createArgs.index = insertIndex + i;
    }

    await chrome.tabs.create(createArgs);
  }
}
