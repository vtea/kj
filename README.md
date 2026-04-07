# liuhe1

## 前端（uni-app H5）一键部署到 Vercel

本仓库前端位于 `frontend/qianduan/kj`，已包含 [`vercel.json`](frontend/qianduan/kj/vercel.json)（构建命令、输出目录、SPA 路由回退）。将下方链接中的 **`YOUR_GITHUB_USERNAME`** 换成你的 GitHub 用户名或组织名，**`REPO_NAME`** 换成本仓库在 GitHub 上的名称（例如 `liuhe1`），即可使用 Vercel 的「从仓库导入」流程并自动带上子目录配置。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_GITHUB_USERNAME%2FREPO_NAME&root-directory=frontend%2Fqianduan%2Fkj)

### 使用说明

1. 点击上方 **Deploy with Vercel**（或打开 [Vercel 控制台](https://vercel.com/new) → **Add New** → **Project** → 导入本仓库）。
2. **Root Directory** 必须为：`frontend/qianduan/kj`（一键链接已预填；若手动导入，请在设置里填写该项）。
3. 构建与输出由 `vercel.json` 指定，一般无需再改：
   - Build Command：`npm run build:h5`
   - Output Directory：`dist/build/h5`
4. 在 Vercel 项目 **Settings → Environment Variables** 中配置与本地一致的环境变量，例如对照 [`frontend/qianduan/kj/.env.example`](frontend/qianduan/kj/.env.example) 设置 `VITE_API_BASE_URL`（生产环境填线上 API 根地址）。修改变量后需重新部署生效。
5. 连接仓库后，推送到已关联分支会自动触发构建与发布。

### 仅推送 `kj` 目录为独立仓库时

若 GitHub 上只有 `kj` 项目根目录（没有外层 `frontend/qianduan`），则 **不要** 填写 Root Directory，直接导入即可；`vercel.json` 仍在项目根目录生效。
