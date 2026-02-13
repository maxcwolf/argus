import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["cli/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist-cli",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  dts: false,
});
