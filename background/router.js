import { buildEngineUrl, ENGINE_IDS } from "../shared/engines.js";
import { detectIntent, intentEngineHints } from "../shared/intents.js";

function uniq(ids) {
  const seen = new Set();
  const out = [];
  ids.forEach((id) => {
    if (ENGINE_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  });
  return out;
}

export function buildSmartEngineSequence(query, settings) {
  const intent = detectIntent(query);
  const activeProfile = settings.profiles[settings.activeProfileId] || settings.profiles.research;
  const hintIds = intentEngineHints(intent);
  const profileIds = activeProfile.engineIds || [];
  const stackIds = settings.searchStack.enabled ? settings.searchStack.engineIds : [];

  return uniq([...hintIds, ...stackIds, ...profileIds]);
}

export function buildSearchUrls(query, engineIds) {
  return engineIds
    .map((engineId) => ({ engineId, url: buildEngineUrl(engineId, query) }))
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
