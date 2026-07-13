import { build } from "esbuild";

await build({
  entryPoints: {
    background: "src/background.ts",
    shanbay: "src/content/shanbay.ts",
    provider: "src/content/provider.ts"
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  sourcemap: false,
  entryNames: "[name]",
  logLevel: "info"
});
