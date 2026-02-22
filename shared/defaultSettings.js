import { BUILTIN_ENGINE_IDS, CATEGORY_ORDER, sanitizeCustomEngine } from "./engines.js";

const LEGACY_BUILTIN_ID_MAP = Object.freeze({
  gemini: "youcom"
});

const DEFAULT_ENABLED_BUILTIN_IDS = ["perplexity", "google", "youtube", "reddit"];

export const DEFAULT_SETTINGS = {
  schemaVersion: 3,
  enabledEngineIds: DEFAULT_ENABLED_BUILTIN_IDS.filter((id) => BUILTIN_ENGINE_IDS.includes(id)),
  hiddenBuiltinIds: [],
  customEngines: [],
  engineLabelOverrides: {},
  headerLabels: {},
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

function remapLegacyBuiltinMapKeys(rawMap) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
    return {};
  }
  const out = {};
  Object.entries(rawMap).forEach(([key, value]) => {
    const mappedKey = LEGACY_BUILTIN_ID_MAP[key] || key;
    out[mappedKey] = value;
  });
  return out;
}

function sanitizeLabelOverrides(rawMap, allowedIds) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
    return {};
  }
  const allowed = new Set(allowedIds);
  const out = {};
  Object.entries(rawMap).forEach(([id, value]) => {
    if (!allowed.has(id) || typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    out[id] = trimmed;
  });
  return out;
}

function sanitizeHeaderLabels(rawMap) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
    return {};
  }
  const out = {};
  CATEGORY_ORDER.forEach((category) => {
    const value = rawMap[category];
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    out[category] = trimmed;
  });
  return out;
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
  const engineLabelOverrides = sanitizeLabelOverrides(
    remapLegacyBuiltinMapKeys(settings.engineLabelOverrides),
    allowedEngineIds
  );
  const headerLabels = sanitizeHeaderLabels(settings.headerLabels);

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
    engineLabelOverrides,
    headerLabels,
    behavior
  };
}
