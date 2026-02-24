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

function isGoogleOwnedHost(hostname) {
  if (!hostname) {
    return false;
  }
  return hostname === "google.com" || hostname.endsWith(".google.com");
}

function deriveScopeFromTemplate(urlTemplate) {
  if (typeof urlTemplate !== "string" || !urlTemplate.trim()) {
    return "";
  }

  try {
    const parsed = new URL(urlTemplate);
    const host = normalizeHost(parsed.hostname);
    if (!host || isGoogleOwnedHost(host)) {
      return "";
    }
    return normalizeScope(host);
  } catch (_error) {
    return "";
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
  return rawMode === GOOGLE_ANY_MODE.SEPARATE ? GOOGLE_ANY_MODE.SEPARATE : GOOGLE_ANY_MODE.COMBINED;
}

export function getGoogleAnySources(settings) {
  const pool = getGoogleAnyEnginePool(settings);
  const sources = [];
  const unmapped = [];
  const seenScopes = new Set();

  pool.forEach((engine) => {
    if (!engine || typeof engine !== "object" || typeof engine.id !== "string" || engine.id === "google") {
      return;
    }

    const scope = resolveScope(engine);
    if (!scope) {
      unmapped.push({
        engineId: engine.id,
        name: engine.name,
        category: engine.category
      });
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

  unmapped.sort((a, b) => {
    const categoryDelta = getCategorySortIndex(a.category) - getCategorySortIndex(b.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    return a.name.localeCompare(b.name);
  });

  return { sources, unmapped };
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
  const selected = settings
    && settings.googleAnyPlatform
    && Array.isArray(settings.googleAnyPlatform.selectedEngineIds)
    ? settings.googleAnyPlatform.selectedEngineIds
    : [];

  const byId = new Map(sources.map((entry) => [entry.engineId, entry]));
  const selectedEntries = selected
    .map((engineId) => byId.get(engineId))
    .filter((entry) => Boolean(entry));

  if (selectedEntries.length) {
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
  const uniqueScopes = Array.from(new Set((Array.isArray(scopes) ? scopes : []).map((scope) => normalizeScope(scope)).filter(Boolean)));
  if (!uniqueScopes.length) {
    return "";
  }
  const clause = uniqueScopes.map((scope) => `site:${scope}`).join(" OR ");
  return `${trimmedQuery} (${clause})`;
}

function buildGoogleAnySingleQuery(query, scope) {
  const trimmedQuery = String(query || "").trim();
  const normalizedScope = normalizeScope(scope);
  if (!trimmedQuery || !normalizedScope) {
    return "";
  }
  return `${trimmedQuery} site:${normalizedScope}`;
}

function toGoogleSearchUrl(query) {
  return `${GOOGLE_SEARCH_BASE_URL}${encodeURIComponent(query)}`;
}

export function buildGoogleAnyUrls(query, settings) {
  const mode = sanitizeGoogleAnyMode(settings && settings.googleAnyPlatform ? settings.googleAnyPlatform.mode : "");
  const selectedSources = getGoogleAnySelectedSources(settings);
  const scopes = selectedSources.map((entry) => entry.scope);
  if (!scopes.length) {
    return [];
  }

  if (mode === GOOGLE_ANY_MODE.SEPARATE) {
    return scopes
      .map((scope) => buildGoogleAnySingleQuery(query, scope))
      .filter((value) => Boolean(value))
      .map((value) => toGoogleSearchUrl(value));
  }

  const combined = buildGoogleAnyCombinedQuery(query, scopes);
  return combined ? [toGoogleSearchUrl(combined)] : [];
}
