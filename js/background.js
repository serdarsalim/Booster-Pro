const DEFAULT_SEARCH_ENTRIES = [
  ["-1", "Search Google", "https://www.google.com/search?sclient=psy-ab&site=&source=hp&btnG=Search&q=%s&oq=&gs_l=&pbx=1", true],
  ["-1", "Google Translate", "https://translate.google.com/#auto/en/%s", true],
  ["-1", "Search Youtube", "https://www.youtube.com/results?search_query=%s", true],
  ["-1", "Search Amazon", "http://www.amazon.com/s/ref=nb_sb_noss?url=search-alias%3Daps&field-keywords=%s", true],
  ["-1", "Search LinkedIn", "https://www.linkedin.com/vsearch/f?type=all&keywords=%s&orig=GLHD&rsid=&pageKey=oz-winner&trkInfo=&search=Search", true]
];

const storageDefaults = {
  _askbg: "true",
  _asknext: "true",
  _buildNumber: 280
};

const menuTemplates = new Map();

function sanitizeEntries(rawValue) {
  if (!rawValue) {
    return DEFAULT_SEARCH_ENTRIES;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return DEFAULT_SEARCH_ENTRIES;
    }
    return parsed;
  } catch (_err) {
    return DEFAULT_SEARCH_ENTRIES;
  }
}

async function loadConfig() {
  const data = await chrome.storage.local.get(["_allsearch", "_askbg", "_asknext", "_buildNumber"]);
  const result = {};

  result._allsearch = data._allsearch || JSON.stringify(DEFAULT_SEARCH_ENTRIES);
  result._askbg = typeof data._askbg === "string" ? data._askbg : storageDefaults._askbg;
  result._asknext = typeof data._asknext === "string" ? data._asknext : storageDefaults._asknext;
  result._buildNumber = typeof data._buildNumber === "number" ? data._buildNumber : storageDefaults._buildNumber;

  return result;
}

async function ensureDefaults() {
  const config = await loadConfig();
  await chrome.storage.local.set({
    _allsearch: config._allsearch,
    _askbg: config._askbg,
    _asknext: config._asknext,
    _buildNumber: config._buildNumber
  });
}

async function rebuildMenus() {
  await ensureDefaults();
  const config = await loadConfig();
  const entries = sanitizeEntries(config._allsearch);

  menuTemplates.clear();
  await chrome.contextMenus.removeAll();

  entries.forEach((entry) => {
    if (!entry || !entry[3]) {
      return;
    }
    const title = String(entry[1] || "").trim();
    const template = String(entry[2] || "").trim();
    if (!title || !template) {
      return;
    }
    const menuId = chrome.contextMenus.create({
      title: title,
      contexts: ["link", "selection"]
    });
    menuTemplates.set(String(menuId), template);
  });
}

function buildTargetUrl(template, info) {
  const rawQuery = info.selectionText || info.linkUrl || "";
  const query = String(rawQuery).trim().toLocaleLowerCase();
  return template.replace("SELECTION", query).replace("%s", query);
}

async function openResultTab(targetUrl, askBg, askNext) {
  if (askNext) {
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];
    const index = currentTab ? currentTab.index + 1 : undefined;
    await chrome.tabs.create({ url: targetUrl, active: !askBg, index: index });
    return;
  }
  await chrome.tabs.create({ url: targetUrl, active: !askBg });
}

chrome.runtime.onInstalled.addListener(() => {
  rebuildMenus();
});

chrome.runtime.onStartup.addListener(() => {
  rebuildMenus();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "updatemenu") {
    return false;
  }
  rebuildMenus()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const template = menuTemplates.get(String(info.menuItemId));
  if (!template) {
    return;
  }
  const config = await loadConfig();
  const targetUrl = buildTargetUrl(template, info);
  const askBg = config._askbg === "true";
  const askNext = config._asknext === "true";
  await openResultTab(targetUrl, askBg, askNext);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "close-other-tabs") {
    const tabs = await chrome.tabs.query({ active: false, pinned: false, currentWindow: true });
    const tabIds = tabs.map((tab) => tab.id).filter((id) => typeof id === "number");
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }
    return;
  }

  if (command === "close-right-tabs") {
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];
    if (!currentTab) {
      return;
    }
    const tabs = await chrome.tabs.query({ active: false, pinned: false, currentWindow: true });
    const tabIds = tabs
      .filter((tab) => tab.index > currentTab.index)
      .map((tab) => tab.id)
      .filter((id) => typeof id === "number");
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }
    return;
  }

  if (command === "toggle-pin") {
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];
    if (!currentTab || typeof currentTab.id !== "number") {
      return;
    }
    await chrome.tabs.update(currentTab.id, { pinned: !currentTab.pinned });
  }
});

rebuildMenus();
