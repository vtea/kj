import { staticAsset } from "@/utils/common";
import { getSx } from "@/utils/zodiac";

/** 蓝 / 红 / 绿 波底图（`static/lan.png`、`hong.png`、`lu.png`） */
export const lotteryBallBgLan = staticAsset("/static/lan.png");
export const lotteryBallBgHong = staticAsset("/static/hong.png");
export const lotteryBallBgLu = staticAsset("/static/lu.png");

export type LotteryBallWave = "red" | "green" | "blue" | "muted";

const WAVE_BG: Record<Exclude<LotteryBallWave, "muted">, string> = {
  blue: lotteryBallBgLan,
  red: lotteryBallBgHong,
  green: lotteryBallBgLu,
};

/**
 * 按波色返回球体背景样式；muted 无图，沿用 `.kball` / `.hball` 默认底色
 */
export function lotteryBallImageStyleForWave(
  wave: LotteryBallWave
): Record<string, string> {
  if (wave === "muted") {
    return {
      backgroundImage: "none",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  const url = WAVE_BG[wave];
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

export function lotteryBallWave(code: unknown): LotteryBallWave {
  if (code == null) return "muted";
  const s = String(code).trim();
  if (!s || s === "?" || s === "--") return "muted";
  const c = getSx(s).color;
  if (c === "red" || c === "green" || c === "blue") return c;
  return "muted";
}
