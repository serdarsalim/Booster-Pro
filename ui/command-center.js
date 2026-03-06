import { BUILTIN_ENGINES, CATEGORY_ORDER, getAvailableEngines } from "../shared/engines.js";
import { DEFAULT_SETTINGS } from "../shared/defaultSettings.js";
import {
  GOOGLE_ANY_MODE,
  getDefaultGoogleAnySourceIds,
  getGoogleAnySources,
  normalizeGoogleAnyKeywords,
  sanitizeGoogleAnyMode
} from "../shared/googleAnyPlatform.js";

const QUERY_STORAGE_KEY = "boosterPersistedQuery";
const TOP_TAB_STORAGE_KEY = "boosterPersistedTopTab";
const LAYOUT_COLUMN_COUNT = 3;

const SHARED_DISPLAY_CATEGORY_ORDER = Object.freeze([
  "AI",
  "Web",
  "Social",
  "Developer",
  "Research",
  "News",
  "Productivity",
  "Shopping",
  "Media",
  "Entertainment"
]);

const SHARED_TYPE_TO_STORAGE_CATEGORY = Object.freeze({
  AI: "AI",
  Search: "Web",
  News: "News",
  Develop: "Tech",
  Scholar: "Research",
  Social: "Social",
  Shopping: "Shopping",
  Translate: "Utilities",
  Image: "Utilities",
  Video: "Utilities",
  Movie: "Social",
  ACG: "Social",
  "Search by image": "Utilities",
  "Search in page": "Utilities",
  Music: "Utilities",
  APP: "Utilities",
  "Web cache": "Utilities",
  Assit: "Productivity",
  Wiki: "Research",
  "E-book": "Research",
  Download: "Utilities",
  Page: "Utilities"
});

const SHARED_TYPE_TO_DISPLAY_CATEGORY = Object.freeze({
  AI: "AI",
  Search: "Web",
  Social: "Social",
  Develop: "Developer",
  Scholar: "Research",
  Wiki: "Research",
  "E-book": "Research",
  News: "News",
  Assit: "Productivity",
  Translate: "Productivity",
  APP: "Productivity",
  "Search in page": "Productivity",
  Shopping: "Shopping",
  Image: "Media",
  Video: "Media",
  Music: "Media",
  "Search by image": "Media",
  Movie: "Entertainment",
  ACG: "Entertainment",
  Download: "Web",
  "Web cache": "Web",
  Page: "Web"
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

let settings = null;
let autosaveTimer = null;
let querySelectOnFocusArmed = true;
let activeView = "menu";
let editMode = false;
let editDraft = null;
let googleAnyKeywordEditMode = false;
let googleAnyAddKeywordMode = false;
let googleAnyAddKeywordDraft = "";
let suppressGoogleAnyAddBlurCommit = false;

let activeAddSectionId = null;
let sharedCatalog = [];
let sharedCatalogLoaded = false;
let sharedCatalogByKey = new Map();
let toastTimer = null;

const dragState = {
  engineId: null,
  sourceSectionId: null
};

const GOOGLE_ANY_PRESET_CATEGORIES = Object.freeze(["Social", "News", "Tech", "Utilities"]);
const GOOGLE_ANY_EXCLUDED_ENGINE_IDS = new Set([
  "ai-monitor",
  "al-jazeera",
  "devto",
  "discord",
  "docker-hub",
  "gitlab",
  "grokopedia",
  "hacker-news",
  "imdb",
  "mdn",
  "medium",
  "npm",
  "product-hunt",
  "pypi",
  "substack",
  "tumblr"
]);

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || response.ok !== true) {
        reject(new Error((response && response.error) || "Request failed"));
        return;
      }
      resolve(response);
    });
  });
}

function getCurrentExtensionTab() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.getCurrent((tab) => {
        resolve(tab || null);
      });
    } catch (_error) {
      resolve(null);
    }
  });
}

async function closeAttachedPopupIfNeeded() {
  const currentTab = await getCurrentExtensionTab();
  if (currentTab) {
    return;
  }
  setTimeout(() => {
    try {
      window.close();
    } catch (_error) {
      // Ignore close failures.
    }
  }, 30);
}

async function updateStandaloneButtonVisibility() {
  const standaloneButton = document.getElementById("open-standalone");
  if (!(standaloneButton instanceof HTMLButtonElement)) {
    return;
  }
  const currentTab = await getCurrentExtensionTab();
  standaloneButton.hidden = Boolean(currentTab);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readPersistedQuery() {
  return new Promise((resolve) => {
    chrome.storage.local.get([QUERY_STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        resolve("");
        return;
      }
      const query = result && typeof result[QUERY_STORAGE_KEY] === "string" ? result[QUERY_STORAGE_KEY] : "";
      resolve(query);
    });
  });
}

function writePersistedQuery(query) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [QUERY_STORAGE_KEY]: query }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function readPersistedTopTab() {
  return new Promise((resolve) => {
    chrome.storage.local.get([TOP_TAB_STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        resolve("menu");
        return;
      }
      const raw = result && typeof result[TOP_TAB_STORAGE_KEY] === "string"
        ? result[TOP_TAB_STORAGE_KEY]
        : "";
      resolve(raw === "google-any" ? "google-any" : "menu");
    });
  });
}

function writePersistedTopTab(viewId) {
  const normalized = viewId === "google-any" ? "google-any" : "menu";
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [TOP_TAB_STORAGE_KEY]: normalized }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function updateQueryControls() {
  const queryInput = document.getElementById("query-input");
  const clearButton = document.getElementById("clear-query");
  if (!(queryInput instanceof HTMLInputElement) || !(clearButton instanceof HTMLButtonElement)) {
    return;
  }
  clearButton.hidden = queryInput.value.length === 0;
}

function persistCurrentQuery() {
  const queryInput = document.getElementById("query-input");
  if (!(queryInput instanceof HTMLInputElement)) {
    return Promise.resolve();
  }
  return writePersistedQuery(queryInput.value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getWorkingSettings() {
  return editMode && editDraft ? editDraft : settings;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!(toast instanceof HTMLElement)) {
    return;
  }
  toast.textContent = String(message || "").trim();
  if (!toast.textContent) {
    return;
  }
  toast.hidden = false;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    toastTimer = null;
  }, 1900);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateSectionId(label, targetSettings) {
  const safe = slugify(label) || "category";
  const allIds = new Set();
  const columns = Array.isArray(targetSettings.layoutColumns) ? targetSettings.layoutColumns : [];
  columns.forEach((sections) => {
    (Array.isArray(sections) ? sections : []).forEach((section) => {
      if (section && typeof section.id === "string") {
        allIds.add(section.id);
      }
    });
  });

  let next = safe;
  let counter = 2;
  while (allIds.has(next)) {
    next = `${safe}-${counter}`;
    counter += 1;
  }
  return next;
}

function buildEmptyColumns() {
  return Array.from({ length: LAYOUT_COLUMN_COUNT }, () => []);
}

function getAllowedEngineIds(targetSettings) {
  return getAvailableEngines(targetSettings).map((engine) => engine.id);
}

function normalizeLayoutColumns(rawColumns, allowedEngineIds) {
  const out = buildEmptyColumns();
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

      const sourceId = typeof rawSection.id === "string" ? rawSection.id.trim() : "";
      let sectionId = sourceId || `category-${columnIndex + 1}-${sectionIndex + 1}`;
      if (usedSectionIds.has(sectionId)) {
        let suffix = 2;
        while (usedSectionIds.has(`${sectionId}-${suffix}`)) {
          suffix += 1;
        }
        sectionId = `${sectionId}-${suffix}`;
      }
      usedSectionIds.add(sectionId);

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

      out[columnIndex].push({ id: sectionId, name, engineIds });
    });
  }

  return out;
}

function buildDefaultLayoutColumns(targetSettings, allowedEngineIds) {
  const columns = buildEmptyColumns();
  const allowedSet = new Set(allowedEngineIds);
  const available = getAvailableEngines(targetSettings);
  const groups = new Map();
  CATEGORY_ORDER.forEach((category) => groups.set(category, []));

  available.forEach((engine) => {
    if (!allowedSet.has(engine.id)) {
      return;
    }
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
    const columnIndex = CATEGORY_COLUMN_INDEX[category] ?? 0;
    columns[columnIndex].push({
      id: `category-${slugify(category) || "group"}`,
      name: category === "Social" ? "Social Media" : category,
      engineIds: ids
    });
  });

  return columns;
}

function ensureLayoutColumns(targetSettings) {
  if (!targetSettings || typeof targetSettings !== "object") {
    return;
  }

  const allowedEngineIds = getAllowedEngineIds(targetSettings);
  targetSettings.layoutColumns = normalizeLayoutColumns(targetSettings.layoutColumns, allowedEngineIds);
  if (!targetSettings.layoutColumns.some((sections) => sections.length > 0) && allowedEngineIds.length > 0) {
    targetSettings.layoutColumns = buildDefaultLayoutColumns(targetSettings, allowedEngineIds);
  }

  const assigned = new Set();
  targetSettings.layoutColumns.forEach((sections) => {
    sections.forEach((section) => {
      section.engineIds.forEach((engineId) => assigned.add(engineId));
    });
  });

  const missing = allowedEngineIds.filter((engineId) => !assigned.has(engineId));
  if (!missing.length) {
    return;
  }

  if (!targetSettings.layoutColumns[0].length) {
    targetSettings.layoutColumns[0].push({
      id: generateSectionId("general", targetSettings),
      name: "General",
      engineIds: []
    });
  }

  targetSettings.layoutColumns[0][0].engineIds.push(...missing);
}

function ensureSettingsShape(targetSettings) {
  if (!targetSettings || typeof targetSettings !== "object") {
    return;
  }

  targetSettings.behavior = targetSettings.behavior || {};
  if (typeof targetSettings.behavior.openInBackground !== "boolean") {
    targetSettings.behavior.openInBackground = DEFAULT_SETTINGS.behavior.openInBackground;
  }
  if (typeof targetSettings.behavior.openNextToCurrent !== "boolean") {
    targetSettings.behavior.openNextToCurrent = DEFAULT_SETTINGS.behavior.openNextToCurrent;
  }
  if (typeof targetSettings.behavior.darkMode !== "boolean") {
    targetSettings.behavior.darkMode = DEFAULT_SETTINGS.behavior.darkMode;
  }
  if (typeof targetSettings.behavior.openToolbarInStandaloneWindow !== "boolean") {
    targetSettings.behavior.openToolbarInStandaloneWindow = DEFAULT_SETTINGS.behavior.openToolbarInStandaloneWindow;
  }

  if (!targetSettings.engineLabelOverrides || typeof targetSettings.engineLabelOverrides !== "object") {
    targetSettings.engineLabelOverrides = {};
  }
  if (!targetSettings.headerLabels || typeof targetSettings.headerLabels !== "object") {
    targetSettings.headerLabels = {};
  }

  const googleAnySources = getGoogleAnySources(targetSettings).sources
    .filter((entry) => GOOGLE_ANY_PRESET_CATEGORIES.includes(entry.category));
  const googleAnySourceIds = new Set(googleAnySources.map((entry) => entry.engineId));
  targetSettings.googleAnyPlatform = targetSettings.googleAnyPlatform || {};
  targetSettings.googleAnyPlatform.mode = sanitizeGoogleAnyMode(targetSettings.googleAnyPlatform.mode);
  targetSettings.googleAnyPlatform.manualKeywords = normalizeGoogleAnyKeywords(
    targetSettings.googleAnyPlatform.manualKeywords
  );
  const normalizedManualKeywords = targetSettings.googleAnyPlatform.manualKeywords;
  const hasStoredManualSelection = Array.isArray(targetSettings.googleAnyPlatform.selectedManualKeywords);
  targetSettings.googleAnyPlatform.selectedManualKeywords = hasStoredManualSelection
    ? normalizeGoogleAnyKeywords(targetSettings.googleAnyPlatform.selectedManualKeywords)
      .filter((keyword) => normalizedManualKeywords.includes(keyword))
    : normalizedManualKeywords.slice();
  const hasStoredSelection = Array.isArray(targetSettings.googleAnyPlatform.selectedEngineIds);
  const selected = hasStoredSelection
    ? targetSettings.googleAnyPlatform.selectedEngineIds.filter((engineId) => (
      typeof engineId === "string" && googleAnySourceIds.has(engineId)
    ))
    : [];
  const socialDefaults = googleAnySources
    .filter((entry) => entry.category === "Social")
    .map((entry) => entry.engineId);
  targetSettings.googleAnyPlatform.selectedEngineIds = hasStoredSelection
    ? Array.from(new Set(selected))
    : (socialDefaults.length ? socialDefaults : getDefaultGoogleAnySourceIds(googleAnySources));

  ensureLayoutColumns(targetSettings);
}

function getEngineMap(targetSettings) {
  const map = new Map();
  getAvailableEngines(targetSettings).forEach((engine) => {
    map.set(engine.id, engine);
  });
  return map;
}

function updateTopActionButtons() {
  const settingsButton = document.getElementById("open-settings");
  const googleAnyButton = document.getElementById("open-google-any");
  const listViewButton = document.getElementById("go-list-view");

  if (!(settingsButton instanceof HTMLButtonElement)
    || !(googleAnyButton instanceof HTMLButtonElement)
    || !(listViewButton instanceof HTMLButtonElement)) {
    return;
  }

  settingsButton.hidden = false;
  googleAnyButton.hidden = false;
  settingsButton.setAttribute("aria-pressed", activeView === "settings" ? "true" : "false");
  googleAnyButton.setAttribute("aria-pressed", activeView === "google-any" ? "true" : "false");
  listViewButton.setAttribute("aria-pressed", activeView === "menu" ? "true" : "false");

  const startEditButton = document.getElementById("start-edit");
  if (startEditButton instanceof HTMLButtonElement) {
    startEditButton.textContent = editMode ? "Done" : "Edit";
    startEditButton.setAttribute("aria-pressed", editMode ? "true" : "false");
    startEditButton.title = editMode ? "Done editing" : "Edit";
  }
}

function setActiveView(viewId) {
  const menuView = document.getElementById("menu-view");
  const settingsView = document.getElementById("settings-view");
  const googleAnyView = document.getElementById("google-any-view");
  if (!(menuView instanceof HTMLElement)
    || !(settingsView instanceof HTMLElement)
    || !(googleAnyView instanceof HTMLElement)) {
    return;
  }
  activeView = viewId === "settings"
    ? "settings"
    : (viewId === "google-any" ? "google-any" : "menu");

  if (activeView === "menu" || activeView === "google-any") {
    writePersistedTopTab(activeView).catch(() => undefined);
  }

  menuView.hidden = activeView !== "menu";
  settingsView.hidden = activeView !== "settings";
  googleAnyView.hidden = activeView !== "google-any";
  if (activeView === "google-any") {
    renderGoogleAnyView();
  }
  updateTopActionButtons();
}

function syncViewHeight() {
  // Fixed-height popup mode; no dynamic syncing needed.
}

function renderSettingsForm() {
  if (!settings) {
    return;
  }
  ensureSettingsShape(settings);
  const openInBackgroundInput = document.getElementById("setting-open-background");
  const openNextInput = document.getElementById("setting-open-next");
  const openStandaloneWindowInput = document.getElementById("setting-open-standalone-window");
  if (openInBackgroundInput instanceof HTMLInputElement) {
    openInBackgroundInput.checked = Boolean(settings.behavior.openInBackground);
  }
  if (openNextInput instanceof HTMLInputElement) {
    openNextInput.checked = Boolean(settings.behavior.openNextToCurrent);
  }
  if (openStandaloneWindowInput instanceof HTMLInputElement) {
    openStandaloneWindowInput.checked = Boolean(settings.behavior.openToolbarInStandaloneWindow);
  }
}

function applyTheme(targetSettings) {
  const nextSettings = targetSettings || settings;
  if (!nextSettings) {
    return;
  }
  ensureSettingsShape(nextSettings);

  const darkMode = Boolean(nextSettings.behavior.darkMode);
  document.body.classList.toggle("theme-dark", darkMode);

  const themeButton = document.getElementById("toggle-theme");
  if (themeButton instanceof HTMLButtonElement) {
    themeButton.title = darkMode ? "Enable light mode" : "Enable dark mode";
    themeButton.setAttribute("aria-label", darkMode ? "Enable light mode" : "Enable dark mode");
    themeButton.setAttribute("aria-pressed", darkMode ? "true" : "false");
  }
}

function readMainQuery() {
  const queryInput = document.getElementById("query-input");
  if (queryInput instanceof HTMLInputElement) {
    return queryInput.value.trim();
  }
  return "";
}

function getGoogleAnyVisibleSources(currentSettings) {
  return getGoogleAnySources(currentSettings).sources
    .filter((entry) => (
      GOOGLE_ANY_PRESET_CATEGORIES.includes(entry.category)
      && !GOOGLE_ANY_EXCLUDED_ENGINE_IDS.has(entry.engineId)
    ));
}

function renderGoogleAnyModeHelp(mode, selectedCount) {
  const help = document.getElementById("google-any-mode-help");
  if (!(help instanceof HTMLElement)) {
    return;
  }

  if (selectedCount <= 0) {
    help.textContent = "Select at least one keyword to run the search.";
    return;
  }

  if (mode === GOOGLE_ANY_MODE.SEPARATE) {
    help.textContent = `${selectedCount} Google tabs, one per selected keyword.`;
    return;
  }

  help.textContent = "One Google tab with all selected keywords combined.";
}

function addGoogleAnyManualKeywordsFromInput(rawValue, includeTrailingToken = false) {
  if (!settings) {
    return String(rawValue || "");
  }
  ensureSettingsShape(settings);
  const value = String(rawValue || "");
  const parts = value.split(",");
  const incomingParts = includeTrailingToken ? parts : parts.slice(0, -1);
  const remainder = includeTrailingToken ? "" : String(parts[parts.length - 1] || "");
  const incomingKeywords = normalizeGoogleAnyKeywords(incomingParts.join(","));
  if (!incomingKeywords.length) {
    return remainder;
  }
  const currentKeywords = normalizeGoogleAnyKeywords(settings.googleAnyPlatform.manualKeywords);
  const mergedKeywords = Array.from(new Set([...currentKeywords, ...incomingKeywords]));
  settings.googleAnyPlatform.manualKeywords = mergedKeywords;
  const currentSelectedManual = normalizeGoogleAnyKeywords(settings.googleAnyPlatform.selectedManualKeywords);
  settings.googleAnyPlatform.selectedManualKeywords = Array.from(new Set([
    ...currentSelectedManual,
    ...incomingKeywords
  ])).filter((keyword) => mergedKeywords.includes(keyword));
  queueAutosave();
  return remainder;
}

function removeGoogleAnyManualKeyword(keyword) {
  if (!settings) {
    return;
  }
  ensureSettingsShape(settings);
  const target = String(keyword || "").trim().toLowerCase();
  if (!target) {
    return;
  }
  settings.googleAnyPlatform.manualKeywords = normalizeGoogleAnyKeywords(settings.googleAnyPlatform.manualKeywords)
    .filter((value) => value.trim().toLowerCase() !== target);
  settings.googleAnyPlatform.selectedManualKeywords = normalizeGoogleAnyKeywords(
    settings.googleAnyPlatform.selectedManualKeywords
  ).filter((value) => value.trim().toLowerCase() !== target);
  queueAutosave();
}

function removeGoogleAnySelectedSource(engineId) {
  if (!settings) {
    return;
  }
  ensureSettingsShape(settings);
  settings.googleAnyPlatform.selectedEngineIds = (settings.googleAnyPlatform.selectedEngineIds || [])
    .filter((value) => value !== engineId);
  queueAutosave();
}

function resetGoogleAnyKeywordsAndSources() {
  if (!settings) {
    return;
  }
  ensureSettingsShape(settings);
  const visibleSources = getGoogleAnyVisibleSources(settings);
  settings.googleAnyPlatform.selectedEngineIds = getDefaultGoogleAnySourceIds(visibleSources);
  settings.googleAnyPlatform.manualKeywords = [];
  settings.googleAnyPlatform.selectedManualKeywords = [];
  queueAutosave();
}

function renderGoogleAnyView() {
  const currentSettings = getWorkingSettings();
  if (!currentSettings) {
    return;
  }
  ensureSettingsShape(currentSettings);
  const sourceList = document.getElementById("google-any-source-list");
  const sourceListScrollTop = sourceList instanceof HTMLElement ? sourceList.scrollTop : 0;
  const googleAnyQueryInput = document.getElementById("google-any-query-input");
  const queryInput = document.getElementById("query-input");
  if (googleAnyQueryInput instanceof HTMLInputElement && queryInput instanceof HTMLInputElement) {
    if (document.activeElement !== googleAnyQueryInput) {
      googleAnyQueryInput.value = queryInput.value;
    }
  }

  const sources = getGoogleAnyVisibleSources(currentSettings);
  const selectedIds = currentSettings.googleAnyPlatform.selectedEngineIds;
  const manualKeywords = normalizeGoogleAnyKeywords(currentSettings.googleAnyPlatform.manualKeywords);
  const selectedManualKeywords = normalizeGoogleAnyKeywords(currentSettings.googleAnyPlatform.selectedManualKeywords)
    .filter((keyword) => manualKeywords.includes(keyword));
  const selectedKeywordCount = new Set([
    ...selectedManualKeywords.map((keyword) => keyword.toLowerCase()),
    ...sources
      .filter((entry) => selectedIds.includes(entry.engineId))
      .map((entry) => String(entry.name || "").trim().toLowerCase())
      .filter(Boolean)
  ]).size;

  const modeCombined = document.querySelector("input[name=\"google-any-mode\"][value=\"combined\"]");
  const modeSeparate = document.querySelector("input[name=\"google-any-mode\"][value=\"separate\"]");
  if (modeCombined instanceof HTMLInputElement) {
    modeCombined.checked = currentSettings.googleAnyPlatform.mode === GOOGLE_ANY_MODE.COMBINED;
  }
  if (modeSeparate instanceof HTMLInputElement) {
    modeSeparate.checked = currentSettings.googleAnyPlatform.mode === GOOGLE_ANY_MODE.SEPARATE;
  }
  renderGoogleAnyModeHelp(currentSettings.googleAnyPlatform.mode, selectedKeywordCount);

  const keywordEditButton = document.getElementById("google-any-keywords-edit");
  if (keywordEditButton instanceof HTMLButtonElement) {
    keywordEditButton.setAttribute("aria-pressed", googleAnyKeywordEditMode ? "true" : "false");
    keywordEditButton.title = googleAnyKeywordEditMode ? "Done editing keywords" : "Edit keyword pills";
  }

  const filteredSources = sources
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const resetButtonHtml = googleAnyKeywordEditMode
    ? "<button id=\"google-any-keywords-reset\" class=\"google-any-keyword-reset-btn google-any-keyword-reset-inline\" type=\"button\">Reset keywords</button>"
    : "";

  let customItemsHtml = "";
  let sourceItemsHtml = "";

  if (googleAnyKeywordEditMode) {
    customItemsHtml = manualKeywords
      .map((keyword) => {
        const removeButton = `
          <button
            type="button"
            class="google-any-keyword-pill-remove"
            data-google-any-pill-kind="custom"
            data-google-any-pill-value="${escapeHtml(keyword)}"
            aria-label="Remove ${escapeHtml(keyword)}"
            title="Remove ${escapeHtml(keyword)}"
          >&times;</button>
        `;
        return `
          <span class="google-any-chip-row">
            <label class="google-any-source-chip google-any-custom-chip">
              <input
                type="checkbox"
                data-google-any-custom-keyword="${escapeHtml(keyword)}"
                ${selectedManualKeywords.includes(keyword) ? "checked" : ""}
              >
              <span class="google-any-source-name">${escapeHtml(keyword)}</span>
            </label>
            ${removeButton}
          </span>
        `;
      }).join("");

    sourceItemsHtml = filteredSources.length
      ? filteredSources.map((entry) => {
        const checked = selectedIds.includes(entry.engineId) ? "checked" : "";
        const removeButton = checked
          ? `
            <button
              type="button"
              class="google-any-keyword-pill-remove"
              data-google-any-pill-kind="source"
              data-google-any-pill-value="${escapeHtml(entry.engineId)}"
              aria-label="Remove ${escapeHtml(entry.name)}"
              title="Remove ${escapeHtml(entry.name)}"
            >&times;</button>
          `
          : "";
        return `
          <span class="google-any-chip-row">
            <label class="google-any-source-chip">
              <input type="checkbox" data-google-any-source-id="${escapeHtml(entry.engineId)}" ${checked}>
              <span class="google-any-source-name">${escapeHtml(entry.name)}</span>
            </label>
            ${removeButton}
          </span>
        `;
      }).join("")
      : "<div class=\"google-any-empty\">No engines match your search.</div>";
  } else {
    const selectedCustomItemsHtml = selectedManualKeywords
      .map((keyword) => `
        <button type="button" class="google-any-source-chip google-any-custom-chip google-any-source-chip-action" data-google-any-run-keyword="${escapeHtml(keyword)}" aria-label="Search only ${escapeHtml(keyword)} on Google" title="Search only ${escapeHtml(keyword)} on Google">
          <span class="google-any-source-name">${escapeHtml(keyword)}</span>
        </button>
      `)
      .join("");

    const selectedSourceItemsHtml = filteredSources
      .filter((entry) => selectedIds.includes(entry.engineId))
      .map((entry) => `
        <button type="button" class="google-any-source-chip google-any-source-chip-action" data-google-any-run-keyword="${escapeHtml(entry.name)}" aria-label="Search only ${escapeHtml(entry.name)} on Google" title="Search only ${escapeHtml(entry.name)} on Google">
          <span class="google-any-source-name">${escapeHtml(entry.name)}</span>
        </button>
      `)
      .join("");

    customItemsHtml = selectedCustomItemsHtml;
    sourceItemsHtml = selectedSourceItemsHtml;

    if (!customItemsHtml && !sourceItemsHtml) {
      sourceItemsHtml = "<div class=\"google-any-empty\">No keywords selected. Click Edit to choose keywords.</div>";
    }
  }

  const addKeywordControlHtml = googleAnyAddKeywordMode
    ? `
      <span class="google-any-source-chip google-any-custom-chip google-any-add-pill google-any-add-pill-input-wrap">
        <input
          id="google-any-add-pill-input"
          class="google-any-add-pill-input"
          type="text"
          value="${escapeHtml(googleAnyAddKeywordDraft)}"
          placeholder="Add keyword"
          aria-label="Add keyword"
        >
      </span>
    `
    : "<button id=\"google-any-add-pill-trigger\" class=\"google-any-source-chip google-any-add-pill\" type=\"button\" aria-label=\"Add keyword\">+ Add keyword</button>";

  if (sourceList instanceof HTMLElement) {
    sourceList.innerHTML = `
      <div class="google-any-engine-chip-wrap">
        ${customItemsHtml}
        ${sourceItemsHtml}
        ${addKeywordControlHtml}
        ${resetButtonHtml}
      </div>
    `;
    sourceList.scrollTop = sourceListScrollTop;
  }

  if (googleAnyAddKeywordMode) {
    const addKeywordInput = document.getElementById("google-any-add-pill-input");
    if (addKeywordInput instanceof HTMLInputElement && document.activeElement !== addKeywordInput) {
      addKeywordInput.focus();
      const caret = addKeywordInput.value.length;
      addKeywordInput.setSelectionRange(caret, caret);
    }
  }

}

function isCustomId(engineId) {
  return String(engineId).startsWith("custom-");
}

function queueAutosave() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(() => {
    const source = editMode && editDraft ? editDraft : settings;
    if (!source) {
      autosaveTimer = null;
      return;
    }
    sendMessage("SAVE_SETTINGS", { settings: source }).catch(() => undefined);
    autosaveTimer = null;
  }, 180);
}

async function flushAutosave() {
  const source = editMode && editDraft ? editDraft : settings;
  if (!source) {
    return;
  }
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  await sendMessage("SAVE_SETTINGS", { settings: source });
}

function formatDateForFileName(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportEngineList() {
  const source = editMode && editDraft ? editDraft : settings;
  if (!source) {
    showToast("Nothing to export yet.");
    return;
  }
  ensureSettingsShape(source);
  const payload = {
    format: "searcher-x-engine-list",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: source
  };
  const fileDate = formatDateForFileName(new Date());
  downloadTextFile(`searcher-x-engine-list-${fileDate}.json`, JSON.stringify(payload, null, 2));
  showToast("Engine list exported.");
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

function updateManualAddButtonVisibility() {
  const nameInput = document.getElementById("manual-engine-name");
  const urlInput = document.getElementById("manual-engine-url");
  const addButton = document.getElementById("add-manual-engine");
  if (!(nameInput instanceof HTMLInputElement)
    || !(urlInput instanceof HTMLInputElement)
    || !(addButton instanceof HTMLButtonElement)) {
    return;
  }

  const hasName = nameInput.value.trim().length > 0;
  const hasUrl = urlInput.value.trim().length > 0;
  addButton.hidden = !(hasName && hasUrl);
}

async function importEngineListFromFile(file) {
  if (!file) {
    return;
  }
  const text = await readFileText(file);
  const parsed = JSON.parse(text);
  const importedSettings = parsed && typeof parsed === "object" && parsed.settings && typeof parsed.settings === "object"
    ? parsed.settings
    : parsed;
  if (!importedSettings || typeof importedSettings !== "object" || Array.isArray(importedSettings)) {
    throw new Error("Invalid settings file.");
  }

  const response = await sendMessage("SAVE_SETTINGS", { settings: importedSettings });
  settings = response.settings;
  editMode = false;
  editDraft = null;
  ensureSettingsShape(settings);
  closeAddMoreModal();
  render();
  renderSettingsForm();
  setActiveView("settings");
}

function runEngineSearch(engineId) {
  const queryInput = document.getElementById("query-input");
  if (!(queryInput instanceof HTMLInputElement)) {
    return;
  }

  const query = queryInput.value.trim();
  if (!query) {
    queryInput.focus();
    return;
  }

  sendMessage("RUN_SEARCH", { query, engineId }).catch(() => undefined);
}

function runGoogleAnySearch() {
  const query = readMainQuery();
  if (!query) {
    const googleAnyQueryInput = document.getElementById("google-any-query-input");
    if (activeView === "google-any" && googleAnyQueryInput instanceof HTMLInputElement) {
      googleAnyQueryInput.focus();
    } else {
      const queryInput = document.getElementById("query-input");
      if (queryInput instanceof HTMLInputElement) {
        queryInput.focus();
      }
    }
    showToast("Enter a query first.");
    return;
  }

  flushAutosave()
    .catch(() => undefined)
    .finally(() => {
      sendMessage("RUN_GOOGLE_ANY", { query }).catch(() => undefined);
    });
}

function runGoogleAnySingleKeywordSearch(keyword) {
  const normalizedKeyword = String(keyword || "").trim();
  if (!normalizedKeyword) {
    return;
  }

  const query = readMainQuery();
  if (!query) {
    const googleAnyQueryInput = document.getElementById("google-any-query-input");
    if (activeView === "google-any" && googleAnyQueryInput instanceof HTMLInputElement) {
      googleAnyQueryInput.focus();
    } else {
      const queryInput = document.getElementById("query-input");
      if (queryInput instanceof HTMLInputElement) {
        queryInput.focus();
      }
    }
    showToast("Enter a query first.");
    return;
  }

  flushAutosave()
    .catch(() => undefined)
    .finally(() => {
      sendMessage("RUN_GOOGLE_ANY_SINGLE_KEYWORD", {
        query,
        keyword: normalizedKeyword
      }).catch(() => undefined);
    });
}

function removeEngineFromAllSections(targetSettings, engineId) {
  targetSettings.layoutColumns.forEach((sections) => {
    sections.forEach((section) => {
      section.engineIds = section.engineIds.filter((id) => id !== engineId);
    });
  });
}

function removeEngine(engineId, targetSettings = settings) {
  if (!targetSettings) {
    return;
  }

  ensureSettingsShape(targetSettings);

  if (isCustomId(engineId)) {
    targetSettings.customEngines = (targetSettings.customEngines || []).filter((engine) => engine.id !== engineId);
  } else {
    const hidden = new Set(targetSettings.hiddenBuiltinIds || []);
    hidden.add(engineId);
    targetSettings.hiddenBuiltinIds = Array.from(hidden);
  }

  targetSettings.enabledEngineIds = (targetSettings.enabledEngineIds || []).filter((id) => id !== engineId);
  if (targetSettings.engineLabelOverrides && typeof targetSettings.engineLabelOverrides === "object") {
    delete targetSettings.engineLabelOverrides[engineId];
  }

  removeEngineFromAllSections(targetSettings, engineId);
}

function getSectionRef(targetSettings, sectionId) {
  if (!targetSettings || !Array.isArray(targetSettings.layoutColumns)) {
    return null;
  }
  for (let columnIndex = 0; columnIndex < targetSettings.layoutColumns.length; columnIndex += 1) {
    const sections = targetSettings.layoutColumns[columnIndex];
    const sectionIndex = sections.findIndex((section) => section.id === sectionId);
    if (sectionIndex !== -1) {
      return {
        columnIndex,
        sectionIndex,
        section: sections[sectionIndex]
      };
    }
  }
  return null;
}

function moveSectionEnginesToFallback(targetSettings, sectionToRemove, preferredColumnIndex) {
  if (!sectionToRemove.engineIds.length) {
    return;
  }

  let fallback = null;
  const preferredSections = targetSettings.layoutColumns[preferredColumnIndex] || [];
  fallback = preferredSections.find((section) => section.id !== sectionToRemove.id) || null;

  if (!fallback) {
    for (let col = 0; col < targetSettings.layoutColumns.length; col += 1) {
      fallback = targetSettings.layoutColumns[col].find((section) => section.id !== sectionToRemove.id) || null;
      if (fallback) {
        break;
      }
    }
  }

  if (!fallback) {
    const fallbackSection = {
      id: generateSectionId("general", targetSettings),
      name: "General",
      engineIds: []
    };
    targetSettings.layoutColumns[preferredColumnIndex].push(fallbackSection);
    fallback = fallbackSection;
  }

  const seen = new Set(fallback.engineIds);
  sectionToRemove.engineIds.forEach((engineId) => {
    if (seen.has(engineId)) {
      return;
    }
    seen.add(engineId);
    fallback.engineIds.push(engineId);
  });
}

function addCategory(columnIndex, targetSettings) {
  ensureSettingsShape(targetSettings);
  if (!targetSettings.layoutColumns[columnIndex]) {
    targetSettings.layoutColumns[columnIndex] = [];
  }
  const nextSection = {
    id: generateSectionId("new-category", targetSettings),
    name: "New Category",
    engineIds: []
  };
  targetSettings.layoutColumns[columnIndex].push(nextSection);
}

function removeCategory(sectionId, targetSettings) {
  ensureSettingsShape(targetSettings);
  const ref = getSectionRef(targetSettings, sectionId);
  if (!ref) {
    return;
  }

  const section = ref.section;
  moveSectionEnginesToFallback(targetSettings, section, ref.columnIndex);

  targetSettings.layoutColumns[ref.columnIndex] = targetSettings.layoutColumns[ref.columnIndex].filter(
    (candidate) => candidate.id !== sectionId
  );
}

function assignEngineToSection(targetSettings, sectionId, engineId, beforeEngineId = null) {
  ensureSettingsShape(targetSettings);

  targetSettings.layoutColumns.forEach((sections) => {
    sections.forEach((section) => {
      section.engineIds = section.engineIds.filter((id) => id !== engineId);
    });
  });

  const ref = getSectionRef(targetSettings, sectionId);
  if (!ref) {
    return;
  }

  const list = ref.section.engineIds;
  if (beforeEngineId) {
    const index = list.indexOf(beforeEngineId);
    if (index !== -1) {
      list.splice(index, 0, engineId);
    } else {
      list.push(engineId);
    }
  } else {
    list.push(engineId);
  }

  targetSettings.hiddenBuiltinIds = (targetSettings.hiddenBuiltinIds || []).filter((id) => id !== engineId);

  const enabled = new Set(targetSettings.enabledEngineIds || []);
  enabled.add(engineId);
  targetSettings.enabledEngineIds = Array.from(enabled);
}

function renderEngineItem(engine, enabledSet) {
  const checked = enabledSet.has(engine.id) ? "checked" : "";
  const visibilityLabel = checked
    ? "Hide from right-click menu"
    : "Show in right-click menu";

  if (editMode) {
    return `
      <div class="engine-item engine-item-edit" draggable="true" data-drag-engine-id="${escapeHtml(engine.id)}" data-section-id="${escapeHtml(engine.sectionId)}">
        <span class="drag-handle" title="Drag to reorder or move">&#8942;&#8942;</span>
        <span class="engine-main">
          <input
            type="text"
            class="engine-name-input"
            data-edit-engine-id="${escapeHtml(engine.id)}"
            value="${escapeHtml(engine.name)}"
            aria-label="Rename ${escapeHtml(engine.name)} engine"
          >
        </span>
        <label class="engine-visibility engine-visibility-edit" aria-label="${escapeHtml(visibilityLabel)}" title="${escapeHtml(visibilityLabel)}">
          <input class="engine-visibility-input" type="checkbox" name="enabled-engine" value="${escapeHtml(engine.id)}" ${checked}>
          <span class="engine-visibility-icon" aria-hidden="true"></span>
        </label>
        <button type="button" class="remove-btn remove-btn-edit" data-remove-id="${escapeHtml(engine.id)}" aria-label="Remove engine">&times;</button>
      </div>
    `;
  }

  return `
    <div class="engine-item">
      <span class="engine-main">
        <span class="engine-leading-spacer" aria-hidden="true"></span>
        <button type="button" class="search-btn" data-search-id="${escapeHtml(engine.id)}">${escapeHtml(engine.name)}</button>
      </span>
    </div>
  `;
}

function renderSection(section, engineMap, enabledSet) {
  const engines = section.engineIds
    .map((engineId) => {
      const engine = engineMap.get(engineId);
      if (!engine) {
        return null;
      }
      return {
        ...engine,
        sectionId: section.id
      };
    })
    .filter((engine) => Boolean(engine));

  const headerTitle = editMode
    ? `
      <input
        class="category-name-input"
        type="text"
        data-section-name-id="${escapeHtml(section.id)}"
        value="${escapeHtml(section.name)}"
        aria-label="Rename ${escapeHtml(section.name)} category"
      >
    `
    : "";

  const headerDelete = editMode
    ? `<button type="button" class="remove-category-btn" data-remove-section="${escapeHtml(section.id)}" aria-label="Remove category">&times;</button>`
    : "";

  const controls = editMode
    ? `
      <div class="category-actions">
        <button type="button" class="add-more-btn" data-add-more-section="${escapeHtml(section.id)}">+ Add more</button>
      </div>
    `
    : "";

  const inlineTitle = editMode
    ? ""
    : `
      <div class="engine-item category-inline-item">
        <span class="engine-main">
          <span class="engine-leading-spacer" aria-hidden="true"></span>
          <span class="category-inline-title">${escapeHtml(section.name)}</span>
        </span>
      </div>
    `;

  return `
    <section class="category-card" data-section-id="${escapeHtml(section.id)}">
      ${editMode
        ? `
      <header class="category-header">
        <div class="category-header-row">
          ${headerTitle}
          ${headerDelete}
        </div>
        ${controls}
      </header>
      `
        : ""}
      <div class="engine-list" data-section-id="${escapeHtml(section.id)}">
        ${inlineTitle}
        ${engines.map((engine) => renderEngineItem(engine, enabledSet)).join("")}
      </div>
    </section>
  `;
}

function renderColumns(workingSettings) {
  const engineColumns = document.getElementById("engine-columns");
  if (!(engineColumns instanceof HTMLElement)) {
    return;
  }

  const enabledSet = new Set(workingSettings.enabledEngineIds || []);
  const engineMap = getEngineMap(workingSettings);

  const html = workingSettings.layoutColumns
    .map((sections, columnIndex) => {
      const sectionHtml = sections.map((section) => renderSection(section, engineMap, enabledSet)).join("");
      const addCategoryButton = editMode
        ? `<button type="button" class="add-category-btn" data-add-category-column="${columnIndex}">+ Add category</button>`
        : "";

      return `
        <section class="engine-col" data-column-index="${columnIndex}">
          ${sectionHtml}
          ${addCategoryButton}
        </section>
      `;
    })
    .join("");

  engineColumns.innerHTML = html;
}

function render() {
  const workingSettings = getWorkingSettings();
  if (!workingSettings) {
    return;
  }
  const activePanel = document.querySelector(".page-view:not([hidden]) .engine-panel");
  const panelScrollTop = activePanel instanceof HTMLElement ? activePanel.scrollTop : 0;

  ensureSettingsShape(workingSettings);
  renderColumns(workingSettings);
  if (activeView === "google-any") {
    renderGoogleAnyView();
  }
  applyTheme(workingSettings);

  document.body.classList.toggle("is-edit-mode", editMode);
  updateTopActionButtons();
  syncViewHeight();
  if (activePanel instanceof HTMLElement) {
    activePanel.scrollTop = panelScrollTop;
  }
}

function resetDefaults() {
  closeAddMoreModal();
  editMode = false;
  editDraft = null;
  settings = deepClone(DEFAULT_SETTINGS);
  ensureSettingsShape(settings);
  render();
  renderSettingsForm();
  queueAutosave();
}

function enterEditMode() {
  if (!settings || editMode) {
    return;
  }
  editDraft = deepClone(settings);
  ensureSettingsShape(editDraft);
  editMode = true;
  setActiveView("menu");
  render();
}

function exitEditMode() {
  if (!editMode) {
    return;
  }
  closeAddMoreModal();
  if (editDraft) {
    settings = deepClone(editDraft);
  }
  editMode = false;
  editDraft = null;
  render();
  renderSettingsForm();
  queueAutosave();
}

function mapSharedTypeToStorageCategory(type) {
  const mapped = SHARED_TYPE_TO_STORAGE_CATEGORY[type];
  if (mapped && CATEGORY_ORDER.includes(mapped)) {
    return mapped;
  }
  return "Web";
}

function mapSharedTypeToDisplayCategory(type) {
  const mapped = SHARED_TYPE_TO_DISPLAY_CATEGORY[type];
  if (mapped && SHARED_DISPLAY_CATEGORY_ORDER.includes(mapped)) {
    return mapped;
  }
  return "Web";
}

function getSharedDisplayCategorySortIndex(category) {
  const index = SHARED_DISPLAY_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? SHARED_DISPLAY_CATEGORY_ORDER.length : index;
}

function isCompatibleSharedEntry(site) {
  if (!site || typeof site !== "object") {
    return false;
  }

  const name = typeof site.name === "string" ? site.name.trim() : "";
  const url = typeof site.url === "string" ? site.url.trim() : "";
  if (!name || !url || !url.includes("%s")) {
    return false;
  }
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }
  return true;
}

async function loadSharedCatalog() {
  if (sharedCatalogLoaded) {
    return;
  }

  sharedCatalogLoaded = true;
  sharedCatalog = [];
  sharedCatalogByKey = new Map();

  const dedupe = new Set();
  BUILTIN_ENGINES.forEach((engine) => {
    if (!engine || typeof engine !== "object") {
      return;
    }
    const site = {
      name: engine.name,
      url: engine.urlTemplate
    };
    if (!isCompatibleSharedEntry(site)) {
      return;
    }

    const name = site.name.trim();
    const urlTemplate = site.url.trim();
    const dedupeKey = `${name}|${urlTemplate}`;
    if (dedupe.has(dedupeKey)) {
      return;
    }
    dedupe.add(dedupeKey);

    const type = engine.category;
    const displayCategory = type === "Social" ? "Social Media" : type;
    const key = `shared-${slugify(type)}-${slugify(name)}-${sharedCatalog.length + 1}`;
    const entry = {
      key,
      type,
      category: type,
      displayCategory,
      name,
      urlTemplate,
      label: `${displayCategory} | ${name}`,
      searchText: `${displayCategory} ${name} ${type}`.toLowerCase()
    };

    sharedCatalog.push(entry);
    sharedCatalogByKey.set(key, entry);
  });

  sharedCatalog.sort((a, b) => {
    const categoryDelta = getSharedDisplayCategorySortIndex(a.displayCategory)
      - getSharedDisplayCategorySortIndex(b.displayCategory);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    return a.name.localeCompare(b.name);
  });
}

function refreshSharedSelect() {
  const input = document.getElementById("shared-search-input");
  const tableBody = document.getElementById("shared-engine-table-body");
  if (!(input instanceof HTMLInputElement) || !(tableBody instanceof HTMLElement)) {
    return;
  }

  const keyword = input.value.trim().toLowerCase();
  const filtered = keyword
    ? sharedCatalog.filter((entry) => entry.searchText.includes(keyword))
    : sharedCatalog;

  if (!filtered.length) {
    tableBody.innerHTML = "<tr class=\"shared-empty\"><td colspan=\"2\">No engines found</td></tr>";
    return;
  }

  tableBody.innerHTML = filtered
    .map((entry) => {
      return `
        <tr class="shared-row" data-shared-key="${escapeHtml(entry.key)}" title="${escapeHtml(entry.urlTemplate)}">
          <td>${escapeHtml(entry.displayCategory)}</td>
          <td>${escapeHtml(entry.name)}</td>
        </tr>
      `;
    })
    .join("");
}

function getSectionName(targetSettings, sectionId) {
  const ref = getSectionRef(targetSettings, sectionId);
  return ref ? ref.section.name : "Category";
}

function isEngineInSection(targetSettings, sectionId, engineId) {
  const ref = getSectionRef(targetSettings, sectionId);
  if (!ref) {
    return false;
  }
  return ref.section.engineIds.includes(engineId);
}

function inferStorageCategoryForSection(targetSettings, sectionId) {
  const ref = getSectionRef(targetSettings, sectionId);
  if (!ref) {
    return "Web";
  }

  const engineMap = getEngineMap(targetSettings);
  for (let index = 0; index < ref.section.engineIds.length; index += 1) {
    const engineId = ref.section.engineIds[index];
    const engine = engineMap.get(engineId);
    if (engine && CATEGORY_ORDER.includes(engine.category)) {
      return engine.category;
    }
  }

  const normalizedName = slugify(ref.section.name);
  if (normalizedName.includes("ai")) return "AI";
  if (normalizedName.includes("social")) return "Social";
  if (normalizedName.includes("news")) return "News";
  if (normalizedName.includes("product")) return "Productivity";
  if (normalizedName.includes("shop")) return "Shopping";
  if (normalizedName.includes("research")) return "Research";
  if (normalizedName.includes("tech") || normalizedName.includes("develop")) return "Tech";
  if (normalizedName.includes("util")) return "Utilities";
  return "Web";
}

async function openAddMoreModal(sectionId) {
  if (!editMode || !editDraft) {
    return;
  }

  activeAddSectionId = sectionId;
  const modal = document.getElementById("add-more-modal");
  const title = document.getElementById("add-more-title");
  const manualName = document.getElementById("manual-engine-name");
  const manualUrl = document.getElementById("manual-engine-url");
  const searchInput = document.getElementById("shared-search-input");

  if (!(modal instanceof HTMLElement) || !(title instanceof HTMLElement)) {
    return;
  }

  title.textContent = `Adding engine to ${getSectionName(editDraft, sectionId)}`;

  if (manualName instanceof HTMLInputElement) {
    manualName.value = "";
  }
  if (manualUrl instanceof HTMLInputElement) {
    manualUrl.value = "";
  }
  updateManualAddButtonVisibility();
  if (searchInput instanceof HTMLInputElement) {
    searchInput.value = "";
  }

  await loadSharedCatalog();
  refreshSharedSelect();

  modal.hidden = false;
}

function closeAddMoreModal() {
  const modal = document.getElementById("add-more-modal");
  if (modal instanceof HTMLElement) {
    modal.hidden = true;
  }
  activeAddSectionId = null;
}

function openGoogleAnyInfoModal() {
  const modal = document.getElementById("google-any-info-modal");
  const closeButton = document.getElementById("google-any-info-close");
  if (!(modal instanceof HTMLElement)) {
    return;
  }
  modal.hidden = false;
  if (closeButton instanceof HTMLButtonElement) {
    closeButton.focus();
  }
}

function closeGoogleAnyInfoModal() {
  const modal = document.getElementById("google-any-info-modal");
  if (modal instanceof HTMLElement) {
    modal.hidden = true;
  }
}

function createUniqueCustomId(name, targetSettings) {
  const base = slugify(name) || "engine";
  const usedIds = new Set();

  BUILTIN_ENGINES.forEach((engine) => usedIds.add(engine.id));
  (targetSettings.customEngines || []).forEach((engine) => {
    if (engine && typeof engine.id === "string") {
      usedIds.add(engine.id);
    }
  });

  let id = `custom-${base}`;
  let counter = 2;
  while (usedIds.has(id)) {
    id = `custom-${base}-${counter}`;
    counter += 1;
  }
  return id;
}

function upsertEngine(name, urlTemplate, category, targetSettings) {
  const normalizedName = name.trim();
  const normalizedUrl = urlTemplate.trim();
  const normalizedCategory = CATEGORY_ORDER.includes(category) ? category : "Web";

  const builtinMatch = BUILTIN_ENGINES.find((engine) => engine.urlTemplate === normalizedUrl);
  if (builtinMatch) {
    targetSettings.hiddenBuiltinIds = (targetSettings.hiddenBuiltinIds || []).filter((id) => id !== builtinMatch.id);
    return builtinMatch.id;
  }

  const existingCustom = (targetSettings.customEngines || []).find((engine) => {
    if (!engine || typeof engine !== "object") {
      return false;
    }
    return String(engine.urlTemplate || "").trim() === normalizedUrl
      || String(engine.name || "").trim().toLowerCase() === normalizedName.toLowerCase();
  });

  if (existingCustom) {
    return existingCustom.id;
  }

  const nextId = createUniqueCustomId(normalizedName, targetSettings);
  const customEngine = {
    id: nextId,
    name: normalizedName,
    urlTemplate: normalizedUrl,
    category: normalizedCategory
  };

  targetSettings.customEngines = Array.isArray(targetSettings.customEngines) ? targetSettings.customEngines : [];
  targetSettings.customEngines.push(customEngine);
  return nextId;
}

function addManualEngineToActiveSection() {
  if (!editDraft || !activeAddSectionId) {
    return;
  }

  const nameInput = document.getElementById("manual-engine-name");
  const urlInput = document.getElementById("manual-engine-url");

  if (!(nameInput instanceof HTMLInputElement)
    || !(urlInput instanceof HTMLInputElement)) {
    return;
  }

  const name = nameInput.value.trim();
  const urlTemplate = urlInput.value.trim();

  if (!name || !urlTemplate.includes("%s") || !/^https?:\/\//i.test(urlTemplate)) {
    showToast("Enter a valid engine name and URL with %s.");
    return;
  }

  const category = inferStorageCategoryForSection(editDraft, activeAddSectionId);
  const engineId = upsertEngine(name, urlTemplate, category, editDraft);
  if (isEngineInSection(editDraft, activeAddSectionId, engineId)) {
    showToast("Engine already exists in this category.");
    return;
  }
  assignEngineToSection(editDraft, activeAddSectionId, engineId);
  render();
  queueAutosave();
  closeAddMoreModal();
  showToast(`Added ${name}.`);
}

function addSharedEngineToActiveSection(sharedKey) {
  if (!editDraft || !activeAddSectionId) {
    return;
  }

  if (!sharedKey) {
    return;
  }

  const entry = sharedCatalogByKey.get(sharedKey);
  if (!entry) {
    return;
  }

  const existingBuiltin = BUILTIN_ENGINES.find((engine) => engine.urlTemplate === entry.urlTemplate);
  const maybeExistingId = existingBuiltin ? existingBuiltin.id : null;
  if (maybeExistingId && isEngineInSection(editDraft, activeAddSectionId, maybeExistingId)) {
    showToast("Engine already exists in this category.");
    return;
  }

  const engineId = upsertEngine(entry.name, entry.urlTemplate, entry.category, editDraft);
  if (isEngineInSection(editDraft, activeAddSectionId, engineId)) {
    showToast("Engine already exists in this category.");
    return;
  }
  const sectionName = getSectionName(editDraft, activeAddSectionId);
  assignEngineToSection(editDraft, activeAddSectionId, engineId);
  render();
  queueAutosave();
  showToast(`Added ${entry.name} to ${sectionName}.`);
}

function clearDropTargets() {
  document.querySelectorAll(".engine-list.is-drop-target").forEach((element) => {
    element.classList.remove("is-drop-target");
  });
}

function bindEvents() {
  const queryInput = document.getElementById("query-input");
  const googleAnyQueryInput = document.getElementById("google-any-query-input");
  const clearButton = document.getElementById("clear-query");
  const openInBackgroundInput = document.getElementById("setting-open-background");
  const openNextInput = document.getElementById("setting-open-next");
  const openStandaloneWindowInput = document.getElementById("setting-open-standalone-window");
  const importFileInput = document.getElementById("import-engine-file");

  if (queryInput instanceof HTMLInputElement) {
    queryInput.addEventListener("focus", () => {
      if (!queryInput.value || !querySelectOnFocusArmed) {
        return;
      }
      queryInput.select();
      querySelectOnFocusArmed = false;
    });

    queryInput.addEventListener("blur", () => {
      querySelectOnFocusArmed = true;
    });

    queryInput.addEventListener("input", () => {
      updateQueryControls();
      persistCurrentQuery().catch(() => undefined);
      if (activeView === "google-any") {
        renderGoogleAnyView();
      }
    });
  }

  if (googleAnyQueryInput instanceof HTMLInputElement) {
    googleAnyQueryInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      runGoogleAnySearch();
    });
  }

  if (clearButton instanceof HTMLButtonElement && queryInput instanceof HTMLInputElement) {
    clearButton.addEventListener("click", (event) => {
      event.preventDefault();
      queryInput.value = "";
      updateQueryControls();
      persistCurrentQuery().catch(() => undefined);
      queryInput.focus();
    });
  }

  if (openInBackgroundInput instanceof HTMLInputElement) {
    openInBackgroundInput.addEventListener("change", () => {
      if (!settings) {
        return;
      }
      ensureSettingsShape(settings);
      settings.behavior.openInBackground = openInBackgroundInput.checked;
      queueAutosave();
    });
  }

  if (openNextInput instanceof HTMLInputElement) {
    openNextInput.addEventListener("change", () => {
      if (!settings) {
        return;
      }
      ensureSettingsShape(settings);
      settings.behavior.openNextToCurrent = openNextInput.checked;
      queueAutosave();
    });
  }

  if (openStandaloneWindowInput instanceof HTMLInputElement) {
    openStandaloneWindowInput.addEventListener("change", () => {
      if (!settings) {
        return;
      }
      ensureSettingsShape(settings);
      settings.behavior.openToolbarInStandaloneWindow = openStandaloneWindowInput.checked;
      queueAutosave();
    });
  }

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== "google-any-add-pill-input") {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      suppressGoogleAnyAddBlurCommit = true;
      googleAnyAddKeywordDraft = "";
      googleAnyAddKeywordMode = false;
      renderGoogleAnyView();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    googleAnyAddKeywordDraft = target.value;
    addGoogleAnyManualKeywordsFromInput(googleAnyAddKeywordDraft, true);
    suppressGoogleAnyAddBlurCommit = true;
    googleAnyAddKeywordDraft = "";
    googleAnyAddKeywordMode = true;
    renderGoogleAnyView();
  });

  document.addEventListener("blur", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== "google-any-add-pill-input") {
      return;
    }

    if (suppressGoogleAnyAddBlurCommit) {
      suppressGoogleAnyAddBlurCommit = false;
      return;
    }

    googleAnyAddKeywordDraft = target.value;
    addGoogleAnyManualKeywordsFromInput(googleAnyAddKeywordDraft, true);
    googleAnyAddKeywordDraft = "";
    googleAnyAddKeywordMode = false;
    renderGoogleAnyView();
  }, true);

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.id === "google-any-query-input" && target instanceof HTMLInputElement) {
      if (queryInput instanceof HTMLInputElement && queryInput.value !== target.value) {
        queryInput.value = target.value;
      }
      updateQueryControls();
      persistCurrentQuery().catch(() => undefined);
      return;
    }

    if (target.id === "shared-search-input") {
      refreshSharedSelect();
      return;
    }

    if (target.id === "manual-engine-name" || target.id === "manual-engine-url") {
      updateManualAddButtonVisibility();
      return;
    }

    if (target.id === "google-any-add-pill-input" && target instanceof HTMLInputElement) {
      googleAnyAddKeywordDraft = target.value;
      if (!target.value.includes(",")) {
        return;
      }
      googleAnyAddKeywordDraft = addGoogleAnyManualKeywordsFromInput(target.value, false);
      googleAnyAddKeywordMode = true;
      renderGoogleAnyView();
      return;
    }

    if (!editMode || !editDraft) {
      return;
    }

    if (target instanceof HTMLInputElement) {
      const editEngineId = target.getAttribute("data-edit-engine-id");
      if (editEngineId) {
        ensureSettingsShape(editDraft);
        const trimmed = target.value.trim();
        if (trimmed) {
          editDraft.engineLabelOverrides[editEngineId] = trimmed;
        } else {
          delete editDraft.engineLabelOverrides[editEngineId];
        }
        queueAutosave();
        return;
      }

      const sectionId = target.getAttribute("data-section-name-id");
      if (sectionId) {
        const ref = getSectionRef(editDraft, sectionId);
        if (!ref) {
          return;
        }
        ref.section.name = target.value.trim() || "Category";
        queueAutosave();
      }
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (target.id === "import-engine-file") {
      const file = target.files && target.files.length ? target.files[0] : null;
      importEngineListFromFile(file)
        .then(() => {
          showToast("Engine list imported.");
        })
        .catch(() => {
          showToast("Import failed. Use a valid JSON export file.");
        })
        .finally(() => {
          target.value = "";
        });
      return;
    }

    if (!settings) {
      return;
    }

    if (target.name === "google-any-mode") {
      ensureSettingsShape(settings);
      settings.googleAnyPlatform.mode = sanitizeGoogleAnyMode(target.value);
      queueAutosave();
      renderGoogleAnyView();
      return;
    }

    const googleAnySourceId = target.getAttribute("data-google-any-source-id");
    if (googleAnySourceId) {
      ensureSettingsShape(settings);
      const selected = new Set(settings.googleAnyPlatform.selectedEngineIds || []);
      if (target.checked) {
        selected.add(googleAnySourceId);
      } else {
        selected.delete(googleAnySourceId);
      }
      settings.googleAnyPlatform.selectedEngineIds = Array.from(selected);
      queueAutosave();
      renderGoogleAnyView();
      return;
    }

    const googleAnyCustomKeyword = target.getAttribute("data-google-any-custom-keyword");
    if (googleAnyCustomKeyword) {
      ensureSettingsShape(settings);
      const selectedManual = new Set(normalizeGoogleAnyKeywords(settings.googleAnyPlatform.selectedManualKeywords));
      if (target.checked) {
        selectedManual.add(googleAnyCustomKeyword);
      } else {
        selectedManual.delete(googleAnyCustomKeyword);
      }
      settings.googleAnyPlatform.selectedManualKeywords = Array.from(selectedManual)
        .filter((keyword) => settings.googleAnyPlatform.manualKeywords.includes(keyword));
      queueAutosave();
      renderGoogleAnyView();
      return;
    }

    if (target.name !== "enabled-engine") {
      return;
    }

    const source = editMode && editDraft ? editDraft : settings;
    if (!source) {
      return;
    }

    const enabled = new Set(source.enabledEngineIds || []);
    if (target.checked) {
      enabled.add(target.value);
    } else {
      enabled.delete(target.value);
    }
    source.enabledEngineIds = Array.from(enabled);
    if (!editMode) {
      queueAutosave();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const modal = document.getElementById("add-more-modal");
    if (modal instanceof HTMLElement && !modal.hidden && target === modal) {
      closeAddMoreModal();
      return;
    }

    const infoModal = document.getElementById("google-any-info-modal");
    if (infoModal instanceof HTMLElement && !infoModal.hidden && target === infoModal) {
      closeGoogleAnyInfoModal();
      return;
    }

    const sharedRow = target.closest("[data-shared-key]");
    if (sharedRow instanceof HTMLElement) {
      const key = sharedRow.getAttribute("data-shared-key");
      if (key) {
        addSharedEngineToActiveSection(key);
      }
      return;
    }

    const removeElement = target.closest("[data-remove-id]");
    const removeId = removeElement && removeElement.getAttribute("data-remove-id");
    if (removeId) {
      if (!editMode || !editDraft) {
        return;
      }
      removeEngine(removeId, editDraft);
      render();
      queueAutosave();
      return;
    }

    const keywordRemoveElement = target.closest("[data-google-any-pill-kind]");
    const keywordKind = keywordRemoveElement && keywordRemoveElement.getAttribute("data-google-any-pill-kind");
    const keywordValue = keywordRemoveElement && keywordRemoveElement.getAttribute("data-google-any-pill-value");
    if (keywordKind && keywordValue) {
      if (keywordKind === "source") {
        removeGoogleAnySelectedSource(keywordValue);
      } else {
        removeGoogleAnyManualKeyword(keywordValue);
      }
      renderGoogleAnyView();
      return;
    }

    const singleKeywordElement = target.closest("[data-google-any-run-keyword]");
    const singleKeyword = singleKeywordElement && singleKeywordElement.getAttribute("data-google-any-run-keyword");
    if (singleKeyword) {
      if (googleAnyKeywordEditMode) {
        return;
      }
      runGoogleAnySingleKeywordSearch(singleKeyword);
      return;
    }

    const searchElement = target.closest("[data-search-id]");
    const searchId = searchElement && searchElement.getAttribute("data-search-id");
    if (searchId) {
      if (editMode) {
        return;
      }
      runEngineSearch(searchId);
      return;
    }

    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (button.id === "start-edit") {
      if (editMode) {
        exitEditMode();
        return;
      }
      if (activeView !== "menu") {
        setActiveView("menu");
      }
      enterEditMode();
      return;
    }

    if (button.id === "reset-defaults-settings") {
      const confirmed = window.confirm("Reset search engines, labels, and settings to default?");
      if (!confirmed) {
        return;
      }
      resetDefaults();
      return;
    }

    if (button.id === "open-settings") {
      if (editMode) {
        exitEditMode();
      }
      if (activeView === "settings") {
        setActiveView("menu");
        return;
      }
      renderSettingsForm();
      setActiveView("settings");
      return;
    }

    if (button.id === "google-any-run-inline") {
      runGoogleAnySearch();
      return;
    }

    if (button.id === "google-any-add-pill-trigger") {
      googleAnyAddKeywordMode = true;
      googleAnyAddKeywordDraft = "";
      renderGoogleAnyView();
      return;
    }

    if (button.id === "google-any-keywords-edit") {
      googleAnyKeywordEditMode = !googleAnyKeywordEditMode;
      renderGoogleAnyView();
      return;
    }

    if (button.id === "google-any-keywords-reset") {
      resetGoogleAnyKeywordsAndSources();
      googleAnyAddKeywordDraft = "";
      googleAnyAddKeywordMode = false;
      renderGoogleAnyView();
      return;
    }

    if (button.id === "google-any-info-open") {
      openGoogleAnyInfoModal();
      return;
    }

    if (button.id === "google-any-info-close") {
      closeGoogleAnyInfoModal();
      return;
    }

    if (button.id === "toggle-theme") {
      const source = getWorkingSettings();
      if (!source) {
        return;
      }
      ensureSettingsShape(source);
      source.behavior.darkMode = !source.behavior.darkMode;
      applyTheme(source);
      queueAutosave();
      return;
    }

    if (button.id === "open-standalone") {
      Promise.all([flushAutosave(), persistCurrentQuery()])
        .catch(() => undefined)
        .finally(() => {
          sendMessage("OPEN_COMMAND_CENTER_STANDALONE")
            .then(() => closeAttachedPopupIfNeeded())
            .catch(() => undefined);
        });
      return;
    }

    if (button.id === "open-google-any") {
      if (editMode) {
        exitEditMode();
      }
      if (activeView === "google-any") {
        setActiveView("menu");
        return;
      }
      setActiveView("google-any");
      return;
    }

    if (button.id === "go-list-view") {
      if (editMode) {
        exitEditMode();
      }
      setActiveView("menu");
      return;
    }

    if (button.id === "open-shortcuts") {
      Promise.all([flushAutosave(), persistCurrentQuery()])
        .catch(() => undefined)
        .finally(() => {
          chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
        });
      return;
    }

    if (button.id === "open-website") {
      chrome.tabs.create({ url: "https://serdarsalim.com/searcher-x" });
      return;
    }

    if (button.id === "export-engine-list") {
      exportEngineList();
      return;
    }

    if (button.id === "import-engine-list") {
      if (importFileInput instanceof HTMLInputElement) {
        importFileInput.click();
      }
      return;
    }

    if (button.id === "add-more-close") {
      closeAddMoreModal();
      return;
    }

    if (button.id === "add-manual-engine") {
      addManualEngineToActiveSection();
      return;
    }

    const addCategoryColumn = button.getAttribute("data-add-category-column");
    if (addCategoryColumn !== null) {
      if (!editMode || !editDraft) {
        return;
      }
      addCategory(Number(addCategoryColumn), editDraft);
      render();
      queueAutosave();
      return;
    }

    const removeSectionId = button.getAttribute("data-remove-section");
    if (removeSectionId) {
      if (!editMode || !editDraft) {
        return;
      }
      removeCategory(removeSectionId, editDraft);
      render();
      queueAutosave();
      return;
    }

    const addMoreSectionId = button.getAttribute("data-add-more-section");
    if (addMoreSectionId) {
      openAddMoreModal(addMoreSectionId).catch(() => undefined);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const modal = document.getElementById("add-more-modal");
      if (modal instanceof HTMLElement && !modal.hidden) {
        closeAddMoreModal();
        return;
      }
      const infoModal = document.getElementById("google-any-info-modal");
      if (infoModal instanceof HTMLElement && !infoModal.hidden) {
        closeGoogleAnyInfoModal();
      }
    }
  });

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !editMode || !editDraft) {
      return;
    }

    const row = target.closest("[data-drag-engine-id]");
    if (!(row instanceof HTMLElement)) {
      return;
    }

    const engineId = row.getAttribute("data-drag-engine-id");
    const sourceSectionId = row.getAttribute("data-section-id");
    if (!engineId || !sourceSectionId) {
      return;
    }

    dragState.engineId = engineId;
    dragState.sourceSectionId = sourceSectionId;

    row.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", engineId);
    }
  });

  document.addEventListener("dragend", () => {
    dragState.engineId = null;
    dragState.sourceSectionId = null;
    clearDropTargets();
    document.querySelectorAll(".engine-item-edit.is-dragging").forEach((element) => {
      element.classList.remove("is-dragging");
    });
  });

  document.addEventListener("dragover", (event) => {
    if (!editMode || !editDraft || !dragState.engineId) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const list = target.closest(".engine-list");
    if (!(list instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    clearDropTargets();
    list.classList.add("is-drop-target");
  });

  document.addEventListener("drop", (event) => {
    if (!editMode || !editDraft || !dragState.engineId) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const list = target.closest(".engine-list");
    if (!(list instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();

    const targetSectionId = list.getAttribute("data-section-id");
    if (!targetSectionId) {
      clearDropTargets();
      return;
    }

    const rows = Array.from(list.querySelectorAll("[data-drag-engine-id]"))
      .filter((row) => row instanceof HTMLElement)
      .filter((row) => row.getAttribute("data-drag-engine-id") !== dragState.engineId);

    let beforeEngineId = null;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rect = row.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        beforeEngineId = row.getAttribute("data-drag-engine-id");
        break;
      }
    }

    assignEngineToSection(editDraft, targetSectionId, dragState.engineId, beforeEngineId);
    clearDropTargets();
    render();
    queueAutosave();
  });
}

async function init() {
  bindEvents();
  await updateStandaloneButtonVisibility();

  const queryInput = document.getElementById("query-input");
  if (queryInput instanceof HTMLInputElement) {
    queryInput.value = await readPersistedQuery();
    updateQueryControls();
    queryInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || editMode) {
        return;
      }
      event.preventDefault();
      const firstSearchButton = document.querySelector(".search-btn");
      if (!(firstSearchButton instanceof HTMLElement)) {
        return;
      }
      const firstEngineId = firstSearchButton.getAttribute("data-search-id");
      if (firstEngineId) {
        runEngineSearch(firstEngineId);
      }
    });
  }

  try {
    const response = await sendMessage("GET_SETTINGS");
    settings = response.settings;
  } catch (_error) {
    settings = deepClone(DEFAULT_SETTINGS);
  }

  ensureSettingsShape(settings);
  render();
  renderSettingsForm();
  const persistedTopTab = await readPersistedTopTab();
  setActiveView(persistedTopTab);
  syncViewHeight();
}

init();
