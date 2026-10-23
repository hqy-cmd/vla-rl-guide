import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Optional fixture directory allows negative tests without editing source copy.
const contentDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL("../content/", import.meta.url));
const site = JSON.parse(
  await readFile(path.join(contentDir, "site.json"), "utf8"),
);
const files = (await readdir(path.join(contentDir, "levels")))
  .filter((file) => file.endsWith(".json"))
  .sort();
let errors = 0;
const count = (text) => [...String(text ?? "").replace(/\s/gu, "")].length;
const fail = (message) => {
  console.error(`ERROR ${message}`);
  errors++;
};
const forbidden =
  /不是[^。；]{0,20}而是|让我们|一起来|赋能|深入浅出|揭秘|奥秘|神奇|值得注意的是|总而言之|简单来说|旅程|！|!/u;
function walkStrings(value, callback, key = "") {
  if (typeof value === "string") callback(value, key);
  else if (Array.isArray(value))
    value.forEach((item, i) => walkStrings(item, callback, `${key}[${i}]`));
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([name, item]) =>
      walkStrings(item, callback, `${key}.${name}`),
    );
}
function checkTone(object, label) {
  walkStrings(object, (text, field) => {
    const match = text.match(forbidden);
    if (match) fail(`${label}${field}: 禁用文案「${match[0]}」`);
  });
}
checkTone(site, "site");
for (const file of files) {
  const level = JSON.parse(
    await readFile(path.join(contentDir, "levels", file), "utf8"),
  );
  const bounds = (text, max, field) => {
    if (count(text) > max) fail(`${file} ${field}: ${count(text)} > ${max}`);
  };
  bounds(level.intro, 60, "intro");
  const bullets = level.bullets.map((item) => item.text);
  bullets.forEach((text, i) => bounds(text, 16, `bullets[${i}]`));
  const callouts = level.callouts.map((item) => item.title + item.text);
  callouts.forEach((text, i) => bounds(text, 20, `callouts[${i}]`));
  const labels = level.controls.items.map((item) => item.label);
  labels.forEach((text, i) => bounds(text, 8, `controls.items[${i}].label`));
  const visible = [
    level.intro,
    ...bullets,
    ...callouts,
    level.controls.task,
    ...labels,
  ];
  const visibleTotal = visible.reduce((sum, text) => sum + count(text), 0);
  if (visibleTotal > 180) fail(`${file} 可见合计: ${visibleTotal} > 180`);
  const sourceNumbers = new Set(
    level.numbers.flatMap((item) => item.text.match(/\d+/g) || []),
  );
  const tokens = [...site.globalTokens].sort((a, b) => b.length - a.length);
  const seen = new Set();
  function checkNumbers(text, field) {
    let stripped = String(text);
    for (const token of tokens) stripped = stripped.split(token).join("");
    for (const number of stripped.match(/\d+/g) || []) {
      seen.add(number);
      if (!sourceNumbers.has(number))
        fail(`${file} ${field}: 数字 ${number} 未列入 numbers[].text`);
    }
  }
  visible.forEach((text, i) => checkNumbers(text, `visible[${i}]`));
  level.controls.items.forEach((item, i) => {
    if (item.type === "slider") {
      for (const key of ["min", "max", "default"]) {
        if (item[key] !== undefined)
          checkNumbers(item[key], `controls.items[${i}].${key}`);
      }
    }
    walkStrings(item.options, (text) =>
      checkNumbers(text, `controls.items[${i}].options`),
    );
    if (Array.isArray(item.options))
      item.options
        .filter((option) => typeof option === "number")
        .forEach((option) =>
          checkNumbers(option, `controls.items[${i}].options`),
        );
  });
  checkTone(level, file);
  console.log(
    `${String(level.id).padStart(2, "0")} ${level.title} | intro ${count(level.intro)}/60 | bullets ${bullets.map(count).join("/")} | callouts ${callouts.map(count).join("/")} | labels ${labels.map(count).join("/")} | total ${visibleTotal}/180 | numbers ${[...seen].join(",") || "—"}`,
  );
}
if (errors) {
  console.error(`内容检查失败：${errors} 项`);
  process.exitCode = 1;
} else console.log(`内容检查通过：${files.length} 关`);
