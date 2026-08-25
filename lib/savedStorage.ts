const STORAGE_KEY = "oppy_saved_ids";

/**
 * MVP has no authentication, so "saved opportunities" is just an array of
 * opportunity IDs kept in the browser's localStorage. If accounts are added
 * later, this key can be migrated server-side at signup.
 */
export function getSavedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isSaved(id: string): boolean {
  return getSavedIds().includes(id);
}

export function toggleSaved(id: string): boolean {
  const current = getSavedIds();
  const alreadySaved = current.includes(id);
  const next = alreadySaved ? current.filter((x) => x !== id) : [...current, id];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  // Notify same-tab listeners (storage event only fires cross-tab)
  window.dispatchEvent(new CustomEvent("oppy_saved_changed"));
  return !alreadySaved;
}
