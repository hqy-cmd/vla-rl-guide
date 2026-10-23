import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import site from "./content/site.json" with { type: "json" };

const template = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const title = template.replace("__TITLE__", site.fullTitle);

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "offline-html",
      transformIndexHtml: {
        order: "pre",
        handler(html, ctx) {
          html = html.replace("__TITLE__", site.fullTitle);
          // The production CSP stays exact. Only the dev server needs HMR WebSockets.
          return ctx.server
            ? html.replace(
                "connect-src 'self' file: data: blob:",
                "connect-src 'self' file: data: blob: ws://127.0.0.1:* ws://localhost:*",
              )
            : html;
        },
      },
      generateBundle: {
        order: "post",
        handler(_options, bundle) {
          const scripts = Object.values(bundle).filter(
            (item) => item.type === "chunk",
          );
          if (
            scripts.length !== 1 ||
            scripts[0].imports.length ||
            scripts[0].dynamicImports.length
          ) {
            throw new Error(
              "Offline build requires exactly one self-contained script.",
            );
          }
          const styles = Object.values(bundle).filter((item) =>
            item.fileName.endsWith(".css"),
          );
          if (styles.length !== 1)
            throw new Error("Offline build requires one external stylesheet.");
          const links = styles
            .map((item) => `<link rel="stylesheet" href="./${item.fileName}">`)
            .join("\n  ");
          const html = title
            .replace("</head>", `  ${links}\n</head>`)
            .replace(
              /<script type="module" src="\/src\/main.js"><\/script>/,
              `<script defer src="./${scripts[0].fileName}"></script>`,
            );
          this.emitFile({
            type: "asset",
            fileName: "index.html",
            source: html,
          });
        },
      },
    },
  ],
  build: {
    target: "es2020",
    // Offline delivery intentionally uses one IIFE; enforce the batch size budget.
    chunkSizeWarningLimit: 900,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    modulePreload: false,
    rolldownOptions: {
      input: fileURLToPath(new URL("./src/main.js", import.meta.url)),
      output: {
        format: "iife",
        name: "VLAGuide",
        codeSplitting: false,
        entryFileNames: "assets/guide-[hash].js",
      },
    },
  },
});
