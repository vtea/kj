import { routes, type VercelConfig } from "@vercel/config/v1";

/**
 * 后台根地址：仅在 Vercel **构建** 时读取，用于生成反代规则。
 * 每个客户在 Vercel 项目里单独配置即可（与前端域名无关）。
 *
 * 优先 VITE_API_BASE_URL（与本地开发、前端 axios 共用）；
 * 若希望构建期与前端打包变量分离，可改用 API_BACKEND_ORIGIN。
 */
function backendOrigin(): string {
  const raw = (
    process.env.VITE_API_BASE_URL ??
    process.env.API_BACKEND_ORIGIN ??
    ""
  )
    .trim()
    .replace(/\/$/, "");
  return raw;
}

const api = backendOrigin();

if (process.env.VERCEL && !api) {
  console.warn(
    "[vercel] 未设置 VITE_API_BASE_URL 或 API_BACKEND_ORIGIN：/api、/uploads 不会反代到后台。请在 Vercel → Environment Variables 中设置后台根地址（如 https://api.example.com）。"
  );
}

const rewrites: NonNullable<VercelConfig["rewrites"]> = [];

if (api) {
  rewrites.push(
    routes.rewrite("/api/:path*", `${api}/api/:path*`),
    routes.rewrite("/uploads/:path*", `${api}/uploads/:path*`)
  );
}

rewrites.push(routes.rewrite("/(.*)", "/index.html"));

export const config: VercelConfig = {
  framework: null,
  buildCommand: "npm run build:h5",
  outputDirectory: "dist/build/h5",
  rewrites,
};
