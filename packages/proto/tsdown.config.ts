import { defineConfig } from "tsdown";
export default defineConfig({
  entry: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "!src/shell/**",
    "!src/render/**",
    "!src/main.tsx",
    "!src/**/*.d.ts",
  ],
  outDir: "dist/package/src",
  unbundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  dts: true,
  clean: true,
});
