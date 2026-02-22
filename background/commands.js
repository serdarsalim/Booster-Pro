export async function handleCommand(command) {
  if (command === "close-other-tabs") {
    const tabs = await chrome.tabs.query({ active: false, pinned: false, currentWindow: true });
    const tabIds = tabs.map((tab) => tab.id).filter((id) => typeof id === "number");
    if (tabIds.length) {
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

    if (tabIds.length) {
      await chrome.tabs.remove(tabIds);
    }
    return;
  }

  if (command === "toggle-pin") {
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];
    if (currentTab && typeof currentTab.id === "number") {
      await chrome.tabs.update(currentTab.id, { pinned: !currentTab.pinned });
    }
  }
}
