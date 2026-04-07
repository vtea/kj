<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from "vue";
import { onLoad, onReachBottom } from "@dcloudio/uni-app";
import { getHistoryPage, type HistoryModuleKey } from "@/api/index.ts";
import { getSx, ballBgColor } from "@/utils/zodiac";

const codes = ["code1", "code2", "code3", "code4", "code5", "code6"];

/** 首次进入拉取条数 */
const HISTORY_FIRST = 10;
/** 触底每次追加条数 */
const HISTORY_MORE = 5;

const typeMap: Record<string, HistoryModuleKey> = {
  "1": "xtlhc",
  "3": "aomen",
  "4": "xianggang",
};

const listData = ref<any[]>([]);
const moduleKey = ref<HistoryModuleKey | null>(null);
const hasMore = ref(true);
const loading = ref(false);
const loadMoreLock = ref(false);

/**
 * 解析分页接口 data 段
 * @param res axios 拦截器已返回的 body（含 data）
 */
const parseHistoryPayload = (res: unknown): { list: any[]; hasMore: boolean } => {
  const body = res as { data?: { list?: unknown; has_more?: unknown } };
  const d = body?.data ?? {};
  const list = Array.isArray(d.list) ? d.list : [];
  return { list, hasMore: Boolean(d.has_more) };
};

/**
 * 拉取一页并追加到列表
 * @param limit 本请求条数（首屏 10，后续 5）
 */
const fetchHistorySlice = async (limit: number) => {
  const key = moduleKey.value;
  if (!key || loading.value || !hasMore.value) return;
  loading.value = true;
  try {
    const offset = listData.value.length;
    const res = await getHistoryPage(key, offset, limit);
    const { list, hasMore: more } = parseHistoryPayload(res);
    listData.value = listData.value.concat(list);
    hasMore.value = more;
  } catch {
    uni.showToast({ title: "加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
};

/**
 * 触底加载更多（节流）
 */
const tryLoadMoreHistory = async () => {
  if (!moduleKey.value || !hasMore.value || loading.value || loadMoreLock.value) return;
  if (listData.value.length === 0) return;
  loadMoreLock.value = true;
  await fetchHistorySlice(HISTORY_MORE);
  setTimeout(() => {
    loadMoreLock.value = false;
  }, 400);
};

onLoad(async ({ id }: { id?: string }) => {
  const key = id != null ? typeMap[String(id)] : undefined;
  if (!key) return;
  moduleKey.value = key;
  listData.value = [];
  hasMore.value = true;
  await fetchHistorySlice(HISTORY_FIRST);
});

onReachBottom(() => {
  tryLoadMoreHistory();
});

/**
 * H5 整页滚动时补充触底（与首页图库一致）
 */
const onWindowScrollHistory = () => {
  // #ifdef H5
  if (!hasMore.value || loading.value) return;
  const docEl = document.documentElement;
  const body = document.body;
  const top = window.scrollY ?? docEl.scrollTop ?? body.scrollTop ?? 0;
  const vh = window.innerHeight;
  const sh = Math.max(docEl.scrollHeight, body.scrollHeight);
  if (sh - top - vh < 140) tryLoadMoreHistory();
  // #endif
};

onMounted(() => {
  // #ifdef H5
  window.addEventListener("scroll", onWindowScrollHistory, { passive: true });
  // #endif
});

onUnmounted(() => {
  // #ifdef H5
  window.removeEventListener("scroll", onWindowScrollHistory);
  // #endif
});

const goBack = () => uni.navigateBack();

/**
 * 列表项稳定 key：优先主键 id
 * @param item 单行开奖数据
 * @param index 回退下标
 */
const rowKey = (item: Record<string, unknown>, index: number) => {
  const id = item?.id;
  if (id !== undefined && id !== null && String(id) !== "") return `id-${id}`;
  const ex = item?.expect;
  if (ex !== undefined && ex !== null && String(ex) !== "") return `ex-${ex}`;
  return `i-${index}`;
};
</script>

<template>
  <div class="hist-page">
    <header class="hist-header">
      <span class="hist-back" @click="goBack">&larr; 返回</span>
      <span class="hist-title">历史记录</span>
      <span class="hist-placeholder"></span>
    </header>

    <div class="hist-list">
      <div
        v-for="(item, idx) in listData"
        :key="rowKey(item, idx)"
        class="hist-card"
      >
        <div class="hist-meta">
          <span class="hist-expect">第 {{ item?.expect ?? "--" }} 期</span>
          <span class="hist-time">{{ item?.openTime ?? "--" }}</span>
        </div>
        <div class="hist-balls">
          <div class="hball-item" v-for="k in codes" :key="k">
            <div class="hball" :style="{ background: ballBgColor(item[k]) }">
              {{ item?.[k] ?? "--" }}
            </div>
            <span class="hsx">{{ getSx(item[k]).name }}</span>
          </div>
          <div class="hball-sep">+</div>
          <div class="hball-item">
            <div
              class="hball hball-te"
              :style="{ background: ballBgColor(item.code7) }"
            >
              {{ item?.code7 ?? "--" }}
            </div>
            <span class="hsx">{{ getSx(item.code7).name }}</span>
          </div>
        </div>
      </div>

      <p v-if="loading && listData.length > 0" class="hist-footer hist-footer--muted">
        加载中…
      </p>
      <p
        v-else-if="!hasMore && listData.length > 0"
        class="hist-footer hist-footer--muted"
      >
        没有更多了
      </p>
      <p v-else-if="!loading && listData.length === 0" class="hist-footer hist-footer--muted">
        暂无记录
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hist-page {
  max-width: var(--max-w, 720px);
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* 由页面/文档滚动触发 onReachBottom，勿在内部列表再套独立滚动条 */
}

.hist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--c-card, #fff);
  border-bottom: 1px solid var(--c-border, #eaeaea);
  position: sticky;
  top: 0;
  z-index: 10;
}
.hist-back {
  font-size: 13px;
  color: var(--c-accent, #1976d2);
  font-weight: 600;
  cursor: pointer;
  min-width: 60px;
}
.hist-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--c-text, #222);
}
.hist-placeholder {
  min-width: 60px;
}

.hist-list {
  flex: 1;
  padding: 8px;
}

.hist-footer {
  text-align: center;
  font-size: 12px;
  padding: 12px 8px 20px;
  margin: 0;
}
.hist-footer--muted {
  color: var(--c-text-muted, #999);
}

.hist-card {
  background: var(--c-card, #fff);
  border-radius: var(--radius, 10px);
  margin-bottom: 8px;
  overflow: hidden;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}
.hist-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--c-border, #eaeaea);
}
.hist-expect {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text, #222);
}
.hist-time {
  font-size: 11px;
  color: var(--c-text-muted, #999);
}

.hist-balls {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12px 10px 10px;
}
.hball-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hball {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15),
    0 1px 4px rgba(0, 0, 0, 0.1);
}
.hball-te {
  border: 2px solid #e8c326;
}
.hsx {
  margin-top: 3px;
  font-size: 10px;
  color: var(--c-text-secondary, #666);
  font-weight: 700;
  line-height: 1;
}
.hball-sep {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 700;
  color: #bbb;
  height: 38px;
  padding: 0 2px;
  flex-shrink: 0;
}
</style>
