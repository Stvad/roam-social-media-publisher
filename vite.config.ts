import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "extension.js",
    },
    outDir: ".",
    emptyOutDir: false,
    rollupOptions: {
      // Don't externalize anything — bundle oauth-1.0a,
      // and use virtual modules for Roam-provided globals
    },
    minify: true,
    sourcemap: true,
  },
  plugins: [
    {
      name: "roam-globals",
      enforce: "pre",
      resolveId(source) {
        if (["react", "react-dom"].includes(source)) {
          return `\0roam-global:${source}`;
        }
        return null;
      },
      load(id) {
        if (id === "\0roam-global:react") {
          return "const React = window.React; export default React; export const { useState, useCallback, useEffect, useMemo, useRef, createElement, Fragment, createContext, useContext, forwardRef, memo, lazy, Suspense, Component, PureComponent, Children, cloneElement, isValidElement, createRef } = React;";
        }
        if (id === "\0roam-global:react-dom") {
          return "const ReactDOM = window.ReactDOM; export default ReactDOM; export const { render, createPortal, unmountComponentAtNode, findDOMNode, hydrate, flushSync } = ReactDOM;";
        }
        return null;
      },
    },
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
