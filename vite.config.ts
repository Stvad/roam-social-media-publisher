import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["cjs"],
      fileName: () => "extension.js",
    },
    outDir: "dist",
    rollupOptions: {
      external: ["react", "react-dom", "crypto-js"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "crypto-js": "CryptoJS",
        },
      },
    },
    minify: false,
    sourcemap: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
