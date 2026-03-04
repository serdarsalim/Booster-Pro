import { BUILTIN_ENGINES, CATEGORY_ORDER, sanitizeCustomEngine } from "./engines.js";

export const GOOGLE_ANY_MODE = Object.freeze({
  COMBINED: "combined",
  SEPARATE: "separate"
});

const GOOGLE_SEARCH_BASE_URL = "https://www.google.com/search?q=";

const ENGINE_SCOPE_OVERRIDES = Object.freeze({
  linkedin: "linkedin.com/in"
});

const DEFAULT_SOURCE_PRIORITY = Object.freeze([
  "linkedin",
  "reddit",
  "twitter",
  "youtube",
  "github",
  "stackoverflow",
  "quora",
  "wikipedia"
]);

function normalizeHost(hostname) {
  const trimmed = String(hostname || "").trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
}

function normalizeScope(rawScope) {
  let value = String(rawScope || "").trim().toLowerCase();
  if (!value) {
    return "";
  }
  value = value.replace(/^site:/, "");
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/\/+$/, "");
  return value;
}

function deriveScopeFromTemplate(urlTemplate) {
  if (typeof urlTemplate !== "string" || !urlTemplate.trim()) {
    return "";
  }

  try {
    const parsed = new URL(urlTemplate);
    const host = normalizeHost(parsed.hostname);
    if (!host) {
      return "";
    }
    return normalizeScope(host);
  } catch (_error) {
    const fallbackMatch = String(urlTemplate).match(/^https?:\/\/([^/?#]+)/i);
    const host = normalizeHost(fallbackMatch ? fallbackMatch[1] : "");
    return normalizeScope(host);
  }
}

function applyLabelOverride(engine, labelOverrides) {
  if (!labelOverrides || typeof labelOverrides !== "object") {
    return engine;
  }
  const override = labelOverrides[engine.id];
  if (typeof override !== "string") {
    return engine;
  }
  const trimmed = override.trim();
  if (!trimmed) {
    return engine;
  }
  return {
    ...engine,
    name: trimmed
  };
}

function getGoogleAnyEnginePool(settings) {
  const customEngines = (settings && Array.isArray(settings.customEngines) ? settings.customEngines : [])
    .map((engine) => sanitizeCustomEngine(engine))
    .filter((engine) => Boolean(engine));
  const labelOverrides = settings && settings.engineLabelOverrides && typeof settings.engineLabelOverrides === "object"
    ? settings.engineLabelOverrides
    : {};

  return [...BUILTIN_ENGINES, ...customEngines].map((engine) => applyLabelOverride(engine, labelOverrides));
}

function getCategorySortIndex(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function resolveScope(engine) {
  const override = normalizeScope(ENGINE_SCOPE_OVERRIDES[engine.id]);
  if (override) {
    return override;
  }
  return deriveScopeFromTemplate(engine.urlTemplate);
}

export function sanitizeGoogleAnyMode(rawMode) {
  return rawMode === GOOGLE_ANY_MODE.COMBINED ? GOOGLE_ANY_MODE.COMBINED : GOOGLE_ANY_MODE.SEPARATE;
}

export function normalizeGoogleAnyKeywords(rawKeywords) {
  if (Array.isArray(rawKeywords)) {
    return Array.from(new Set(rawKeywords
      .map((value) => String(value || "").trim())
      .filter(Boolean)));
  }
  if (typeof rawKeywords !== "string") {
    return [];
  }
  return Array.from(new Set(rawKeywords
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)));
}

export function getGoogleAnySources(settings) {
  const pool = getGoogleAnyEnginePool(settings);
  const sources = [];
  const seenScopes = new Set();

  pool.forEach((engine) => {
    if (!engine || typeof engine !== "object" || typeof engine.id !== "string") {
      return;
    }

    const scope = resolveScope(engine);
    if (!scope) {
      return;
    }

    if (seenScopes.has(scope)) {
      return;
    }
    seenScopes.add(scope);

    sources.push({
      engineId: engine.id,
      name: engine.name,
      category: engine.category,
      scope
    });
  });

  sources.sort((a, b) => {
    const categoryDelta = getCategorySortIndex(a.category) - getCategorySortIndex(b.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    return a.name.localeCompare(b.name);
  });

  return { sources };
}

export function getDefaultGoogleAnySourceIds(sources) {
  const sourceList = Array.isArray(sources) ? sources : [];
  const available = new Set(sourceList.map((entry) => entry.engineId));
  const defaults = DEFAULT_SOURCE_PRIORITY.filter((engineId) => available.has(engineId));

  if (defaults.length >= 3) {
    return defaults;
  }

  const fallback = sourceList
    .slice(0, 6)
    .map((entry) => entry.engineId)
    .filter((engineId) => !defaults.includes(engineId));

  return [...defaults, ...fallback];
}

export function getGoogleAnySelectedSources(settings) {
  const { sources } = getGoogleAnySources(settings);
  const hasStoredSelection = settings
    && settings.googleAnyPlatform
    && Array.isArray(settings.googleAnyPlatform.selectedEngineIds);
  const selected = settings
    && settings.googleAnyPlatform
    && Array.isArray(settings.googleAnyPlatform.selectedEngineIds)
    ? settings.googleAnyPlatform.selectedEngineIds
    : [];

  const byId = new Map(sources.map((entry) => [entry.engineId, entry]));
  const selectedEntries = selected
    .map((engineId) => byId.get(engineId))
    .filter((entry) => Boolean(entry));

  if (hasStoredSelection) {
    return selectedEntries;
  }

  const fallbackIds = getDefaultGoogleAnySourceIds(sources);
  return fallbackIds
    .map((engineId) => byId.get(engineId))
    .filter((entry) => Boolean(entry));
}

export function buildGoogleAnyCombinedQuery(query, scopes) {
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) {
    return "";
  }
  const tokens = Array.from(new Set((Array.isArray(scopes) ? scopes : [])
    .map((value) => formatKeywordToken(value))
    .filter(Boolean)));
  if (!tokens.length) {
    return "";
  }
  const clause = tokens.join(" OR ");
  return `${trimmedQuery} (${clause})`;
}

function formatKeywordToken(keyword) {
  const trimmed = String(keyword || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^".*"$/.test(trimmed)) {
    return trimmed;
  }
  const escaped = trimmed.replaceAll("\"", "\\\"");
  return `"${escaped}"`;
}

function buildGoogleAnySingleQuery(query, keyword) {
  const trimmedQuery = String(query || "").trim();
  const token = formatKeywordToken(keyword);
  if (!trimmedQuery || !token) {
    return "";
  }
  return `${trimmedQuery} ${token}`;
}

function toGoogleSearchUrl(query) {
  return `${GOOGLE_SEARCH_BASE_URL}${encodeURIComponent(query)}`;
}

export function buildGoogleAnyUrls(query, settings) {
  const mode = sanitizeGoogleAnyMode(settings && settings.googleAnyPlatform ? settings.googleAnyPlatform.mode : "");
  const manualKeywords = settings
    && settings.googleAnyPlatform
    && Array.isArray(settings.googleAnyPlatform.manualKeywords)
    ? settings.googleAnyPlatform.manualKeywords
    : [];
  const selectedManualKeywords = settings
    && settings.googleAnyPlatform
    && Array.isArray(settings.googleAnyPlatform.selectedManualKeywords)
    ? settings.googleAnyPlatform.selectedManualKeywords
    : manualKeywords;
  const normalizedManualKeywords = normalizeGoogleAnyKeywords(manualKeywords);
  const activeManualKeywords = normalizeGoogleAnyKeywords(selectedManualKeywords)
    .filter((keyword) => normalizedManualKeywords.includes(keyword));
  const selectedSources = getGoogleAnySelectedSources(settings);
  const selectedKeywords = selectedSources.map((entry) => entry.name);
  const allKeywords = Array.from(new Set([
    ...activeManualKeywords,
    ...selectedKeywords.map((value) => String(value || "").trim()).filter(Boolean)
  ]));
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery || !allKeywords.length) {
    return [];
  }

  if (mode === GOOGLE_ANY_MODE.SEPARATE) {
    return allKeywords
      .map((keyword) => buildGoogleAnySingleQuery(trimmedQuery, keyword))
      .filter((value) => Boolean(value))
      .map((value) => toGoogleSearchUrl(value));
  }

  const combined = buildGoogleAnyCombinedQuery(trimmedQuery, allKeywords);
  return combined ? [toGoogleSearchUrl(combined)] : [];
}
