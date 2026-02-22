import { getEngineById } from "../shared/engines.js";

const ENGINE_GROUPS = {
  ai: ["perplexity", "chatgpt"],
  web: ["google", "bing", "duckduckgo"],
  knowledge: ["wikipedia", "reddit", "youtube", "github", "stackoverflow", "scholar", "amazon"]
};

let settings = null;

const saveButton = document.getElementById("save-settings");

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

function setButtonLabel(label) {
  saveButton.textContent = label;
}

function renderGroup(containerId, engineIds, enabledSet) {
  const container = document.getElementById(containerId);
  container.innerHTML = engineIds
    .map((engineId) => {
      const engine = getEngineById(engineId);
      if (!engine) {
        return "";
      }
      const checked = enabledSet.has(engine.id) ? "checked" : "";
      return `
        <label class="engine-item">
          <input type="checkbox" name="enabled-engine" value="${engine.id}" ${checked}>
          <span>${engine.name}</span>
        </label>
      `;
    })
    .join("");
}

function render() {
  const enabledSet = new Set(settings.enabledEngineIds || []);
  renderGroup("ai-engines", ENGINE_GROUPS.ai, enabledSet);
  renderGroup("web-engines", ENGINE_GROUPS.web, enabledSet);
  renderGroup("knowledge-engines", ENGINE_GROUPS.knowledge, enabledSet);
}

function getCheckedEngineIds() {
  return Array.from(document.querySelectorAll("input[name='enabled-engine']"))
    .filter((input) => input.checked)
    .map((input) => input.value);
}

async function saveSettings() {
  try {
    const checked = getCheckedEngineIds();
    if (!checked.length) {
      setButtonLabel("Pick 1+");
      setTimeout(() => setButtonLabel("Save"), 1000);
      return;
    }

    const next = {
      ...settings,
      enabledEngineIds: checked
    };

    const response = await sendMessage("SAVE_SETTINGS", { settings: next });
    settings = response.settings;
    render();
    setButtonLabel("Saved");
    setTimeout(() => setButtonLabel("Save"), 900);
  } catch (error) {
    setButtonLabel("Error");
    setTimeout(() => setButtonLabel("Save"), 1200);
  }
}

async function init() {
  saveButton.addEventListener("click", saveSettings);

  try {
    const response = await sendMessage("GET_SETTINGS");
    settings = response.settings;
    render();
  } catch (error) {
    setButtonLabel("Error");
  }
}

init();
