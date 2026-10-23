import { Vector2 } from "three";
import { mountStage3D } from "../stage3d/index.js";
import { mountLevel as l1 } from "../levels/l1.js";
import { mountLevel as l2 } from "../levels/l2.js";
import { mountLevel as l3 } from "../levels/l3.js";
import { mountLevel as l4 } from "../levels/l4.js";
import { emit } from "../bus.js";
import { levels } from "../content.js";
import { el, icon } from "../ui/dom.js";

// Stable public seam for individual scene modules.
export const stage = {
  mount(levelId, container) {
    this.unmount();
    this.container = container;
    this.level = levels.get(levelId);
    this.controls = new Map();
    this.surface = el("div", "stage-surface");
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    grid.classList.add("iso-grid");
    grid.setAttribute("viewBox", "0 0 1000 800");
    grid.setAttribute("preserveAspectRatio", "xMidYMid slice");
    grid.setAttribute("aria-hidden", "true");
    for (let i = -20; i <= 30; i++) {
      for (const direction of [-1, 1]) {
        const line = document.createElementNS(grid.namespaceURI, "path");
        line.setAttribute("d", `M-500 ${i * 48}l2000 ${direction * 1155}`);
        grid.append(line);
      }
    }
    if ([1,2,3,4].includes(levelId)) {
      this.surface.append(grid);
      container.prepend(this.surface);
      this.surface.dataset.level = levelId;
      this.surface.classList.add(levelId === 2 ? "stage-2d" : "stage-3d");
      const mount = levelId === 2 ? ((surface, build, options) => build({...options, surface})) : mountStage3D;
      this.live = mount(this.surface, new Map([[1,l1],[2,l2],[3,l3],[4,l4]]).get(levelId), {
        instruction: this.instruction,
        content: this.level,
        onBusy: (busy) => emit("stage:busy", {levelId, busy}),
        onComplete: () => emit("stage:complete", {levelId}),
      });
      return;
    }
    const watermark = el("div", "stage-watermark");
    watermark.append(icon("stage"), el("h2", "", this.level.title));
    const label = el("div", "stage-label");
    label.append(
      icon("stage"),
      el("span", "", "舞台"),
      el("span", "stage-status", "制作中"),
    );
    this.surface.append(grid, watermark, label);
    container.prepend(this.surface);
    this.surface.dataset.level = levelId;
  },
  getAnchors() {
    if (this.live) return this.live.getAnchors();
    if (!this.container) return {};
    const { clientWidth: width, clientHeight: height } = this.container;
    return Object.fromEntries(
      this.level.callouts.map((callout, i) => {
        const angle =
          -Math.PI * 0.85 +
          (i * Math.PI * 1.65) / Math.max(1, this.level.callouts.length - 1);
        const position = new Vector2(
          Math.cos(angle) * 0.18 + 0.5,
          Math.sin(angle) * 0.2 + 0.54,
        );
        return [
          callout.target,
          { x: position.x * width, y: position.y * height },
        ];
      }),
    );
  },
  project(object) { return this.live?.project(object); },
  getAvoidRects() { return this.live?.getAvoidRects() || []; },
  onFrame(fn) { return this.live?.onFrame(fn) || (() => {}); },
  onControl(id, value) {
    if (this.level?.id === 1 && id === "instruction") this.instruction = value;
    this.live?.onControl(id, value);
    this.controls?.set(id, value);
    // A stable, inspectable seam for future scene modules (no toy simulation in B1).
    if (this.surface) this.surface.dataset.lastControl = id;
  },
  unmount() {
    this.live?.dispose();
    this.live = null;
    this.surface?.remove();
    this.surface = null;
    this.container = null;
    this.controls = null;
    this.level = null;
  },
};
