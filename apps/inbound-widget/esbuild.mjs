import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await esbuild.build({
  entryPoints: ["src/bootstrap.ts"],
  bundle: true,
  format: "iife",
  outfile: "dist/kanso-widget.js",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
});

console.log("built dist/kanso-widget.js");
