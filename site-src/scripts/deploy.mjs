import { cp, readFile, readdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";

const source = fileURLToPath(new URL("../", import.meta.url));
const root = path.dirname(source.replace(/\/$/, ""));
const dist = path.join(source, "dist");
// Fixed allowlist: these two directories alone are replaceable.
const replaceable = ["assets", "fonts"];
const entries = await readdir(dist, { withFileTypes: true });
const allowed = new Set(["index.html", ...replaceable]);
for (const entry of entries) {
  if (!allowed.has(entry.name))
    throw new Error(
      `Unapproved deployment entry: ${entry.name}. Add an explicit public destination before deploying.`,
    );
  if (entry.isSymbolicLink())
    throw new Error("Deployment symlinks are not permitted.");
}
const html = await readFile(path.join(dist, "index.html"), "utf8");
if (/type\s*=\s*["']module|modulepreload/i.test(html))
  throw new Error("Offline HTML contains a module script or preload.");
for (const folder of replaceable) {
  if (!(await stat(path.join(dist, folder))).isDirectory())
    throw new Error(`Missing built directory: ${folder}`);
}
for (const folder of replaceable)
  await rm(path.join(root, folder), { recursive: true, force: true });
for (const entry of entries)
  await cp(path.join(dist, entry.name), path.join(root, entry.name), {
    recursive: true,
  });
const redirects = [
  "w1_patch_embedding.html",
  "w4_flow_matching.html",
  "w5_action_chunk_rtc.html",
  "w6_value_advantage.html",
];
const zip = path.join(path.dirname(root), "vla-rl-guide-offline.zip");
await rm(zip, { force: true });
const result = spawnSync(
  "/usr/bin/zip",
  [
    "-q",
    "-r",
    zip,
    "index.html",
    "assets",
    "fonts",
    "v3",
    ...redirects,
    "README.md",
    "-x",
    "*/.DS_Store",
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.status !== 0)
  throw new Error(`zip failed: ${result.error?.message || result.status}`);
console.log(`已部署到 ${root}\n离线包：${zip}`);
