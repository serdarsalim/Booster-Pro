import { BUILTIN_ENGINE_IDS, CATEGORY_ORDER, getAvailableEngines, sanitizeCustomEngine } from "./engines.js";

const LEGACY_BUILTIN_ID_MAP = Object.freeze({
  gemini: "youcom"
});

const LAYOUT_COLUMN_COUNT = 3;
const STARTER_VISIBLE_BUILTIN_IDS = Object.freeze([
  "chatgpt",
  "perplexity",
  "youcom",
  "youtube",
  "reddit",
  "twitter",
  "google",
  "bing",
  "duckduckgo",
  "gmail",
  "google-drive",
  "notion",
  "wikipedia",
  "google-maps",
  "grokopedia",
  "google-news",
  "reuters",
  "bbc"
]);

const DEFAULT_ENABLED_BUILTIN_IDS = STARTER_VISIBLE_BUILTIN_IDS;
const DEFAULT_HIDDEN_BUILTIN_IDS = BUILTIN_ENGINE_IDS.filter((id) => !STARTER_VISIBLE_BUILTIN_IDS.includes(id));
const DEFAULT_LAYOUT_COLUMNS = Object.freeze([
  [
    { id: "ai", name: "AI", engineIds: ["chatgpt", "perplexity", "youcom"] },
    { id: "social-media", name: "Social Media", engineIds: ["youtube", "reddit", "twitter"] }
  ],
  [
    { id: "web", name: "Web", engineIds: ["google", "bing", "duckduckgo"] },
    { id: "productivity", name: "Productivity", engineIds: ["gmail", "google-drive", "notion"] }
  ],
  [
    { id: "utilities", name: "Utilities", engineIds: ["wikipedia", "google-maps", "grokopedia"] },
    { id: "news", name: "News", engineIds: ["google-news", "reuters", "bbc"] }
  ]
]);

const DEFAULT_HEADER_LABELS = Object.freeze({
  AI: "AI",
  Web: "Web",
  Tech: "Tech",
  Shopping: "Shopping",
  News: "News",
  Research: "Research",
  Social: "Social Media",
  Productivity: "Productivity",
  Utilities: "Utilities"
});

const CATEGORY_COLUMN_INDEX = Object.freeze({
  AI: 0,
  Web: 1,
  Tech: 2,
  Shopping: 0,
  News: 1,
  Research: 2,
  Social: 0,
  Productivity: 1,
  Utilities: 2
});

export const DEFAULT_SETTINGS = {
  schemaVersion: 4,
  enabledEngineIds: DEFAULT_ENABLED_BUILTIN_IDS.filter((id) => BUILTIN_ENGINE_IDS.includes(id)),
  hiddenBuiltinIds: DEFAULT_HIDDEN_BUILTIN_IDS,
  customEngines: [],
  engineLabelOverrides: {},
  headerLabels: {},
  layoutColumns: DEFAULT_LAYOUT_COLUMNS.map((column) => column.map((section) => ({
    ...section,
    engineIds: section.engineIds.filter((id) => BUILTIN_ENGINE_IDS.includes(id))
  }))),
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSectionId(baseId, usedIds) {
  const safeBase = slugify(baseId) || "category";
  let nextId = safeBase;
  let counter = 2;
  while (usedIds.has(nextId)) {
    nextId = `${safeBase}-${counter}`;
    counter += 1;
  }
  usedIds.add(nextId);
  return nextId;
}

function sanitizeLayoutColumns(rawColumns, allowedEngineIds) {
  const out = Array.from({ length: LAYOUT_COLUMN_COUNT }, () => []);
  const allowedSet = new Set(allowedEngineIds);
  const usedSectionIds = new Set();
  const usedEngineIds = new Set();

  if (!Array.isArray(rawColumns)) {
    return out;
  }

  for (let columnIndex = 0; columnIndex < LAYOUT_COLUMN_COUNT; columnIndex += 1) {
    const rawSections = Array.isArray(rawColumns[columnIndex]) ? rawColumns[columnIndex] : [];
    rawSections.forEach((rawSection, sectionIndex) => {
      if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) {
        return;
      }

      const rawId = typeof rawSection.id === "string" ? rawSection.id.trim() : "";
      const id = uniqueSectionId(rawId || `category-${columnIndex + 1}-${sectionIndex + 1}`, usedSectionIds);

      const rawName = typeof rawSection.name === "string" ? rawSection.name.trim() : "";
      const name = rawName || `Category ${sectionIndex + 1}`;

      const rawEngineIds = Array.isArray(rawSection.engineIds) ? rawSection.engineIds : [];
      const engineIds = [];
      rawEngineIds.forEach((engineId) => {
        if (typeof engineId !== "string" || !allowedSet.has(engineId) || usedEngineIds.has(engineId)) {
          return;
        }
        usedEngineIds.add(engineId);
        engineIds.push(engineId);
      });

      out[columnIndex].push({ id, name, engineIds });
    });
  }

  return out;
}

function appendMissingEngines(columns, allowedEngineIds) {
  const assigned = new Set();
  columns.forEach((sections) => {
    sections.forEach((section) => {
      section.engineIds.forEach((engineId) => assigned.add(engineId));
    });
  });

  const missing = allowedEngineIds.filter((engineId) => !assigned.has(engineId));
  if (!missing.length) {
    return columns;
  }

  if (!columns[0].length) {
    columns[0].push({
      id: "general",
      name: "General",
      engineIds: []
    });
  }

  columns[0][0].engineIds.push(...missing);
  return columns;
}

function migrateLayoutColumns(hiddenBuiltinIds, customEngines, headerLabels, allowedEngineIds) {
  const columns = Array.from({ length: LAYOUT_COLUMN_COUNT }, () => []);
  const usedSectionIds = new Set();

  const available = getAvailableEngines({
    hiddenBuiltinIds,
    customEngines
  });

  const groups = new Map();
  CATEGORY_ORDER.forEach((category) => groups.set(category, []));
  available.forEach((engine) => {
    if (!groups.has(engine.category)) {
      groups.set(engine.category, []);
    }
    groups.get(engine.category).push(engine.id);
  });

  CATEGORY_ORDER.forEach((category) => {
    const ids = groups.get(category) || [];
    if (!ids.length) {
      return;
    }
    const sectionId = uniqueSectionId(`category-${category}`, usedSectionIds);
    const name = headerLabels[category] || DEFAULT_HEADER_LABELS[category] || category;
    const columnIndex = CATEGORY_COLUMN_INDEX[category] ?? 0;
    columns[columnIndex].push({
      id: sectionId,
      name,
      engineIds: ids.filter((engineId) => allowedEngineIds.includes(engineId))
    });
  });

  return appendMissingEngines(columns, allowedEngineIds);
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
  let layoutColumns = sanitizeLayoutColumns(settings.layoutColumns, allowedEngineIds);
  if (!layoutColumns.some((sections) => sections.length > 0)) {
    layoutColumns = migrateLayoutColumns(hiddenBuiltinIds, customEngines, headerLabels, allowedEngineIds);
  }
  layoutColumns = appendMissingEngines(layoutColumns, allowedEngineIds);

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
    layoutColumns,
    behavior
  };
}
