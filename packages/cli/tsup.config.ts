import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["cjs"],
  dts: { resolve: true },
  noExternal: ["@argus-vrt/shared"],
  target: "node20",
  clean: true,
});
