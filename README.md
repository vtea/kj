# liuhe1

## 前端（uni-app H5）一键部署到 Vercel

本仓库前端位于 `frontend/qianduan/kj`，已包含 [`vercel.ts`](frontend/qianduan/kj/vercel.ts)（构建命令、输出目录、按**环境变量**生成 API 反代与 SPA 回退）。将下方链接中的 **`YOUR_GITHUB_USERNAME`** 换成你的 GitHub 用户名或组织名，**`REPO_NAME`** 换成本仓库在 GitHub 上的名称（例如 `liuhe1`），即可使用 Vercel 的「从仓库导入」流程并自动带上子目录配置。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_GITHUB_USERNAME%2FREPO_NAME&root-directory=frontend%2Fqianduan%2Fkj)

### 前后端分离时这套方案在做什么

前端仍是 **Vercel 上的静态站点**，接口仍是 **客户各自的后台域名**（A 客户 `https://api.a.com`，B 客户 `https://api.b.com`），代码仓库可以共用一套，**没有**把前后端绑在同一台机或同一个项目里发布。

差别只在浏览器这一跳：页面里的请求发到 **当前站点域名下的 `/api`**，由 Vercel 边缘把请求 **转发** 到该 Vercel 项目在环境变量里配置的 API 根地址。这是常见的「网关 / 反代」做法，用来避免浏览器跨域（CORS），**不等于**前后端部署在一起。若你坚持浏览器直连 API，则必须在后台配置允许你的前端域名的 CORS，并设置 `VITE_API_CROSS_ORIGIN=true`。

### 使用说明

1. 点击上方 **Deploy with Vercel**（或打开 [Vercel 控制台](https://vercel.com/new) → **Add New** → **Project** → 导入本仓库）。
2. **Root Directory** 必须为：`frontend/qianduan/kj`（一键链接已预填；若手动导入，请在设置里填写该项）。
3. 构建与输出由 [`vercel.ts`](vercel.ts) 指定，一般无需再改：
   - Build Command：`npm run build:h5`
   - Output Directory：`dist/build/h5`
4. **每个客户配自己的后台地址**：在对应 Vercel 项目的 **Settings → Environment Variables** 中设置 **`VITE_API_BASE_URL`**（或仅构建用 **`API_BACKEND_ORIGIN`**）为后台根地址，例如 `https://api.customer.com`（不要末尾 `/`）。构建时 `vercel.ts` 会据此生成 `/api/*`、`/uploads/*` 反代，**不会**写死在仓库里。前端页面域名（预览 / 生产 / 自定义）仍自动用当前源站请求 `/api`，无需按域名再配一遍。若浏览器要**直连**跨域 API（且后端已配好 CORS），再加 `VITE_API_CROSS_ORIGIN=true`。
5. 连接仓库后，推送到已关联分支会自动触发构建与发布。

### 静态资源裂图（例如 `/static/home-nav/*.svg`）

- 构建产物里必须有对应文件：本地执行 `npm run build:h5` 后检查 `dist/build/h5/static/`（含 `home-nav`）。[`vite.config.ts`](vite.config.ts) 在 `closeBundle` 会**整目录同步**根目录 `static/`，避免 uni 默认拷贝在子目录上偶发不完整。
- [`vercel.ts`](vercel.ts) 的 SPA 回退**不会**把 `/static/`、`/assets/`（以及 `/api/`、`/uploads/`）改写成 `index.html`，减少把 HTML 当图片请求的情况。
- 若线上仍裂图且 Network 里状态为 **304**：用无痕窗口直接打开该 SVG 的 URL，看响应 **`Content-Type`** 是否为 `image/svg+xml`、正文是否以 `<svg` 开头。若实际是 HTML，可在 Vercel 对该部署 **Redeploy（并清除构建/数据缓存）**，避免边缘仍沿用旧缓存。

### 仅推送 `kj` 目录为独立仓库时

若 GitHub 上只有 `kj` 项目根目录（没有外层 `frontend/qianduan`），则 **不要** 填写 Root Directory，直接导入即可；`vercel.ts` 仍在项目根目录生效。
