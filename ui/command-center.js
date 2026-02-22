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

let settings = null;
let autosaveTimer = null;
let querySelectOnFocusArmed = true;

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

function ensureBehaviorSettings() {
  settings.behavior = settings.behavior || {};
  if (typeof settings.behavior.openInBackground !== "boolean") {
    settings.behavior.openInBackground = DEFAULT_SETTINGS.behavior.openInBackground;
  }
  if (typeof settings.behavior.openNextToCurrent !== "boolean") {
    settings.behavior.openNextToCurrent = DEFAULT_SETTINGS.behavior.openNextToCurrent;
  }
}

function setActiveView(viewId) {
  const menuView = document.getElementById("menu-view");
  const settingsView = document.getElementById("settings-view");
  if (!(menuView instanceof HTMLElement) || !(settingsView instanceof HTMLElement)) {
    return;
  }
  const showSettings = viewId === "settings";
  menuView.hidden = showSettings;
  settingsView.hidden = !showSettings;
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
  ensureBehaviorSettings();
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

function removeEngine(engineId) {
  if (isCustomId(engineId)) {
    settings.customEngines = (settings.customEngines || []).filter((engine) => engine.id !== engineId);
  } else {
    const hidden = new Set(settings.hiddenBuiltinIds || []);
    hidden.add(engineId);
    settings.hiddenBuiltinIds = Array.from(hidden);
  }

  settings.enabledEngineIds = (settings.enabledEngineIds || []).filter((id) => id !== engineId);
  render();
  queueAutosave();
}

function renderCategory(category, engines, enabledSet) {
  const containerId = CONTAINER_IDS[category];
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = engines
    .map((engine) => {
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
          <button type="button" class="remove-btn" data-remove-id="${engine.id}">x</button>
        </div>
      `;
    })
    .join("");
}

function render() {
  const enabledSet = new Set(settings.enabledEngineIds || []);
  const grouped = groupEnginesByCategory(settings);

  CATEGORY_ORDER.forEach((category) => {
    renderCategory(category, grouped.get(category) || [], enabledSet);
  });
  syncViewHeight();
}

function addCustomEngine() {
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
  settings = deepClone(DEFAULT_SETTINGS);
  render();
  renderSettingsForm();
  queueAutosave();
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
      ensureBehaviorSettings();
      settings.behavior.openInBackground = openInBackgroundInput.checked;
      queueAutosave();
    });
  }

  if (openNextInput instanceof HTMLInputElement) {
    openNextInput.addEventListener("change", () => {
      if (!settings) {
        return;
      }
      ensureBehaviorSettings();
      settings.behavior.openNextToCurrent = openNextInput.checked;
      queueAutosave();
    });
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.name !== "enabled-engine") {
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
      removeEngine(removeId);
      return;
    }

    const searchElement = target.closest("[data-search-id]");
    const searchId = searchElement && searchElement.getAttribute("data-search-id");
    if (searchId) {
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

    if (button.id === "reset-defaults-settings") {
      const confirmed = window.confirm("Reset all settings and engines to default?");
      if (!confirmed) {
        return;
      }
      resetDefaults();
      return;
    }

    if (button.id === "open-settings") {
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
