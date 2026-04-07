/**
 * Vercel 预览 / 生产域名会变，运行时一律用 `window.location.origin` 发 /api、拼 /uploads，
 * 与 Vercel 上由 vercel.ts 生成的 /api、/uploads 反代一致；后台域名在构建环境变量里配，无需配「当前前端域名」。
 *
 * 若仍设置 VITE_API_BASE_URL 指向后端，且与当前页面不同源，生产环境会自动忽略该值（走同源反代），
 * 避免 CORS。只有确实要浏览器直连跨域 API 时，再设 VITE_API_CROSS_ORIGIN=true。
 */
function browserOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function parseApiOrigin(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    return new URL(s.includes("://") ? s : `https://${s}`).origin;
  } catch {
    return null;
  }
}

/** 生产环境且未显式要求跨域时，优先与当前页同源（适配任意部署域名） */
function preferSameOriginInProd(): boolean {
  if (import.meta.env.DEV) return false;
  return import.meta.env.VITE_API_CROSS_ORIGIN !== "true";
}

/** axios baseURL，须以 / 结尾 */
export function getAxiosBaseURL(): string {
  if (import.meta.env.DEV) {
    const env = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
    if (env) {
      return env.endsWith("/") ? env : `${env}/`;
    }
    return "http://127.0.0.1:8080/";
  }

  const envRaw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  const page = browserOrigin();
  const apiOrigin = parseApiOrigin(envRaw);

  if (
    preferSameOriginInProd() &&
    envRaw &&
    apiOrigin &&
    page &&
    apiOrigin !== page
  ) {
    return `${page}/`;
  }
  if (envRaw) {
    return envRaw.endsWith("/") ? envRaw : `${envRaw}/`;
  }
  return page ? `${page}/` : "/";
}

/** 拼接后台相对图片路径（无末尾 /） */
export function getApiAssetOrigin(): string {
  if (import.meta.env.DEV) {
    return (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  }

  const envRaw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  const env = envRaw.replace(/\/$/, "");
  const page = browserOrigin();
  const apiOrigin = parseApiOrigin(envRaw);

  if (
    preferSameOriginInProd() &&
    env &&
    apiOrigin &&
    page &&
    apiOrigin !== page
  ) {
    return page;
  }
  if (env) return env;
  return page;
}
