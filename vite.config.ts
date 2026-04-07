import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

/**
 * uni 的 static 拷贝在 writeBundle 里依赖 chokidar + 短 readyTimeout，子目录（如 static/home-nav）可能未拷完，
 * 导致 dist 缺 svg。在 closeBundle 再整目录同步一次，保证 Vercel 可访问 /static/**。
 */
function ensureH5StaticCopy(): Plugin {
  let root: string;
  let outDir: string;
  return {
    name: "ensure-h5-static-copy",
    apply: "build",
    enforce: "post",
    configResolved(c) {
      root = c.root;
      outDir = path.resolve(root, c.build.outDir);
    },
    async closeBundle() {
      if (process.env.UNI_PLATFORM !== "h5" && process.env.UNI_PLATFORM !== "web") {
        return;
      }
      const src = path.join(root, "static");
      const dest = path.join(outDir, "static");
      if (!fs.existsSync(src)) return;
      await fsp.cp(src, dest, { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [uni(), ensureH5StaticCopy()],
  // Vite 5.2 仍走 sass.render（旧 API）；在 Dart Sass 2.0 前仅抑制控制台噪音
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ["legacy-js-api"],
      },
      sass: {
        silenceDeprecations: ["legacy-js-api"],
      },
    },
  },
});
