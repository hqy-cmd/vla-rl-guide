export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(label, className = "", iconName) {
  const node = el("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  if (iconName) node.append(icon(iconName));
  node.append(el("span", "", label));
  return node;
}
// Original, monochrome line drawings; no icon library or reference-site assets.
const paths = {
  home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  archive: '<path d="M4 9h16v12H4zM3 3h18v6H3zM9 13h6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  camera: '<path d="M3 7h5l2-3h4l2 3h5v14H3z"/><circle cx="12" cy="13" r="4"/>',
  chat: '<path d="M3 4h18v13H9l-6 4zM7 9h10M7 13h6"/>',
  loop: '<path d="M20 9a8 8 0 0 0-14-3L3 9m0-6v6h6M4 15a8 8 0 0 0 14 3l3-3m0 6v-6h-6"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  link: '<path d="m10 8 3-3a4 4 0 0 1 6 6l-3 3M14 16l-3 3a4 4 0 0 1-6-6l3-3M8 16l8-8"/>',
  text: '<path d="M4 5h16M12 5v15M8 20h8"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  jump: '<path d="M3 19h7V5h11m-5-4 5 4-5 4"/>',
  join: '<path d="M3 5h6l6 14h6M3 19h6l6-14h6"/>',
  average: '<path d="m3 4 9 8 9-8M3 20l9-8 9 8M12 12v8"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"/>',
  steps: '<path d="M3 20h6v-6h6V8h6V3"/>',
  stage: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
};
export function icon(name) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  node.setAttribute("viewBox", "0 0 24 24");
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", "currentColor");
  node.setAttribute("stroke-width", "1.6");
  node.setAttribute("stroke-linecap", "round");
  node.setAttribute("stroke-linejoin", "round");
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = paths[name] || paths.stage;
  return node;
}
