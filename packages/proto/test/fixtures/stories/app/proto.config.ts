export default {
  title: "Stories fixture",
  prototypes: "src/**/*.proto.tsx",
  stories: {
    roots: [
      {
        id: "app",
        stories: "src/**/*.stories.tsx",
        preview: "preview.tsx",
        vite: "vite.config.ts",
        static: [{ from: "assets", to: "/vendor" }],
      },
      {
        id: "ui",
        dir: "../packages/ui",
        stories: "src/**/*.stories.tsx",
        preview: "preview.tsx",
        vite: "vite.config.ts",
        static: [{ from: "assets", to: "/vendor" }],
      },
    ],
  },
};
