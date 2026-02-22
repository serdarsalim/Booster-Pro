import { CATEGORY_ORDER, groupEnginesByCategory } from "../shared/engines.js";
import { DEFAULT_SETTINGS } from "../shared/defaultSettings.js";

const QUERY_STORAGE_KEY = "boosterPersistedQuery";

const CONTAINER_IDS = {
  AI: "ai-engines",
  Web: "web-engines",
  Tech: "tech-engines",
  Shopping: "shopping-engines",
  News: "news-engines",
  Research: "research-engines",
  Social: "social-engines",
  Productivity: "productivity-engines",
  Utilities: "utilities-engines"
};

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

const HEADER_IDS = Object.freeze({
  AI: "header-ai",
  Web: "header-web",
  Tech: "header-tech",
  Shopping: "header-shopping",
  News: "header-news",
  Research: "header-research",
  Social: "header-social",
  Productivity: "header-productivity",
  Utilities: "header-utilities"
});

let settings = null;
let autosaveTimer = null;
let querySelectOnFocusArmed = true;
let activeView = "menu";
let editMode = false;
let editDraft = null;

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
    .replaceAll("\"", "&quot;");
}

function getWorkingSettings() {
  return editMode && editDraft ? editDraft : settings;
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

  if (!targetSettings.engineLabelOverrides || typeof targetSettings.engineLabelOverrides !== "object") {
    targetSettings.engineLabelOverrides = {};
  }
  if (!targetSettings.headerLabels || typeof targetSettings.headerLabels !== "object") {
    targetSettings.headerLabels = {};
  }
}

function getHeaderLabel(category, targetSettings) {
  const source = targetSettings || settings;
  ensureSettingsShape(source);
  const custom = source && source.headerLabels ? source.headerLabels[category] : "";
  if (typeof custom === "string" && custom.trim()) {
    return custom.trim();
  }
  return DEFAULT_HEADER_LABELS[category] || category;
}

function updateTopActionButtons() {
  const startEditButton = document.getElementById("start-edit");
  const homeButton = document.getElementById("go-home");
  const settingsButton = document.getElementById("open-settings");
  const doneButton = document.getElementById("done-edit");
  const cancelButton = document.getElementById("cancel-edit");

  if (!(startEditButton instanceof HTMLButtonElement)
    || !(homeButton instanceof HTMLButtonElement)
    || !(settingsButton instanceof HTMLButtonElement)
    || !(doneButton instanceof HTMLButtonElement)
    || !(cancelButton instanceof HTMLButtonElement)) {
    return;
  }

  if (editMode) {
    startEditButton.hidden = true;
    homeButton.hidden = true;
    settingsButton.hidden = true;
    doneButton.hidden = false;
    cancelButton.hidden = false;
    return;
  }

  startEditButton.hidden = activeView !== "menu";
  homeButton.hidden = false;
  settingsButton.hidden = false;
  doneButton.hidden = true;
  cancelButton.hidden = true;
}

function setActiveView(viewId) {
  const menuView = document.getElementById("menu-view");
  const settingsView = document.getElementById("settings-view");
  if (!(menuView instanceof HTMLElement) || !(settingsView instanceof HTMLElement)) {
    return;
  }
  activeView = viewId === "settings" ? "settings" : "menu";
  const showSettings = viewId === "settings";
  menuView.hidden = showSettings;
  settingsView.hidden = !showSettings;
  updateTopActionButtons();
}

function syncViewHeight() {
  const menuView = document.getElementById("menu-view");
  const settingsView = document.getElementById("settings-view");
  if (!(menuView instanceof HTMLElement) || !(settingsView instanceof HTMLElement)) {
    return;
  }
  const menuHeight = menuView.scrollHeight;
  if (!menuHeight) {
    return;
  }
  const lockedHeight = `${menuHeight + 20}px`;
  menuView.style.setProperty("--view-height", lockedHeight);
  settingsView.style.setProperty("--view-height", lockedHeight);
}

function renderSettingsForm() {
  if (!settings) {
    return;
  }
  ensureSettingsShape(settings);
  const openInBackgroundInput = document.getElementById("setting-open-background");
  const openNextInput = document.getElementById("setting-open-next");
  if (openInBackgroundInput instanceof HTMLInputElement) {
    openInBackgroundInput.checked = Boolean(settings.behavior.openInBackground);
  }
  if (openNextInput instanceof HTMLInputElement) {
    openNextInput.checked = Boolean(settings.behavior.openNextToCurrent);
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
    sendMessage("SAVE_SETTINGS", { settings }).catch(() => undefined);
    autosaveTimer = null;
  }, 180);
}

async function flushAutosave() {
  if (!settings) {
    return;
  }
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  await sendMessage("SAVE_SETTINGS", { settings });
}

function runEngineSearch(engineId) {
  const queryInput = document.getElementById("query-input");
  const query = queryInput.value.trim();
  if (!query) {
    queryInput.focus();
    return;
  }

  sendMessage("RUN_SEARCH", { query, engineId }).catch(() => undefined);
}

function removeEngine(engineId, targetSettings = settings) {
  if (!targetSettings) {
    return;
  }
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
}

function renderHeader(category, targetSettings) {
  const headerId = HEADER_IDS[category];
  const headerElement = document.getElementById(headerId);
  if (!(headerElement instanceof HTMLElement)) {
    return;
  }
  const label = getHeaderLabel(category, targetSettings);
  if (editMode) {
    headerElement.innerHTML = `
      <input
        class="header-name-input"
        type="text"
        data-header-category="${category}"
        value="${escapeHtml(label)}"
        aria-label="Rename ${escapeHtml(DEFAULT_HEADER_LABELS[category] || category)} section"
      >
    `;
    return;
  }
  headerElement.textContent = label;
}

function renderCategory(category, engines, enabledSet) {
  const containerId = CONTAINER_IDS[category];
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = engines
    .map((engine) => {
      if (editMode) {
        return `
          <div class="engine-item engine-item-edit">
            <span class="engine-main">
              <input
                type="text"
                class="engine-name-input"
                data-edit-engine-id="${engine.id}"
                value="${escapeHtml(engine.name)}"
                aria-label="Rename ${escapeHtml(engine.name)} engine"
              >
            </span>
            <button type="button" class="remove-btn remove-btn-edit" data-remove-id="${engine.id}">Delete</button>
          </div>
        `;
      }

      const checked = enabledSet.has(engine.id) ? "checked" : "";
      return `
        <div class="engine-item">
          <span class="engine-main">
            <label class="engine-switch" aria-label="Toggle ${engine.name}">
              <input class="engine-toggle-input" type="checkbox" name="enabled-engine" value="${engine.id}" ${checked}>
              <span class="engine-toggle"></span>
            </label>
            <button type="button" class="search-btn" data-search-id="${engine.id}">${engine.name}</button>
          </span>
          <button type="button" class="remove-btn" data-remove-id="${engine.id}">Delete</button>
        </div>
      `;
    })
    .join("");
}

function render() {
  const workingSettings = getWorkingSettings();
  if (!workingSettings) {
    return;
  }
  ensureSettingsShape(workingSettings);

  const enabledSet = new Set(workingSettings.enabledEngineIds || []);
  const grouped = groupEnginesByCategory(workingSettings);

  CATEGORY_ORDER.forEach((category) => {
    renderHeader(category, workingSettings);
    renderCategory(category, grouped.get(category) || [], enabledSet);
  });

  document.body.classList.toggle("is-edit-mode", editMode);
  updateTopActionButtons();
  syncViewHeight();
}

function addCustomEngine() {
  if (editMode) {
    return;
  }
  const nameInput = document.getElementById("custom-name");
  const urlInput = document.getElementById("custom-url");
  const categorySelect = document.getElementById("custom-category");

  const name = nameInput.value.trim();
  const urlTemplate = urlInput.value.trim();
  const category = categorySelect.value;

  if (!name || !urlTemplate || !urlTemplate.includes("%s")) {
    return;
  }

  const id = `custom-${Date.now().toString(36)}`;
  const customEngine = { id, name, urlTemplate, category };

  settings.customEngines = Array.isArray(settings.customEngines) ? settings.customEngines : [];
  settings.customEngines.push(customEngine);

  settings.enabledEngineIds = Array.isArray(settings.enabledEngineIds) ? settings.enabledEngineIds : [];
  settings.enabledEngineIds.push(id);

  nameInput.value = "";
  urlInput.value = "";

  render();
  queueAutosave();
}

function resetDefaults() {
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

function cancelEditMode() {
  if (!editMode) {
    return;
  }
  editMode = false;
  editDraft = null;
  render();
}

async function doneEditMode() {
  if (!editMode || !editDraft) {
    return;
  }

  try {
    const response = await sendMessage("SAVE_SETTINGS", { settings: editDraft });
    settings = response.settings;
  } catch (_error) {
    settings = deepClone(editDraft);
  }

  editMode = false;
  editDraft = null;
  render();
  renderSettingsForm();
}

function bindEvents() {
  const queryInput = document.getElementById("query-input");
  const clearButton = document.getElementById("clear-query");
  const openInBackgroundInput = document.getElementById("setting-open-background");
  const openNextInput = document.getElementById("setting-open-next");
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

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (!editMode || !editDraft) {
      return;
    }

    const editEngineId = target.getAttribute("data-edit-engine-id");
    if (editEngineId) {
      ensureSettingsShape(editDraft);
      const trimmed = target.value.trim();
      if (trimmed) {
        editDraft.engineLabelOverrides[editEngineId] = target.value;
      } else {
        delete editDraft.engineLabelOverrides[editEngineId];
      }
      return;
    }

    const headerCategory = target.getAttribute("data-header-category");
    if (!headerCategory || !CATEGORY_ORDER.includes(headerCategory)) {
      return;
    }
    ensureSettingsShape(editDraft);
    const trimmed = target.value.trim();
    if (trimmed) {
      editDraft.headerLabels[headerCategory] = target.value;
    } else {
      delete editDraft.headerLabels[headerCategory];
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.name !== "enabled-engine") {
      return;
    }
    if (!settings || editMode) {
      return;
    }

    const enabled = new Set(settings.enabledEngineIds || []);
    if (target.checked) {
      enabled.add(target.value);
    } else {
      enabled.delete(target.value);
    }
    settings.enabledEngineIds = Array.from(enabled);
    queueAutosave();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
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

    if (button.id === "add-custom") {
      addCustomEngine();
      return;
    }

    if (button.id === "start-edit") {
      enterEditMode();
      return;
    }

    if (button.id === "cancel-edit") {
      cancelEditMode();
      return;
    }

    if (button.id === "done-edit") {
      doneEditMode().catch(() => undefined);
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
        return;
      }
      renderSettingsForm();
      setActiveView("settings");
      return;
    }

    if (button.id === "go-home" || button.id === "go-home-title") {
      setActiveView("menu");
      return;
    }

    if (button.id === "open-shortcuts") {
      Promise.all([flushAutosave(), persistCurrentQuery()])
        .catch(() => undefined)
        .finally(() => {
          chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
        });
    }
  });
}

async function init() {
  bindEvents();
  const queryInput = document.getElementById("query-input");
  if (queryInput instanceof HTMLInputElement) {
    queryInput.value = await readPersistedQuery();
    updateQueryControls();
    queryInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
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
    render();
    renderSettingsForm();
    setActiveView("menu");
    syncViewHeight();
  } catch (_error) {
    settings = deepClone(DEFAULT_SETTINGS);
    render();
    renderSettingsForm();
    setActiveView("menu");
    syncViewHeight();
  }
}

init();
