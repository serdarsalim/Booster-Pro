import { BUILTIN_ENGINE_IDS, sanitizeCustomEngine } from "./engines.js";

const LEGACY_BUILTIN_ID_MAP = Object.freeze({
  gemini: "youcom"
});

const DEFAULT_ENABLED_BUILTIN_IDS = ["perplexity", "google", "youtube", "reddit"];

export const DEFAULT_SETTINGS = {
  schemaVersion: 3,
  enabledEngineIds: DEFAULT_ENABLED_BUILTIN_IDS.filter((id) => BUILTIN_ENGINE_IDS.includes(id)),
  hiddenBuiltinIds: [],
  customEngines: [],
  behavior: {
    openInBackground: false,
    openNextToCurrent: true
  }
};

function dedupeIds(values, allowedSet) {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    if (typeof value !== "string") {
      return;
    }
    if (allowedSet && !allowedSet.has(value)) {
      return;
    }
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  });
  return out;
}

function sanitizeCustomEngines(rawCustomEngines) {
  if (!Array.isArray(rawCustomEngines)) {
    return [];
  }

  const seen = new Set();
  const custom = [];
  rawCustomEngines.forEach((rawEngine) => {
    const engine = sanitizeCustomEngine(rawEngine);
    if (!engine || seen.has(engine.id)) {
      return;
    }
    seen.add(engine.id);
    custom.push(engine);
  });
  return custom;
}

function dedupeEngineIds(engineIds, allowedIds) {
  if (!Array.isArray(engineIds)) {
    return [];
  }

  return dedupeIds(engineIds, new Set(allowedIds));
}

function remapLegacyBuiltinIds(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => {
    if (typeof value !== "string") {
      return value;
    }
    return LEGACY_BUILTIN_ID_MAP[value] || value;
  });
}

function migrateEnabledIds(settings, allowedIds) {
  const direct = dedupeEngineIds(remapLegacyBuiltinIds(settings.enabledEngineIds), allowedIds);
  if (direct.length) {
    return direct;
  }

  // Backward compatibility with earlier profile-based storage.
  const profileId = settings.activeProfileId;
  const profile = settings.profiles && settings.profiles[profileId];
  const migrated = dedupeEngineIds(remapLegacyBuiltinIds(profile && profile.engineIds), allowedIds);
  if (migrated.length) {
    return migrated;
  }

  return dedupeEngineIds(DEFAULT_SETTINGS.enabledEngineIds, allowedIds);
}

export function sanitizeSettings(rawSettings) {
  const settings = rawSettings || {};
  const customEngines = sanitizeCustomEngines(settings.customEngines);

  const hiddenBuiltinIds = dedupeIds(remapLegacyBuiltinIds(settings.hiddenBuiltinIds), new Set(BUILTIN_ENGINE_IDS));
  const visibleBuiltinIds = BUILTIN_ENGINE_IDS.filter((id) => !hiddenBuiltinIds.includes(id));
  const customEngineIds = customEngines.map((engine) => engine.id);
  const allowedEngineIds = [...visibleBuiltinIds, ...customEngineIds];

  const enabledEngineIds = migrateEnabledIds(settings, allowedEngineIds);

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
    hiddenBuiltinIds,
    customEngines,
    behavior
  };
}
