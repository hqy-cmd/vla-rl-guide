import { site } from "./content.js";
const key = "vla-guide:done";
const validIds = new Set(
  site.levels.filter((level) => !level.appendix).map((level) => level.id),
);
let saved = [];
try {
  const parsed = JSON.parse(localStorage.getItem(key) || "[]");
  if (Array.isArray(parsed)) saved = parsed.filter((id) => validIds.has(id));
} catch {
  /* Storage can be denied under file://; keep the same in-memory API. */
}
export const done = new Set(saved);
export function complete(id) {
  if (!validIds.has(id) || done.has(id)) return false;
  done.add(id);
  try {
    localStorage.setItem(key, JSON.stringify([...done]));
  } catch {
    /* Silent memory fallback. */
  }
  return true;
}
