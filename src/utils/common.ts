/**
 * 项目根目录 `static/` 下的资源 URL（适配 Vite `base` / 子路径部署）
 */
export function staticAsset(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const rawBase = import.meta.env.BASE_URL ?? '/';
  const b = rawBase === '/' ? '' : String(rawBase).replace(/\/$/, '');
  return b ? `${b}${p}` : p;
}

/**
 * 开奖 - 检查是否所有code字段都有值
 */
export const openUrl = (data: any) => {
    if (!data) return false;
    
    const codeName = ['code1', 'code2', 'code3', 'code4', 'code5', 'code6', 'code7']
    for (let i = 0; i < codeName.length; i++) {
        if (!data[codeName[i]]) {
            return true; // 有未开奖的字段
        }
    }
    return false; // 所有字段都已开奖
}