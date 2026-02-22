import { DEFAULT_SETTINGS, sanitizeSettings } from "../shared/defaultSettings.js";

const SETTINGS_KEY = "boosterDreamSettings";

export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  if (!stored || !stored[SETTINGS_KEY]) {
    const defaults = sanitizeSettings(DEFAULT_SETTINGS);
    await chrome.storage.local.set({ [SETTINGS_KEY]: defaults });
    return defaults;
  }
  return sanitizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(nextSettings) {
  const sanitized = sanitizeSettings(nextSettings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: sanitized });
  return sanitized;
}
