import { site } from "./content.js";
export function createRouter(onRoute, onSoon) {
  const first = site.levels.find((level) => level.status === "ready");
  let previous = null;
  function resolve() {
    const level = site.levels.find(
      (item) => `#/${item.slug}` === location.hash,
    );
    if (!level || level.status !== "ready") {
      if (level?.status === "soon") onSoon();
      const fallback = previous || first;
      history.replaceState(null, "", `#/${fallback.slug}`);
      if (previous) return;
      previous = fallback;
      onRoute(fallback);
      return;
    }
    if (previous?.id === level.id) return;
    previous = level;
    onRoute(level);
  }
  window.addEventListener("hashchange", resolve);
  resolve();
  return {
    go(level) {
      if (level.status === "soon") {
        onSoon();
        return;
      }
      location.hash = `#/${level.slug}`;
    },
    destroy() {
      window.removeEventListener("hashchange", resolve);
    },
  };
}
