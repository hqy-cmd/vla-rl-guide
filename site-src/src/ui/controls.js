import { emit } from "../bus.js";
import { el, button } from "./dom.js";

export function renderControls(level, host) {
  host.replaceChildren();
  host.setAttribute("aria-busy", "false");
  host.append(el("h2", "", level.controls.title));
  const form = el("div", "control-fields");
  host.append(form);
  level.controls.items.forEach((item, index) => {
    const id = item.id || item.type;
    const domId = `control-${level.id}-${id}-${index}`;
    const send = (value) =>
      emit("control", { levelId: level.id, id, value, type: item.type });
    const row = el("div", `control-row control-${item.type}`);
    if (item.type === "button" || item.type === "run") {
      const action = button(
        item.label,
        item.type === "run" ? "run-button" : "secondary-button",
        item.type === "run" ? "play" : undefined,
      );
      action.dataset.control = id;
      action.addEventListener("click", () => send(true));
      row.append(action);
    } else {
      const label = el("label", "control-label", item.label);
      label.htmlFor = domId;
      row.append(label);
      if (item.type === "select") {
        const input = el("select");
        input.id = domId;
        item.options.forEach((option) =>
          input.append(new Option(option, option)),
        );
        input.value = item.default ?? item.options[0];
        input.addEventListener("change", () => send(input.value));
        row.append(input);
        send(input.value);
      } else if (item.type === "segmented") {
        label.removeAttribute("for");
        label.id = `${domId}-label`;
        const group = el("div", "segmented");
        group.setAttribute("role", "group");
        group.setAttribute("aria-labelledby", label.id);
        const value = item.default ?? item.options[0];
        item.options.forEach((option) => {
          const action = button(option);
          action.setAttribute("aria-pressed", String(option === value));
          action.addEventListener("click", () => {
            group
              .querySelectorAll("button")
              .forEach((node) =>
                node.setAttribute("aria-pressed", String(node === action)),
              );
            send(option);
          });
          group.append(action);
        });
        row.append(group);
        send(value);
      } else if (item.type === "slider") {
        const header = el("div", "control-heading");
        const output = el("output", "numeric");
        output.htmlFor = domId;
        header.append(label, output);
        const input = el("input");
        Object.assign(input, {
          type: "range",
          id: domId,
          min: item.min,
          max: item.max,
          step: item.step ?? 1,
          value: item.default ?? item.min,
        });
        const update = () => {
          output.value = `${input.value} ${item.unit || ""}`.trim();
          send(Number(input.value));
        };
        input.addEventListener("input", update);
        row.append(header, input);
        update();
      } else if (item.type === "readout") {
        const output = el("output", "numeric readout", "—");
        output.id = domId;
        output.dataset.readout = id;
        const header = el("div", "control-heading");
        header.append(label);
        if (item.toy) header.append(el("span", "toy-badge", "玩具数据"));
        row.append(header, output);
      }
    }
    form.append(row);
  });
  host.append(el("p", "control-task", level.controls.task));
}
