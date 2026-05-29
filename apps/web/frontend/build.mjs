/**
 * Production browser bundles for mail, auth, and admin React surfaces.
 * Run: node apps/web/frontend/build.mjs (or make static-js)
 */
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const distDir = path.join(webRoot, "dist");
const vendorDir = path.join(webRoot, "vendor");

const common = {
  bundle: true,
  platform: "browser",
  target: ["es2022"],
  format: "iife",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  logLevel: "warning",
  legalComments: "none",
  absWorkingDir: path.join(__dirname),
  nodePaths: [path.join(__dirname, "node_modules")],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    __ELVISH_DEBUG__: JSON.stringify("false"),
  },
};

async function main() {
  fs.mkdirSync(distDir, { recursive: true });

  const openpgpSrc = path.join(__dirname, "node_modules/openpgp/dist/openpgp.min.js");
  const openpgpDest = path.join(vendorDir, "openpgp-6.3.0.min.js");
  // When bumping the OpenPGP npm version, re-copy updates this file; refresh
  // integrity="sha384-…" on <script src="/vendor/openpgp-…"> in apps/web HTML shells.
  fs.copyFileSync(openpgpSrc, openpgpDest);

  const dompurifySrc = path.join(__dirname, "node_modules/dompurify/dist/purify.min.js");
  const dompurifyDest = path.join(vendorDir, "dompurify-3.4.3.min.js");
  fs.copyFileSync(dompurifySrc, dompurifyDest);

  const bundles = [
    { entry: "mail-entry.jsx", out: "mail-bundle.js" },
    { entry: "auth-login-entry.jsx", out: "auth-login-bundle.js" },
    { entry: "auth-register-entry.jsx", out: "auth-register-bundle.js" },
  ];

  for (const b of bundles) {
    await esbuild.build({
      ...common,
      entryPoints: [path.join(__dirname, "entries", b.entry)],
      outfile: path.join(distDir, b.out),
    });
  }

  await esbuild.build({
    ...common,
    entryPoints: [path.join(__dirname, "entries", "mail-settings-lazy-entry.jsx")],
    outfile: path.join(distDir, "mail-settings-lazy.js"),
    alias: {
      react: path.join(__dirname, "shims", "react-global.js"),
      "react-dom/client": path.join(__dirname, "shims", "react-dom-client-global.js"),
    },
  });

  await esbuild.build({
    ...common,
    entryPoints: [path.join(__dirname, "entries", "mail-search-worker-entry.js")],
    outfile: path.join(distDir, "mail-search-worker.js"),
    format: "esm",
  });

  // eslint-disable-next-line no-console
  console.log("static assets built:", distDir, "openpgp:", openpgpDest, "dompurify:", dompurifyDest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
