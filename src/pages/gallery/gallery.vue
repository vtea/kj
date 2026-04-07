<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { getGalleryList, type GalleryTypeKey } from "@/api/index.ts";
import { staticAsset } from "@/utils/common";
import { getApiAssetOrigin } from "@/utils/apiBase";

type GalleryRow = {
  id: number;
  title: string;
  expect: string;
  image: string;
  gallery_type?: string;
  sicai_channel?: number | null;
  weigh?: number;
};

const loading = ref(false);
const rawList = ref<GalleryRow[]>([]);

/** 地区：澳门 / 香港 / 其他（接口仍为 gallery_type=sicai） */
const regionTab = ref<GalleryTypeKey>("aomen");

/** 年份 + 显示模式（彩色 / 黑白为前端视图，无单独接口字段） */
type YearPick = { year: string; bw: boolean } | null;
const yearPick = ref<YearPick>(null);

/** 系列筛选（按标题关键字本地过滤） */
type CatKey = "all" | "paogou" | "book" | "network";
const catTab = ref<CatKey>("all");

/**
 * 拼接图片绝对地址
 */
const resolveImg = (src: string): string => {
  const s = (src || "").trim();
  if (!s) return staticAsset("/static/logo.svg");
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/static/")) return staticAsset(s);
  const base = getApiAssetOrigin();
  if (!base) return s.startsWith("/") ? s : `/${s}`;
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
};

/**
 * 入口：`/pages/gallery/gallery?region=aomen|xianggang|sicai`（sicai 展示为「其他图库」，不传频道则拉取全部）
 */
onLoad((options?: Record<string, string>) => {
  const t = options?.region ?? options?.gallery_type;
  if (t === "aomen" || t === "xianggang" || t === "sicai") {
    regionTab.value = t;
  }
});

/** 从首页返回或切回标签时 onShow 会重复触发，节流以减少重复请求 */
const GALLERY_LIST_REFRESH_MS = 90_000;
let lastGalleryListFetchAt = 0;

const loadList = async () => {
  loading.value = true;
  try {
    /** 其他图库不传 sicai_channel，后端返回该类型下全部记录 */
    const res = await getGalleryList({ gallery_type: regionTab.value });
    const list = (res as { data?: { list?: unknown } })?.data?.list;
    rawList.value = Array.isArray(list)
      ? (list as GalleryRow[]).map((it) => ({
          ...it,
          image: resolveImg(String(it.image || "")),
        }))
      : [];
  } catch {
    rawList.value = [];
    uni.showToast({ title: "加载失败", icon: "none" });
  } finally {
    loading.value = false;
    lastGalleryListFetchAt = Date.now();
  }
};

watch(regionTab, () => {
  loadList();
});

onShow(() => {
  const now = Date.now();
  if (
    lastGalleryListFetchAt > 0 &&
    now - lastGalleryListFetchAt < GALLERY_LIST_REFRESH_MS
  ) {
    return;
  }
  loadList();
});

const filteredList = computed(() => {
  return rawList.value.filter((item) => {
    const title = String(item.title || "");
    const expect = String(item.expect || "");
    if (yearPick.value) {
      const y = yearPick.value.year;
      if (!expect.includes(y) && !title.includes(y)) return false;
    }
    switch (catTab.value) {
      case "paogou":
        if (!/跑狗|狗/.test(title)) return false;
        break;
      case "book":
        if (!/书|籍|宝典|秘笈|册/.test(title)) return false;
        break;
      case "network":
        if (!/网|全|综合/.test(title)) return false;
        break;
      default:
        break;
    }
    return true;
  });
});

const setRegion = (k: GalleryTypeKey) => {
  regionTab.value = k;
};

const toggleYear = (year: string, bw: boolean) => {
  const cur = yearPick.value;
  if (cur && cur.year === year && cur.bw === bw) {
    yearPick.value = null;
  } else {
    yearPick.value = { year, bw };
  }
};

const yearActive = (year: string, bw: boolean) => {
  const p = yearPick.value;
  return !!(p && p.year === year && p.bw === bw);
};

/**
 * 回首页（与开奖首页一致）
 */
const goHome = () => {
  try {
    uni.reLaunch({ url: "/pages/index/index" });
  } catch {
    uni.navigateTo({ url: "/pages/index/index" });
  }
};

/**
 * 返回上一页；无历史栈时（如 H5 直链打开）回首页，避免 navigateBack 无反应
 */
const goBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack({
      fail: () => goHome(),
    });
  } else {
    goHome();
  }
};

const onPreview = (item: GalleryRow) => {
  const urls = filteredList.value.map((x) => x.image).filter(Boolean);
  const cur = item.image;
  if (!cur) return;
  uni.previewImage({ current: cur, urls: urls.length ? urls : [cur] });
};

const regionLabel: Record<GalleryTypeKey, string> = {
  aomen: "澳门图库",
  xianggang: "香港图库",
  sicai: "其他图库",
};

const yearOptions = [
  { year: "2026", bw: false, label: "2026年\n彩色" },
  { year: "2026", bw: true, label: "2026年\n黑白" },
  { year: "2025", bw: false, label: "2025年\n彩色" },
  { year: "2025", bw: true, label: "2025年\n黑白" },
] as const;

const catOptions: { key: CatKey; label: string }[] = [
  { key: "paogou", label: "跑狗系列" },
  { key: "book", label: "书籍系列" },
  { key: "network", label: "全网系列" },
  { key: "all", label: "更多" },
];
</script>

<template>
  <div class="gal-page">
    <header class="gal-header">
      <button type="button" class="gal-header-btn gal-back" @click="goBack">← 返回</button>
      <span class="gal-title">六合图库</span>
      <button type="button" class="gal-header-btn gal-home" @click="goHome">主页</button>
    </header>

    <!-- 地区 Tab -->
    <div class="gal-region-row">
      <button
        v-for="k in (['aomen', 'xianggang', 'sicai'] as GalleryTypeKey[])"
        :key="k"
        type="button"
        class="gal-region-btn"
        :class="{ active: regionTab === k }"
        @click="setRegion(k)"
      >
        {{ regionLabel[k] }}
      </button>
    </div>

    <div class="gal-divider" />

    <!-- 年份 + 彩/黑（横向滚动） -->
    <div class="gal-year-scroll">
      <button
        v-for="(opt, idx) in yearOptions"
        :key="idx"
        type="button"
        class="gal-year-item"
        :class="{
          on: yearActive(opt.year, opt.bw),
          teal: !opt.bw,
          gray: opt.bw,
        }"
        @click="toggleYear(opt.year, opt.bw)"
      >
        <span class="gal-year-icon" aria-hidden="true">图</span>
        <span class="gal-year-text">{{ opt.label }}</span>
      </button>
    </div>

    <!-- 系列筛选 -->
    <div class="gal-cat-row">
      <button
        v-for="c in catOptions"
        :key="c.key"
        type="button"
        class="gal-cat-btn"
        :class="{ active: catTab === c.key, more: c.key === 'all' }"
        @click="catTab = c.key"
      >
        {{ c.label }}
      </button>
    </div>

    <!-- 瀑布双列 -->
    <div class="gal-body">
      <div v-if="loading" class="gal-loading">加载中…</div>
      <div v-else-if="filteredList.length === 0" class="gal-empty">
        暂无图库，请在后台添加并设为「已显示」
      </div>
      <div v-else class="gal-masonry">
        <div
          v-for="item in filteredList"
          :key="item.id"
          class="gal-card"
          @click="onPreview(item)"
        >
          <div class="gal-card-cap">
            <span class="gal-cap-expect">{{ item.expect || "—" }}</span>
            <span class="gal-cap-title">{{ item.title || "未命名" }}</span>
          </div>
          <image
            class="gal-card-img"
            :class="{ 'gal-card-img--bw': yearPick?.bw }"
            :src="item.image"
            mode="widthFix"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.gal-page {
  max-width: var(--max-w);
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #e8f5e9 0%, var(--c-bg) 18%);
}

.gal-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  padding-top: calc(10px + env(safe-area-inset-top, 0px));
  padding-left: max(12px, env(safe-area-inset-left, 0px));
  padding-right: max(12px, env(safe-area-inset-right, 0px));
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--c-border);
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(46, 125, 50, 0.08);
  box-sizing: border-box;
}
.gal-header-btn {
  margin: 0;
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(180deg, #66bb6a, var(--c-green));
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 2px 10px rgba(46, 125, 50, 0.35);
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
  &:focus-visible {
    outline: 2px solid rgba(46, 125, 50, 0.5);
    outline-offset: 2px;
  }
  &:active {
    opacity: 0.92;
    transform: scale(0.97);
    box-shadow: 0 1px 6px rgba(46, 125, 50, 0.3);
  }
}
.gal-back {
  justify-self: start;
}
.gal-home {
  justify-self: end;
}
.gal-title {
  justify-self: center;
  text-align: center;
  font-size: 17px;
  font-weight: 900;
  color: var(--c-green);
  letter-spacing: 1px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gal-region-row {
  display: flex;
  gap: 8px;
  padding: 10px 10px 6px;
}
.gal-region-btn {
  flex: 1;
  padding: 10px 4px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(180deg, #81c784, var(--c-green));
  opacity: 0.55;
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.2);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
  &.active {
    opacity: 1;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(46, 125, 50, 0.35);
  }
}

.gal-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(46, 125, 50, 0.25), transparent);
  margin: 0 12px 8px;
}

.gal-year-scroll {
  display: flex;
  gap: 12px;
  padding: 4px 12px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
.gal-year-item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 76px;
  padding: 8px 4px 10px;
  border: 2px solid transparent;
  border-radius: 14px;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  &.teal .gal-year-icon {
    background: linear-gradient(145deg, #26a69a, #00897b);
  }
  &.gray .gal-year-icon {
    background: linear-gradient(145deg, #9e9e9e, #616161);
  }
  &.on {
    border-color: var(--c-green);
    box-shadow: 0 4px 14px rgba(46, 125, 50, 0.25);
  }
}
.gal-year-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 15px;
  font-weight: 900;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
.gal-year-text {
  font-size: 10px;
  font-weight: 800;
  color: var(--c-text-secondary);
  text-align: center;
  line-height: 1.25;
  white-space: pre-line;
}

.gal-cat-row {
  display: flex;
  gap: 8px;
  padding: 0 10px 12px;
  flex-wrap: wrap;
}
.gal-cat-btn {
  flex: 1;
  min-width: calc(25% - 8px);
  padding: 9px 6px;
  border-radius: 999px;
  border: 2px solid var(--c-green-light);
  background: var(--c-green);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  &.more {
    background: #f1f8e9;
    color: var(--c-green);
    border-color: var(--c-green-light);
  }
  &.active:not(.more) {
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.15);
  }
  &.active.more {
    background: var(--c-green);
    color: #fff;
    border-color: var(--c-green);
  }
}

.gal-body {
  flex: 1;
  padding: 0 8px 16px;
}
.gal-loading,
.gal-empty {
  text-align: center;
  padding: 32px 16px;
  font-size: 13px;
  color: var(--c-text-muted);
}
.gal-masonry {
  column-count: 2;
  column-gap: 10px;
}
.gal-card {
  break-inside: avoid;
  margin-bottom: 10px;
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(46, 125, 50, 0.12);
  cursor: pointer;
  transition: transform 0.12s;
  &:active {
    transform: scale(0.98);
  }
}
.gal-card-cap {
  padding: 8px 10px;
  background: linear-gradient(90deg, #fffde7, #fff);
  border-bottom: 1px solid #eee;
}
.gal-cap-expect {
  display: block;
  font-size: 11px;
  font-weight: 800;
  color: var(--c-primary);
  margin-bottom: 2px;
}
.gal-cap-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.gal-card-img {
  width: 100%;
  display: block;
  vertical-align: top;
  background: #f5f5f5;
}
.gal-card-img--bw {
  filter: grayscale(1) contrast(1.05);
}
</style>
