import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webFrontend = path.resolve(__dirname, "../../web/frontend");
const require = createRequire(path.join(webFrontend, "package.json"));
const esbuild = require("esbuild");

const adminRoot = path.resolve(__dirname, "..");
const distDir = path.join(adminRoot, "dist");

await esbuild.build({
  entryPoints: [path.join(__dirname, "admin-entry.jsx")],
  outfile: path.join(distDir, "admin-bundle.js"),
  bundle: true,
  platform: "browser",
  target: ["es2022"],
  format: "iife",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  logLevel: "warning",
  absWorkingDir: __dirname,
  nodePaths: [path.join(webFrontend, "node_modules")],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});

fs.mkdirSync(distDir, { recursive: true });
console.log("admin bundle:", path.join(distDir, "admin-bundle.js"));
