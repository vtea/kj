<script lang="ts" setup>
import { ref } from "vue";
import { onLoad, onShow, onReachBottom } from "@dcloudio/uni-app";
import {
  getGalleryList,
  GALLERY_LIST_PAGE_MAX,
  type GalleryTypeKey,
} from "@/api/index.ts";
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

const PAGE_SIZE = GALLERY_LIST_PAGE_MAX;

const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
/** 下一页要请求的页码（从 1 起）；首屏成功后为 2 */
const nextPage = ref(1);
const rawList = ref<GalleryRow[]>([]);

/** 地区：澳门 / 香港 / 其他（接口仍为 gallery_type=sicai） */
const regionTab = ref<GalleryTypeKey>("aomen");

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

/** 从首页返回或切回标签时 onShow 会重复触发，节流以减少重复请求 */
const GALLERY_LIST_REFRESH_MS = 90_000;
let lastGalleryListFetchAt = 0;

type GalleryListPayload = {
  list?: unknown;
  has_more?: boolean;
  total?: number;
};

const fetchGallery = async (reset: boolean) => {
  if (!reset) {
    if (!hasMore.value || loading.value || loadingMore.value) return;
  } else {
    loadingMore.value = false;
    nextPage.value = 1;
    rawList.value = [];
    hasMore.value = true;
  }

  const pageToFetch = reset ? 1 : nextPage.value;
  const isFirstScreen = reset || rawList.value.length === 0;
  if (isFirstScreen) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  try {
    const res = await getGalleryList({
      gallery_type: regionTab.value,
      page: pageToFetch,
      limit: PAGE_SIZE,
    });
    const data = (res as { data?: GalleryListPayload })?.data;
    const list = data?.list;
    const mapped: GalleryRow[] = Array.isArray(list)
      ? (list as GalleryRow[]).map((it) => ({
          ...it,
          image: resolveImg(String(it.image || "")),
        }))
      : [];
    if (reset) {
      rawList.value = mapped;
    } else {
      rawList.value = [...rawList.value, ...mapped];
    }
    if (typeof data?.has_more === "boolean") {
      hasMore.value = data.has_more;
    } else if (typeof data?.total === "number") {
      hasMore.value = rawList.value.length < data.total;
    } else {
      hasMore.value = mapped.length >= PAGE_SIZE;
    }
    if (mapped.length === 0) {
      hasMore.value = false;
    } else {
      nextPage.value = pageToFetch + 1;
    }
    lastGalleryListFetchAt = Date.now();
  } catch {
    if (reset) {
      rawList.value = [];
    }
    hasMore.value = false;
    uni.showToast({ title: "加载失败", icon: "none" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

/**
 * 入口：`/pages/gallery/gallery?region=aomen|xianggang|sicai`（sicai 为「其他图库」；列表分页每页 8 条）
 */
onLoad((options?: Record<string, string>) => {
  const t = options?.region ?? options?.gallery_type;
  if (t === "aomen" || t === "xianggang" || t === "sicai") {
    regionTab.value = t;
  }
  fetchGallery(true);
});

onShow(() => {
  const now = Date.now();
  if (lastGalleryListFetchAt === 0) {
    return;
  }
  if (now - lastGalleryListFetchAt < GALLERY_LIST_REFRESH_MS) {
    return;
  }
  fetchGallery(true);
});

onReachBottom(() => {
  if (!hasMore.value || loading.value || loadingMore.value) return;
  fetchGallery(false);
});

const setRegion = (k: GalleryTypeKey) => {
  if (regionTab.value === k) return;
  regionTab.value = k;
  fetchGallery(true);
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
  const urls = rawList.value.map((x) => x.image).filter(Boolean);
  const cur = item.image;
  if (!cur) return;
  uni.previewImage({ current: cur, urls: urls.length ? urls : [cur] });
};

const regionLabel: Record<GalleryTypeKey, string> = {
  aomen: "澳门图库",
  xianggang: "香港图库",
  sicai: "其他图库",
};

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

    <!-- 瀑布双列 -->
    <div class="gal-body">
      <div v-if="loading && rawList.length === 0" class="gal-loading">加载中…</div>
      <div v-else-if="rawList.length === 0" class="gal-empty">
        内部资料，仅会员可见
      </div>
      <template v-else>
        <div class="gal-masonry">
          <div
            v-for="item in rawList"
            :key="item.id"
            class="gal-card"
            @click="onPreview(item)"
          >
            <div class="gal-card-cap">
              <span class="gal-cap-expect">{{ item.expect || "—" }}</span>
              <span class="gal-cap-title">{{ item.title || "未命名" }}</span>
            </div>
            <image class="gal-card-img" :src="item.image" mode="widthFix" />
          </div>
        </div>
        <div v-if="loadingMore" class="gal-load-more">加载更多…</div>
        <div v-else-if="!hasMore && rawList.length > 0" class="gal-load-end">
          没有更多了
        </div>
      </template>
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
.gal-load-more,
.gal-load-end {
  text-align: center;
  padding: 14px 12px 22px;
  font-size: 12px;
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
</style>
