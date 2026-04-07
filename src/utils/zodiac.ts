export interface ZodiacEntry {
  name: string;
  nums: string[];
  colors: string[];
}

export const zodiacList: ZodiacEntry[] = [
  { name: "牛", nums: ["05","17","29","41"], colors: ["green","green","red","blue"] },
  { name: "虎", nums: ["04","16","28","40"], colors: ["blue","green","green","red"] },
  { name: "兔", nums: ["03","15","27","39"], colors: ["blue","blue","green","red"] },
  { name: "龙", nums: ["02","14","26","38"], colors: ["red","blue","blue","green"] },
  { name: "蛇", nums: ["01","13","25","37","49"], colors: ["red","red","blue","blue","green"] },
  { name: "马", nums: ["12","24","36","48"], colors: ["red","red","blue","blue"] },
  { name: "羊", nums: ["11","23","35","47"], colors: ["green","red","red","blue"] },
  { name: "猴", nums: ["10","22","34","46"], colors: ["blue","green","red","red"] },
  { name: "鸡", nums: ["09","21","33","45"], colors: ["blue","green","green","red"] },
  { name: "狗", nums: ["08","20","32","44"], colors: ["red","blue","green","green"] },
  { name: "猪", nums: ["07","19","31","43"], colors: ["red","red","blue","green"] },
  { name: "鼠", nums: ["06","18","30","42"], colors: ["green","red","red","blue"] },
];

const colorHex: Record<string, string> = {
  red: "#d32f2f",
  green: "#2e7d32",
  blue: "#1565c0",
};

export const getSx = (code: string): { color: string; name: string } => {
  if (!code) return { color: "", name: "" };
  const padded = code.padStart(2, "0");
  for (const z of zodiacList) {
    const idx = z.nums.indexOf(padded);
    if (idx !== -1) return { color: z.colors[idx], name: z.name };
  }
  return { color: "red", name: "?" };
};

export const ballBgColor = (code: string): string =>
  colorHex[getSx(code).color] || "#bbb";
