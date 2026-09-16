import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const canonical = env.VITE_SITE_URL?.replace(/\/$/, "");
  if (canonical && !/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(canonical))
    throw new Error("VITE_SITE_URL debe ser un origen HTTPS válido sin ruta.");
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "upr-metadata",
        transformIndexHtml(html) {
          return canonical
            ? html.replace(
                "</head>",
                `<meta property="og:image" content="${canonical}/og.png"/><meta property="og:url" content="${canonical}/"/><link rel="canonical" href="${canonical}/"/><meta name="twitter:card" content="summary_large_image"/></head>`,
              )
            : html;
        },
        generateBundle() {
          if (canonical)
            this.emitFile({
              type: "asset",
              fileName: "sitemap.xml",
              source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${canonical}/</loc></url></urlset>`,
            });
        },
      },
    ],
    build: {
      rollupOptions: {
        output: { manualChunks: { supabase: ["@supabase/supabase-js"] } },
      },
    },
  };
});
