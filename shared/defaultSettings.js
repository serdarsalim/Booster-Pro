import { ENGINE_IDS } from "./engines.js";

export const DEFAULT_SETTINGS = {
  schemaVersion: 2,
  enabledEngineIds: ["perplexity", "google", "bing", "duckduckgo", "chatgpt"],
  behavior: {
    openInBackground: false,
    openNextToCurrent: true
  }
};

function dedupeEngineIds(engineIds) {
  if (!Array.isArray(engineIds)) {
    return [];
  }

  const seen = new Set();
  const result = [];
  engineIds.forEach((engineId) => {
    if (ENGINE_IDS.includes(engineId) && !seen.has(engineId)) {
      seen.add(engineId);
      result.push(engineId);
    }
  });
  return result;
}

function migrateEnabledIds(settings) {
  const direct = dedupeEngineIds(settings.enabledEngineIds);
  if (direct.length) {
    return direct;
  }

  // Backward compatibility with earlier profile-based storage.
  const profileId = settings.activeProfileId;
  const profile = settings.profiles && settings.profiles[profileId];
  const migrated = dedupeEngineIds(profile && profile.engineIds);
  if (migrated.length) {
    return migrated;
  }

  return DEFAULT_SETTINGS.enabledEngineIds.slice();
}

export function sanitizeSettings(rawSettings) {
  const settings = rawSettings || {};

  const enabledEngineIds = migrateEnabledIds(settings);

  const behavior = {
    openInBackground: Boolean(settings.behavior && settings.behavior.openInBackground),
    openNextToCurrent:
      settings.behavior && typeof settings.behavior.openNextToCurrent === "boolean"
        ? settings.behavior.openNextToCurrent
        : DEFAULT_SETTINGS.behavior.openNextToCurrent
  };

  return {
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    enabledEngineIds,
    behavior
  };
}
