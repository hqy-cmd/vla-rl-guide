import site from "../content/site.json";
// Eager JSON imports are compiled into the IIFE; no runtime fetch or lazy chunks.
const files = import.meta.glob("../content/levels/*.json", {
  eager: true,
  import: "default",
});
export const levels = new Map(
  Object.values(files).map((level) => [level.id, level]),
);
export { site };
