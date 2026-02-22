import { CATEGORY_ORDER, groupEnginesByCategory } from "../shared/engines.js";
import { DEFAULT_SETTINGS } from "../shared/defaultSettings.js";

const CONTAINER_IDS = {
  AI: "ai-engines",
  Web: "web-engines",
  Tech: "tech-engines",
  Shopping: "shopping-engines",
  News: "news-engines",
  Research: "research-engines",
  Social: "social-engines"
};

let settings = null;
let autosaveTimer = null;

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
  queueAutosave();
}

function bindEvents() {
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

    const removeId = target.getAttribute("data-remove-id");
    if (removeId) {
      removeEngine(removeId);
      return;
    }

    const searchId = target.getAttribute("data-search-id");
    if (searchId) {
      runEngineSearch(searchId);
      return;
    }

    if (target.id === "add-custom") {
      addCustomEngine();
      return;
    }

    if (target.id === "reset-defaults") {
      resetDefaults();
      return;
    }

    if (target.id === "open-shortcuts") {
      flushAutosave()
        .catch(() => undefined)
        .finally(() => {
          chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
        });
    }
  });
}

async function init() {
  bindEvents();
  document.getElementById("query-input").addEventListener("keydown", (event) => {
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
  try {
    const response = await sendMessage("GET_SETTINGS");
    settings = response.settings;
    render();
  } catch (_error) {
    settings = deepClone(DEFAULT_SETTINGS);
    render();
  }
}

init();
