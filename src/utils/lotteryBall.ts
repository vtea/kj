import { staticAsset } from "@/utils/common";
import { getSx } from "@/utils/zodiac";

export const lotteryBallBgUrl = staticAsset("/static/lottery-ball-bg.png");

/** 开奖球共用背景图样式（红/绿/蓝波用色环区分）；背景略偏上，让浅色区对准数字区 */
export const lotteryBallImageStyle: Record<string, string> = {
  backgroundImage: `url("${lotteryBallBgUrl}")`,
  backgroundSize: "cover",
  backgroundPosition: "50% 28%",
  backgroundRepeat: "no-repeat",
};

export type LotteryBallWave = "red" | "green" | "blue" | "muted";

export function lotteryBallWave(code: unknown): LotteryBallWave {
  if (code == null) return "muted";
  const s = String(code).trim();
  if (!s || s === "?" || s === "--") return "muted";
  const c = getSx(s).color;
  if (c === "red" || c === "green" || c === "blue") return c;
  return "muted";
}
