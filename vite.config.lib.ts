import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src/lib/dashboard/**"],
      exclude: ["src/lib/dashboard/**/__tests__/**"],
      tsconfigPath: resolve(__dirname, "tsconfig.lib.json"),
      rollupTypes: true,
    }),
  ],
  publicDir: false,
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/lib/dashboard/index.ts"),
        engine: resolve(__dirname, "src/lib/dashboard/engine-entry.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        const ext = format === "es" ? "mjs" : "cjs";
        return `${entryName}.${ext}`;
      },
    },
    outDir: "dist/lib",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        preserveModules: false,
      },
    },
  },
});
