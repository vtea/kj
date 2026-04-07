/**
 * 首页「常用入口」本地兜底配置（后台「常规管理 → 常用入口」有启用数据时由接口覆盖）
 * 图标文件放在项目根目录 `static/home-nav/`，构建后访问路径为 `/static/home-nav/文件名`
 * 也可将某项 `icon` 设为 `/static/logo.svg` 等站内已有资源
 */

/** 图标目录（勿尾斜杠） */
export const HOME_NAV_ICON_DIR = "/static/home-nav";

export type HomeNavItem = {
  label: string;
  /** 完整 URL 路径，供 `<image :src="icon" />` 使用 */
  icon: string;
  route?: string;
};

/**
 * @param file `home-nav` 目录下文件名，如 `kaichang.svg`
 */
export function homeNavIcon(file: string): string {
  return `${HOME_NAV_ICON_DIR}/${file}`;
}

/**
 * 入口列表（顺序即首页展示顺序）
 */
export const homeNavItems: HomeNavItem[] = [
  { label: "开奖现场", icon: homeNavIcon("kaichang.svg") },
  { label: "资料大全", icon: homeNavIcon("ziliao.svg") },
  { label: "资讯统计", icon: homeNavIcon("zixun.svg") },
  { label: "查询助手", icon: homeNavIcon("chaxun.svg") },
  { label: "天线宝宝", icon: homeNavIcon("tianxian.svg") },
  { label: "幽默猜测", icon: homeNavIcon("youmo.svg") },
  /** 图库：优先用全站横幅图；可改为 homeNavIcon('tuku.svg') */
  { label: "六合图库", icon: homeNavIcon("tuku.svg"), route: "/pages/gallery/gallery" },
  { label: "六合论坛", icon: homeNavIcon("luntan.svg") },
  { label: "工具宝箱", icon: homeNavIcon("gongju.svg") },
  { label: "淘料市场", icon: homeNavIcon("taoliao.svg") },
];
