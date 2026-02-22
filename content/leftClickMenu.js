(() => {
  const ROOT_ID = "booster-left-click-root";
  const styles = `
    #${ROOT_ID} {
      position: fixed;
      z-index: 2147483647;
      display: none;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }
    #${ROOT_ID} .booster-launcher {
      border: none;
      border-radius: 999px;
      padding: 7px 10px;
      background: #0a5adf;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(10, 90, 223, 0.28);
    }
    #${ROOT_ID} .booster-menu {
      margin-top: 6px;
      border: 1px solid #d7e2f0;
      border-radius: 12px;
      background: #fff;
      min-width: 220px;
      box-shadow: 0 16px 34px rgba(5, 17, 36, 0.22);
      padding: 6px;
      display: none;
    }
    #${ROOT_ID} .booster-item {
      width: 100%;
      text-align: left;
      border: none;
      background: #fff;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      color: #16202e;
      cursor: pointer;
    }
    #${ROOT_ID} .booster-item:hover {
      background: #eff5ff;
    }
    #${ROOT_ID} .booster-item.booster-smart {
      font-weight: 700;
      color: #0a5adf;
    }
  `;

  let quickActions = null;
  let selectedText = "";

  const root = document.createElement("div");
  root.id = ROOT_ID;

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "booster-launcher";
  launcher.textContent = "Search";

  const menu = document.createElement("div");
  menu.className = "booster-menu";

  root.appendChild(launcher);
  root.appendChild(menu);

  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  document.documentElement.appendChild(styleEl);
  document.documentElement.appendChild(root);

  function message(type, payload = {}) {
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

  function hideAll() {
    menu.style.display = "none";
    root.style.display = "none";
  }

  function checkModifier(event, modifier) {
    if (modifier === "none") {
      return true;
    }
    if (modifier === "alt") {
      return Boolean(event.altKey);
    }
    if (modifier === "ctrl") {
      return Boolean(event.ctrlKey);
    }
    if (modifier === "meta") {
      return Boolean(event.metaKey || event.ctrlKey);
    }
    return false;
  }

  function extractSelectionText() {
    const selection = window.getSelection();
    if (!selection) {
      return "";
    }
    return selection.toString().trim();
  }

  async function ensureQuickActions() {
    if (quickActions) {
      return quickActions;
    }
    const response = await message("GET_QUICK_ACTIONS");
    quickActions = response.quickActions;
    return quickActions;
  }

  function renderMenu(actions) {
    const items = [];

    items.push(`<button type="button" class="booster-item booster-smart" data-smart="1">Smart Search Stack</button>`);

    actions.engines.forEach((engine) => {
      items.push(`<button type="button" class="booster-item" data-engine-id="${engine.id}">Search with ${engine.name}</button>`);
    });

    menu.innerHTML = items.join("");
  }

  async function showLauncher(event) {
    const actions = await ensureQuickActions();
    if (!actions.enabled) {
      hideAll();
      return;
    }

    if (!checkModifier(event, actions.modifier)) {
      hideAll();
      return;
    }

    selectedText = extractSelectionText();
    if (!selectedText) {
      hideAll();
      return;
    }

    renderMenu(actions);

    root.style.left = `${event.clientX + 12}px`;
    root.style.top = `${event.clientY + 10}px`;
    root.style.display = "block";
    menu.style.display = "none";
  }

  launcher.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });

  menu.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const engineId = target.getAttribute("data-engine-id");
    const smart = target.getAttribute("data-smart") === "1";

    if (!engineId && !smart) {
      return;
    }

    try {
      await message("RUN_SEARCH", {
        query: selectedText,
        engineId,
        smart
      });
    } catch (_error) {
      // No-op in content script; failure will be visible in extension console.
    }

    hideAll();
  });

  document.addEventListener("mouseup", (event) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA)$/i.test(target.tagName))) {
      return;
    }
    showLauncher(event).catch(() => {
      hideAll();
    });
  });

  document.addEventListener("mousedown", (event) => {
    if (!root.contains(event.target)) {
      hideAll();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideAll();
    }
  });

  chrome.runtime.onMessage.addListener((messagePayload) => {
    if (messagePayload && messagePayload.type === "REFRESH_QUICK_ACTIONS") {
      quickActions = null;
    }
  });
})();
