import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-semi-condensed/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "./styles.css";
import { site, levels } from "./content.js";
import { bus } from "./bus.js";
import { done, complete } from "./progress.js";
import { createRouter } from "./router.js";
import { stage } from "./stage/index.js";
import { mountCallouts } from "./ui/callouts.js";
import { scheduleThumbnails } from "./ui/thumbnails.js";
import { renderControls } from "./ui/controls.js";
import { el, button, icon } from "./ui/dom.js";

const total = site.levels.filter((level) => !level.appendix).length;
const app = document.querySelector("#app");
const shell = el("div", "app-shell");
app.append(shell);
const rail = el("nav", "sidebar");
rail.setAttribute("aria-label", "主导航");
const expand = button("展开导航", "rail-expand icon-button", "chevron");
expand.setAttribute("aria-expanded", "false");
expand.addEventListener("click", () => {
  const expanded = rail.classList.toggle("expanded");
  expand.setAttribute("aria-expanded", String(expanded));
  expand.setAttribute("aria-label", expanded ? "收起导航" : "展开导航");
});
const home = button("首页", "rail-action", "home");
const lessons = button("课程", "rail-action", "book");
const about = button("关于", "rail-action", "info");
for (const action of [lessons, about])
  action.setAttribute("aria-haspopup", "dialog");
const legacy = el("a", "rail-action");
legacy.href = site.about.v3Link;
legacy.setAttribute("aria-label", "旧版");
legacy.append(icon("archive"), el("span", "", "旧版"));
rail.append(expand, home, lessons, about, legacy);
shell.append(rail);

const header = el("header", "topbar");
const brand = el("div", "brand");
const brandIcon = el("div", "brand-icon");
brandIcon.append(icon("stage"));
const brandText = el("div");
brandText.append(el("h1", "", site.title), el("p", "", site.subtitle));
brand.append(brandIcon, brandText);
const progress = el("div", "progress-card");
const progressIcon = icon("book");
const progressBody = el("div", "progress-body");
const progressTop = el("div", "progress-top");
const progressNumber = el("span", "numeric progress-number");
progressNumber.setAttribute("aria-live", "polite");
progressTop.append(el("strong", "", site.progressLabel), progressNumber);
const progressBar = el("div", "progress-track");
progressBar.setAttribute("role", "progressbar");
progressBar.setAttribute("aria-label", "课程进度");
progressBar.setAttribute("aria-valuemin", "0");
progressBar.setAttribute("aria-valuemax", String(total));
const progressFill = el("span");
progressBar.append(progressFill);
progressBody.append(progressTop, progressBar);
progress.append(progressIcon, progressBody);
header.append(brand, progress);
shell.append(header);

const stageHost = el("main", "stage");
stageHost.id = "stage";
stageHost.setAttribute("aria-label", "课程舞台");
const stageIndex = el("span", "stage-index numeric");
stageIndex.setAttribute("aria-hidden", "true");
stageHost.append(stageIndex);
const right = el("aside", "right-column");
right.setAttribute("aria-label", "课程内容与控件");
const info = el("section", "card info-card");
const tablist = el("div", "tabs");
tablist.setAttribute("role", "tablist");
tablist.setAttribute("aria-label", "课程信息");
const tabContent = el("div", "tab-content");
tabContent.id = "lesson-tabpanel";
tabContent.setAttribute("role", "tabpanel");
tabContent.tabIndex = 0;
let current;
let activeTab = "overview";
const tabs = [
  ["overview", "概览"],
  ["original", "原文"],
  ["simplify", "简化说明"],
  ["sources", "出处"],
];
const tabButtons = tabs.map(([key, label], index) => {
  const action = button(label);
  action.id = `tab-${key}`;
  action.setAttribute("role", "tab");
  action.setAttribute("aria-controls", tabContent.id);
  action.addEventListener("click", () => {
    activeTab = key;
    renderInfo();
  });
  action.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      tabButtons[next].click();
      tabButtons[next].focus();
    }
  });
  tablist.append(action);
  return action;
});
info.append(tablist, tabContent);
const controls = el("section", "card controls-card");
right.append(info, controls);
shell.append(stageHost, right);

const coursebar = el("section", "coursebar");
coursebar.setAttribute("aria-label", "课程条");
const courseHeader = el("div", "course-heading");
courseHeader.append(el("h2", "", "课程"));
const coursePosition = el("span", "numeric");
courseHeader.append(coursePosition);
const courseRow = el("div", "course-row");
const previous = button("上一页课程", "icon-button course-prev", "chevron");
const next = button("下一页课程", "icon-button course-next", "chevron");
const courseList = el("div", "course-list");
courseList.setAttribute("aria-label", "全部课程");
courseRow.append(previous, courseList, next);
coursebar.append(courseHeader, courseRow);
shell.append(coursebar);
const cards = new Map();
site.levels.forEach((level) => {
  const action = button(
    `${level.appendix ? "附" : level.id}. ${level.title}`,
    "course-card",
  );
  action.replaceChildren();
  action.dataset.level = level.id;
  if (level.status === "soon") {
    action.classList.add("soon");
    action.setAttribute("aria-disabled", "true");
  }
  const thumbnail = el("div", `thumbnail thumbnail-${level.id % 4}`);
  thumbnail.append(icon("stage"));
  const copy = el("div", "course-copy");
  copy.append(
    el(
      "span",
      "course-title",
      `${level.appendix ? "附" : level.id}. ${level.title}`,
    ),
  );
  if (level.status === "soon") copy.append(el("span", "soon-label", "制作中"));
  const check = el("span", "completion-mark");
  check.append(icon("check"));
  action.append(thumbnail, copy, check);
  action.addEventListener("click", () => router.go(level));
  cards.set(level.id, action);
  courseList.append(action);
});
scheduleThumbnails(cards);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const scrollOptions = () => ({
  behavior: reducedMotion.matches ? "instant" : "smooth",
});
previous.addEventListener("click", () =>
  courseList.scrollBy({
    left: -courseList.clientWidth * 0.8,
    ...scrollOptions(),
  }),
);
next.addEventListener("click", () =>
  courseList.scrollBy({
    left: courseList.clientWidth * 0.8,
    ...scrollOptions(),
  }),
);
function updatePaging() {
  previous.disabled = courseList.scrollLeft < 2;
  next.disabled =
    courseList.scrollLeft + courseList.clientWidth >=
    courseList.scrollWidth - 2;
}
courseList.addEventListener("scroll", updatePaging, { passive: true });
new ResizeObserver(updatePaging).observe(courseList);

const toast = el("div", "toast");
toast.setAttribute("role", "status");
toast.setAttribute("aria-live", "polite");
document.body.append(toast);
let toastTimer;
function notifySoon() {
  toast.textContent = site.soonText;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

const dialog = el("dialog", "drawer");
dialog.setAttribute("aria-labelledby", "drawer-title");
const dialogHeader = el("div", "drawer-heading");
const dialogTitle = el("h2");
dialogTitle.id = "drawer-title";
const close = button("关闭面板", "icon-button", "close");
close.addEventListener("click", () => dialog.close());
dialogHeader.append(dialogTitle, close);
const dialogBody = el("div", "drawer-body");
dialog.append(dialogHeader, dialogBody);
document.body.append(dialog);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dialog.close();
  }
});
function openPanel(title) {
  dialogTitle.textContent = title;
  dialogBody.replaceChildren();
  if (!dialog.open) dialog.showModal();
}
lessons.addEventListener("click", () => {
  openPanel("课程");
  dialogBody.append(
    el("p", "drawer-progress numeric", `${done.size}/${total}`),
  );
  site.levels.forEach((level) => {
    const action = button(
      `${level.appendix ? "附" : level.id}. ${level.title}`,
      "drawer-lesson",
    );
    action.dataset.level = level.id;
    action.setAttribute("aria-current", String(current.id === level.id));
    if (level.status === "soon") {
      action.setAttribute("aria-disabled", "true");
      action.append(el("span", "soon-label", "制作中"));
    }
    if (done.has(level.id)) {
      action.append(icon("check"));
      action.setAttribute(
        "aria-label",
        `${action.getAttribute("aria-label")}，已完成`,
      );
    }
    action.addEventListener("click", () => {
      router.go(level);
      if (level.status === "ready") dialog.close();
    });
    dialogBody.append(action);
  });
});
about.addEventListener("click", () => {
  openPanel(site.about.title);
  dialogBody.append(el("p", "", site.about.text));
  const papers = el("ul", "about-papers");
  site.about.papers.forEach((paper) => papers.append(el("li", "", paper)));
  const old = el("a", "legacy-link", site.about.v3Text);
  old.href = site.about.v3Link;
  dialogBody.append(
    papers,
    el("p", "", site.about.pageNote),
    el("p", "credit", site.about.credit),
    old,
  );
});

function renderInfo() {
  tabs.forEach(([key], index) => {
    tabButtons[index].setAttribute("aria-selected", String(key === activeTab));
    tabButtons[index].tabIndex = key === activeTab ? 0 : -1;
  });
  tabContent.setAttribute("aria-labelledby", `tab-${activeTab}`);
  tabContent.replaceChildren();
  tabContent.scrollTop = 0;
  if (activeTab === "overview") {
    tabContent.append(
      el("h2", "", current.title),
      el("p", "intro", current.intro),
    );
    const bullets = el("ul", "bullets");
    current.bullets.forEach((item) => {
      const row = el("li");
      const glyph = el("span", "bullet-icon");
      glyph.append(icon(item.icon));
      row.append(glyph, el("span", "", item.text));
      bullets.append(row);
    });
    tabContent.append(bullets);
  } else {
    const list = el("ul", `detail-list ${activeTab}`);
    current.tabs[activeTab].forEach((text) => list.append(el("li", "", text)));
    tabContent.append(list);
  }
}

function updateProgress() {
  progressNumber.textContent = `${done.size}/${total}`;
  progressFill.style.width = `${(done.size / total) * 100}%`;
  progressBar.setAttribute("aria-valuenow", String(done.size));
  for (const level of site.levels) {
    const action = cards.get(level.id);
    action.classList.toggle("done", done.has(level.id));
    action.setAttribute(
      "aria-label",
      `${level.appendix ? "附" : level.id}. ${level.title}${done.has(level.id) ? "，已完成" : ""}${level.status === "soon" ? "，制作中" : ""}`,
    );
  }
}
let removeCallouts = () => {};
bus.addEventListener("control", (event) => {
  const { levelId, id, value, type } = event.detail;
  if (levelId !== current?.id) return;
  stage.onControl(id, value);

});
function markComplete(levelId) {
  if (!complete(levelId)) return;
  updateProgress();
  const card = cards.get(levelId);
  card.classList.add("just-completed");
  progress.classList.add("just-completed");
  setTimeout(() => {
    card.classList.remove("just-completed");
    progress.classList.remove("just-completed");
  }, 700);
}
bus.addEventListener("stage:complete", event => markComplete(event.detail.levelId));
bus.addEventListener("stage:busy", event => {
  if (event.detail.levelId !== current?.id) return;
  const busy = event.detail.busy;
  controls.setAttribute("aria-busy", String(busy));
  controls.querySelectorAll("button, select, input").forEach(node => node.disabled = busy);
  const run = controls.querySelector(".run-button");
  if (run) {
    const label = busy ? (current.controls.runningLabel || current.controls.items.find(item => item.type === "run").label) : current.controls.items.find(item => item.type === "run").label;
    run.querySelector("span").textContent = label;
    run.setAttribute("aria-label", label);
  }
});

const router = createRouter((summary) => {
  removeCallouts();
  stage.unmount();
  current = levels.get(summary.id);
  activeTab = "overview";
  document.title = `${current.title} · ${site.title}`;
  stageIndex.textContent = `${current.id}/${total}`;
  stage.mount(current.id, stageHost);
  removeCallouts = mountCallouts(current, stageHost, stage);
  renderInfo();
  renderControls(current, controls);
  coursePosition.textContent = stageIndex.textContent;
  for (const [id, card] of cards) {
    if (id === current.id) card.setAttribute("aria-current", "step");
    else card.removeAttribute("aria-current");
  }
  requestAnimationFrame(() => {
    const card = cards.get(current.id);
    // Scroll only this strip; never move the document on a narrow/mobile screen.
    const left = card.offsetLeft - courseList.offsetLeft;
    if (
      left < courseList.scrollLeft ||
      left + card.offsetWidth > courseList.scrollLeft + courseList.clientWidth
    ) {
      courseList.scrollTo({ left, ...scrollOptions() });
    }
    updatePaging();
  });
}, notifySoon);
home.addEventListener("click", () => router.go(site.levels[0]));
updateProgress();
document.fonts.ready.then(() => {
  document.documentElement.dataset.ready = "true";
});
