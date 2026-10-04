const STORAGE_KEY = "musicrank:clientId";

/**
 * Anonymous voter identity for V1 (no auth — spec §25/§26). Generated once
 * per browser and persisted in localStorage; sent as userId with every vote
 * so "one vote per song, latest wins" works without a login step.
 */
export function getClientId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
