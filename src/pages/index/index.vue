<script lang="ts" setup>
import { onShow, onReachBottom } from "@dcloudio/uni-app";
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import Card from "./src/card.vue";
import {
  getIndexLast,
  getAomen,
  getXianggangLast,
  getTitle,
  getMenuNames,
  getHomeBanners,
  getGalleryList,
  GALLERY_LIST_PAGE_MAX,
  getBackupUrlList,
  getQuickJumpList,
  getCommonEntranceList,
  type GalleryTypeKey,
  type BackupUrlItem,
  type QuickJumpItem,
  type CommonEntranceItem,
} from "@/api/index.ts";
import { getApiAssetOrigin } from "@/utils/apiBase";
import { siteLayout, loadSiteLayout } from "@/utils/siteLayout";
import { homeNavItems } from "@/constants/homeNav";
import { openUrl, staticAsset } from "@/utils/common";

const cardCanada = ref();
const canadaData = ref<any>({});
const nextDrawTime = ref<any>(new Date());
const getAll = async () => {
  const { data } = await getIndexLast();
  cardCanada.value?.init(data?.last_data, 1);
  canadaData.value = data?.last_data ?? {};
  nextDrawTime.value = new Date(data?.last_data?.nextTime);

  // 清理之前的定时器
  if (intervalId) {
    clearInterval(intervalId);
  }

  const hasUnopened = openUrl(data?.last_data);
  if (hasUnopened) {
    // 如果有未开奖的字段，10秒后重新获取
    intervalId = setTimeout(getAll, 10000);
  } else {
    // 如果都已开奖，开始定时更新时间
    intervalId = setInterval(updateTime, 10000);
  }
};
/**
 * 监听当前时间
 */
let intervalId: any = null;
const currentTime = ref(new Date());

const updateTime = () => {
  currentTime.value = new Date();
};

watch(
  currentTime,
  (newTime, oldTime) => {
    const aTime = newTime.getTime();
    const bTime = nextDrawTime.value.getTime();
    // 须用时间差换算「剩余整分钟」，勿用 new Date(diff).getMinutes()（那是 1970 时刻的「分」位，超过约 1 小时会算错并误清空卡片）
    const diffMs = bTime - aTime;
    if (!Number.isFinite(diffMs)) return;
    const minutesLeft = Math.floor(diffMs / 60_000);
    if (bTime > aTime && minutesLeft <= 5) {
      // 距下一期截止 ≤5 分钟：清空展示，等待搅珠/新一期数据
      cardCanada.value?.init({}, 1);
    } else if (bTime > aTime && minutesLeft > 5) {
      getAll();
      clearInterval(intervalId);
    }
  },
  {
    immediate: true,
  }
);
// 定时轮询（每 10 秒请求一次接口）
let pollTimer: any = null;
const startPolling10s = () => {
  // 防止重复启动
  stopPolling10s();
  pollTimer = setInterval(async () => {
    try {
      await getIndexLast();
    } catch (e) {
      // 记录错误但不打断轮询
      console.error('Polling getIndexLast error:', e);
    }
  }, 10000);
};
const stopPolling10s = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const TITLE_COUNT = 15;
const titleContents = ref<string[]>(Array(TITLE_COUNT).fill(''));
const loadAllTitles = async () => {
  const results = await Promise.all(
    Array.from({ length: TITLE_COUNT }, (_, i) =>
      getTitle({ title_num: i + 1 }).catch(() => null)
    )
  );
  titleContents.value = results.map(r => r?.data?.title_data?.content ?? '');
};

type GreenTab = 'jianada' | 'aomen' | 'xianggang'
const activeGreenTab = ref<GreenTab>('jianada')

/** 当前彩种：后端号码未齐（搅珠/陆续公布）时为 true，与卡片内 openUrl 一致 */
const drawingLive = ref(false);
const onDrawingLive = (live: boolean) => {
  drawingLive.value = live;
};

/** Tab 按钮名称（从后台菜单规则表读取，默认兜底） */
const tabNames = ref<Record<GreenTab, string>>({
  jianada: '金多寶',
  aomen: '澳门',
  xianggang: '香港',
})
const loadTabNames = async () => {
  try {
    const { data } = await getMenuNames()
    const names = data?.names ?? {}
    if (names.xtlhc) tabNames.value.jianada = names.xtlhc
    if (names.aomen) tabNames.value.aomen = names.aomen
    if (names.xianggang) tabNames.value.xianggang = names.xianggang
  } catch { /* 请求失败用默认名 */ }
}

/**
 * 根据当前 tab 加载对应开奖数据到卡片
 * jianada(1) → xtlhc + 定时轮询
 * aomen(3)   → lhc_aomen 最新一期
 * xianggang(4) → lhc_xianggang 最新一期
 */
const loadCardData = async (tab: GreenTab) => {
  drawingLive.value = false;
  // 先停止旧 tab 的所有定时器
  stopPolling10s()
  if (intervalId) {
    clearTimeout(intervalId)
    clearInterval(intervalId)
    intervalId = null
  }

  if (tab === 'jianada') {
    await getAll()
    startPolling10s()
  } else if (tab === 'aomen') {
    try {
      const { data } = await getAomen()
      cardCanada.value?.init(data?.last_one, 3)
    } catch (e) {
      console.error('aomen load error:', e)
    }
  } else if (tab === 'xianggang') {
    try {
      const { data } = await getXianggangLast()
      cardCanada.value?.init(data?.last_one, 4)
    } catch (e) {
      console.error('xianggang load error:', e)
    }
  }
}

const setGreenTab = async (k: GreenTab) => {
  if (activeGreenTab.value === k) return
  activeGreenTab.value = k
  await loadCardData(k)
  await loadHomeGallerySpot(true)
}

/**
 * 卡片"刷新"按钮 —— 根据当前 tab 刷新对应数据
 */
const handleRefresh = () => loadCardData(activeGreenTab.value)

onMounted(() => {
  updateTime();
  // #ifdef H5
  window.addEventListener("scroll", onWindowScrollForGallery, { passive: true });
  // #endif
  onUnmounted(() => {
    // #ifdef H5
    window.removeEventListener("scroll", onWindowScrollForGallery);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
    // #endif
    if (intervalId) {
      if (typeof intervalId === 'number') {
        clearTimeout(intervalId);
      } else {
        clearInterval(intervalId);
      }
    }
    stopPolling10s();
  });
});
onShow(() => {
  const now = Date.now();
  if (
    lastHomeFullFetchAt > 0 &&
    now - lastHomeFullFetchAt < HOME_FULL_REFRESH_MS
  ) {
    ensureJianadaPolling();
    // 整页节流期间仍拉常用入口：后台改「隐藏」后若不再请求会一直显示旧列表
    loadCommonEntrance();
    return;
  }
  lastHomeFullFetchAt = now;
  runFullHomeRefresh();
});
const goHome = () => {
  try { uni.reLaunch({ url: '/pages/index/index' }); } catch { uni.navigateTo({ url: '/pages/index/index' }); }
};

/**
 * 首页「整页拉数据」节流：从子页面返回或切回浏览器标签时 onShow 会频繁触发，
 * 不必每次都打满 15 个标题 + 图库 + 横幅等接口，避免浪费服务端资源。
 * 开奖区仍依赖轮询 / 用户点刷新；超过间隔后再完整同步后台配置与列表。
 */
const HOME_FULL_REFRESH_MS = 120_000;
let lastHomeFullFetchAt = 0;

/** 节流跳过完整刷新时，确保加拿大 tab 的 10s 轮询仍在（防止个别环境下定时器异常） */
const ensureJianadaPolling = () => {
  if (activeGreenTab.value !== "jianada") return;
  if (!pollTimer) startPolling10s();
};

const runFullHomeRefresh = async () => {
  loadSiteLayout();
  loadBackupUrls();
  loadQuickJump();
  loadCommonEntrance();
  await loadCardData(activeGreenTab.value);
  loadTabNames();
  loadAllTitles();
  loadAllBanners();
  loadHomeGallerySpot();
};

/** 广告横幅条目（多展示位共用） */
type HomeBannerItem = { id: number; image: string; url: string };

const homeBanners = ref<HomeBannerItem[]>([]);
/** 开奖卡片下方，后台 position=lottery_below */
const lotteryBelowBanners = ref<HomeBannerItem[]>([]);
const FALLBACK_BANNER = staticAsset('/static/logo.svg');
/** 顶栏轮播首张图已就绪后再展示卡片，避免未加载时出现占位底图 */
const homeBannerImagesReady = ref(false);
/** 开奖下方广告首张图已就绪后再展示 */
const lotteryBelowBannerImagesReady = ref(false);

/**
 * 横幅/后台图片地址：`/static/` 走前端站点；`/uploads/` 等走 API 域名
 */
const resolveBannerSrc = (src: string): string => {
  const s = (src || '').trim();
  if (!s) return FALLBACK_BANNER;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/static/')) {
    return staticAsset(s);
  }
  const base = getApiAssetOrigin();
  if (!base) return s.startsWith('/') ? s : `/${s}`;
  return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`;
};

/** 后台「常规管理 → 常用入口」 */
const navHubApiList = ref<CommonEntranceItem[]>([]);
/**
 * 接口是否已成功返回过（含 list 为空）：用于区分「后台确实无条目」与「尚未加载/请求失败」。
 * 若仅用 length>0 判断，后台全部隐藏时列表为空会误回退静态 `homeNavItems`，隐藏仍显示。
 */
const navHubApiLoadedOk = ref(false);

/**
 * 拉取常用入口列表（仅 status=显示 且名称、图标非空）
 */
const loadCommonEntrance = async () => {
  try {
    const res = await getCommonEntranceList();
    const raw = (res as { data?: { list?: unknown } })?.data?.list;
    const list: CommonEntranceItem[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[]).map((x) => ({
          id: Number(x.id) || 0,
          title: String(x.title ?? '').trim(),
          image: String(x.image ?? '').trim(),
          url: String(x.url ?? '').trim(),
        })).filter((x) => x.title !== '' && x.image !== '')
      : [];
    navHubApiList.value = list;
    navHubApiLoadedOk.value = true;
  } catch {
    navHubApiList.value = [];
    navHubApiLoadedOk.value = false;
  }
};

/**
 * 首页「常用入口」宫格：接口成功则以接口为准（可为空）；仅请求失败时回退本地静态配置
 */
const displayNavHubItems = computed(() => {
  if (navHubApiLoadedOk.value) {
    return navHubApiList.value.map((it) => ({
      id: it.id,
      label: it.title,
      icon: resolveBannerSrc(it.image),
      url: it.url,
    }));
  }
  return homeNavItems.map((it, i) => ({
    id: -(i + 1),
    label: it.label,
    icon: resolveBannerSrc(it.icon),
    url: (it.route || '').trim(),
  }));
});

const DEFAULT_HEADER_LOGO = staticAsset('/static/logo.svg');
/** 后台「前台Logo / 主标题 / 副标题」 */
const headerLogoSrc = computed(() => {
  const u = (siteLayout.value.header_logo || '').trim();
  if (!u) return DEFAULT_HEADER_LOGO;
  return resolveBannerSrc(u);
});
/** Logo 地址无效（404 等）时回退站内默认，避免裂图 */
const headerLogoOverride = ref<string | null>(null);
const headerLogoDisplay = computed(
  () => headerLogoOverride.value ?? headerLogoSrc.value,
);
watch(headerLogoSrc, () => {
  headerLogoOverride.value = null;
});
function onHeaderLogoError() {
  if (headerLogoOverride.value === DEFAULT_HEADER_LOGO) return;
  headerLogoOverride.value = DEFAULT_HEADER_LOGO;
}
const headerTitleText = computed(
  () => (siteLayout.value.header_title || '').trim() || '金多寶'
);
const headerSubtitleText = computed(() => (siteLayout.value.header_subtitle || '').trim());

/**
 * 将接口返回的 list 规范为条目数组
 */
const normalizeBannerList = (res: unknown): HomeBannerItem[] => {
  const r = res as { data?: { list?: unknown } };
  const raw = r?.data?.list;
  const list = Array.isArray(raw) ? raw : [];
  return list.map((it: Record<string, unknown>) => ({
    id: Number(it.id) || 0,
    image: resolveBannerSrc(String(it.image ?? '')),
    url: String(it.url ?? '').trim(),
  }));
};

/**
 * 并行加载首页轮播 + 开奖框下广告
 */
const loadAllBanners = async () => {
  homeBannerImagesReady.value = false;
  lotteryBelowBannerImagesReady.value = false;
  const [homeR, belowR] = await Promise.allSettled([
    getHomeBanners({ position: 'home_carousel' }),
    getHomeBanners({ position: 'lottery_below' }),
  ]);
  homeBanners.value =
    homeR.status === 'fulfilled' ? normalizeBannerList(homeR.value) : [];
  lotteryBelowBanners.value =
    belowR.status === 'fulfilled' ? normalizeBannerList(belowR.value) : [];
};

/**
 * 轮播首张远程图加载完成（或失败）后再展示区域，避免空白/渐变框抢镜
 */
const onHomeBannerPreloadDone = () => {
  homeBannerImagesReady.value = true;
};

const onLotteryBelowBannerPreloadDone = () => {
  lotteryBelowBannerImagesReady.value = true;
};

/**
 * 点击横幅跳转外链
 */
const onBannerTap = (item: HomeBannerItem) => {
  const u = item.url;
  if (!u) return;
  // #ifdef H5
  window.open(u, '_blank', 'noopener,noreferrer');
  // #endif
  // #ifndef H5
  // @ts-expect-error 5+ App
  if (typeof plus !== 'undefined' && plus.runtime?.openURL) {
    plus.runtime.openURL(u);
  } else {
    uni.setClipboardData({
      data: u,
      success: () => uni.showToast({ title: '链接已复制', icon: 'none' }),
    });
  }
  // #endif
};

/**
 * 点击常用入口：站内 `/pages/...` 走 navigate；外链同横幅；无地址则提示
 * @param item 展示用条目（含已解析的 icon URL）
 */
const onNavHubTap = (item: { id: number; label: string; icon: string; url: string }) => {
  const u = item.url.trim();
  if (!u) {
    uni.showToast({ title: '敬请期待', icon: 'none' });
    return;
  }
  if (u.startsWith('/pages/')) {
    uni.navigateTo({ url: u });
    return;
  }
  onBannerTap({ id: item.id, image: item.icon, url: u });
};

/** 首页「备用网址」板块：后台 general/backup_url，每行 2 个 */
const backupUrlPairRows = ref<BackupUrlItem[][]>([]);
const loadBackupUrls = async () => {
  try {
    const res = await getBackupUrlList();
    const raw = (res as { data?: { list?: unknown } })?.data?.list;
    const list: BackupUrlItem[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[]).map((x) => ({
          id: Number(x.id) || 0,
          title: String(x.title ?? "").trim(),
          url: String(x.url ?? "").trim(),
        })).filter((x) => x.title !== "")
      : [];
    const rows: BackupUrlItem[][] = [];
    for (let i = 0; i < list.length; i += 2) {
      rows.push(list.slice(i, i + 2));
    }
    backupUrlPairRows.value = rows;
  } catch {
    backupUrlPairRows.value = [];
  }
};

const onBackupUrlTap = (item: BackupUrlItem) => {
  const u = item.url;
  if (!u) return;
  onBannerTap({ id: item.id, image: "", url: u });
};

/** 首页每行快捷按钮个数（与 UI 两排×五列一致） */
const QUICK_JUMP_COLS = 5;

/** 后台 general/quick_jump，按权重排序后按行切块 */
const quickJumpRows = ref<QuickJumpItem[][]>([]);
/** 当前高亮项在扁平列表中的下标（点击后切换，初始为 0） */
const activeQuickJumpIndex = ref(0);

/**
 * 拉取快捷跳转并切成每行 5 个；无启用项则整块不展示
 */
const loadQuickJump = async () => {
  try {
    const res = await getQuickJumpList();
    const raw = (res as { data?: { list?: unknown } })?.data?.list;
    const list: QuickJumpItem[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[]).map((x) => ({
          id: Number(x.id) || 0,
          title: String(x.title ?? "").trim(),
          url: String(x.url ?? "").trim(),
        })).filter((x) => x.title !== "")
      : [];
    const rows: QuickJumpItem[][] = [];
    for (let i = 0; i < list.length; i += QUICK_JUMP_COLS) {
      rows.push(list.slice(i, i + QUICK_JUMP_COLS));
    }
    quickJumpRows.value = rows;
    activeQuickJumpIndex.value = 0;
  } catch {
    quickJumpRows.value = [];
  }
};

/**
 * @param item 当前按钮
 * @param flatIndex 在全部快捷项中的顺序下标（用于高亮）
 */
const onQuickJumpTap = (item: QuickJumpItem, flatIndex: number) => {
  activeQuickJumpIndex.value = flatIndex;
  const u = item.url;
  if (!u) return;
  onBannerTap({ id: item.id, image: "", url: u });
};

/** 首页精选图库：每页条数（与后台/接口上限一致；触底再拉下一页） */
const HOME_GALLERY_PAGE_SIZE = GALLERY_LIST_PAGE_MAX;
/** 午夜彩 tab：精选区展示澳门 + 香港各取最新条数（各一次请求，共 8 张） */
const JIANADA_HOME_GALLERY_EACH = 4;

/**
 * 绿标 tab → 图库 API 分区（与开奖数据源一致）
 * - jianada：首页精选区单独逻辑（澳门 4 + 香港 4）；无卡片点「更多」默认进澳门图库
 * - aomen：澳门图库
 * - xianggang：香港图库
 */
const greenTabToGalleryType = (tab: GreenTab): GalleryTypeKey => {
  if (tab === "xianggang") return "xianggang";
  if (tab === "aomen") return "aomen";
  return "sicai";
};

const greenTabToGalleryRegionTag = (tab: GreenTab): string => {
  if (tab === "xianggang") return "香港";
  if (tab === "aomen") return "澳门";
  const n = tabNames.value.jianada?.trim();
  return n || "其他";
};

/** 首页图库卡片 */
type HomeGalleryCard = {
  id: number;
  title: string;
  image: string;
  gallery_type: GalleryTypeKey;
  /** 角标文案 */
  regionTag: string;
  sicai_channel: number | null;
};

/** 当前彩种下已加载的图库列表（首屏 8 条，触底追加下一页） */
const homeGalleryFull = ref<HomeGalleryCard[]>([]);
/** 下一页请求页码（从 1 起；首屏成功后为 2） */
const homeGalleryNextPage = ref(1);
const gallerySpotLoading = ref(false);
const galleryMoreLoading = ref(false);
const homeGalleryHasMore = ref(false);
/** 触底加载节流，避免一次滑到底连续触发多次 */
let galleryLoadMoreLock = false;

const homeGalleryList = computed(() => homeGalleryFull.value);

/**
 * 将单次图库接口响应转为首页卡片（全量，顺序与后台一致）
 */
const sliceGalleryToCards = (
  res: unknown,
  galleryType: GalleryTypeKey,
  regionTag: string
): HomeGalleryCard[] => {
  const raw = (res as { data?: { list?: unknown } })?.data?.list;
  if (!Array.isArray(raw)) return [];
  return raw.map((row: Record<string, unknown>) => {
    const ch = row.sicai_channel;
    return {
      id: Number(row.id) || 0,
      title: String(row.title ?? ""),
      image: resolveBannerSrc(String(row.image ?? "")),
      gallery_type: galleryType,
      regionTag,
      sicai_channel:
        galleryType === "sicai" && ch != null && ch !== ""
          ? Number(ch)
          : null,
    };
  });
};

/**
 * 主滚动区触底：请求下一页（同当前彩种分区）
 */
const loadMoreHomeGallery = async () => {
  if (!homeGalleryHasMore.value || gallerySpotLoading.value || galleryMoreLoading.value)
    return;
  if (galleryLoadMoreLock) return;
  galleryLoadMoreLock = true;
  try {
    await loadHomeGallerySpot(false);
  } finally {
    setTimeout(() => {
      galleryLoadMoreLock = false;
    }, 350);
  }
};

/**
 * 主内容区滚动：接近底部时加载更多图库
 */
/**
 * 可滚动容器触底（仅当该元素自身出现滚动条时才会触发；多数 H5 为整页滚动，需配合 window / onReachBottom）
 */
const onMainScroll = (e: Event) => {
  const el = e.target as HTMLElement | null;
  if (!el || el.scrollHeight <= el.clientHeight + 1) return;
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (gap < 100) loadMoreHomeGallery();
};

/**
 * H5：整页滚动时 document/window 滚动，.main-scroll 往往不触发 scroll
 */
// #ifdef H5
const onWindowScrollForGallery = () => {
  if (!homeGalleryHasMore.value || gallerySpotLoading.value || galleryMoreLoading.value)
    return;
  const docEl = document.documentElement;
  const body = document.body;
  const top = window.scrollY ?? docEl.scrollTop ?? body.scrollTop ?? 0;
  const vh = window.innerHeight;
  const sh = Math.max(docEl.scrollHeight, body.scrollHeight);
  if (sh - top - vh < 140) loadMoreHomeGallery();
};
// #endif

/** 小程序 / App 等：页面级触底 */
onReachBottom(() => {
  loadMoreHomeGallery();
});

type GalleryListMeta = { has_more?: boolean; total?: number };

/**
 * 按当前绿标 tab 拉取对应分区图库：
 * - 午夜彩：并行拉澳门 / 香港各最新 {@link JIANADA_HOME_GALLERY_EACH} 条，无触底翻页
 * - 澳门 / 香港：单分区分页，每页 8 条
 */
const loadHomeGallerySpot = async (reset = true) => {
  if (reset) {
    homeGalleryFull.value = [];
    homeGalleryNextPage.value = 1;
    homeGalleryHasMore.value = false;
  }
  const tab = activeGreenTab.value;
  if (tab === "jianada" && !reset) {
    return;
  }
  const useFullLoading = reset || homeGalleryFull.value.length === 0;
  if (useFullLoading) {
    gallerySpotLoading.value = true;
  } else {
    galleryMoreLoading.value = true;
  }
  try {
    if (tab === "jianada") {
      const lim = JIANADA_HOME_GALLERY_EACH;
      const [resAm, resXg] = await Promise.all([
        getGalleryList({ gallery_type: "aomen", page: 1, limit: lim }),
        getGalleryList({ gallery_type: "xianggang", page: 1, limit: lim }),
      ]);
      const tagAm = greenTabToGalleryRegionTag("aomen");
      const tagXg = greenTabToGalleryRegionTag("xianggang");
      const cardsAm = sliceGalleryToCards(resAm, "aomen", tagAm);
      const cardsXg = sliceGalleryToCards(resXg, "xianggang", tagXg);
      homeGalleryFull.value = [...cardsAm, ...cardsXg];
      homeGalleryHasMore.value = false;
      homeGalleryNextPage.value = 1;
    } else {
      const gt = greenTabToGalleryType(tab);
      const tag = greenTabToGalleryRegionTag(tab);
      const pageToFetch = homeGalleryNextPage.value;
      const res = await getGalleryList({
        gallery_type: gt,
        page: pageToFetch,
        limit: HOME_GALLERY_PAGE_SIZE,
      });
      const cards = sliceGalleryToCards(res, gt, tag);
      const data = (res as { data?: GalleryListMeta })?.data;
      if (reset) {
        homeGalleryFull.value = cards;
      } else {
        homeGalleryFull.value = [...homeGalleryFull.value, ...cards];
      }
      if (typeof data?.has_more === "boolean") {
        homeGalleryHasMore.value = data.has_more;
      } else if (typeof data?.total === "number") {
        homeGalleryHasMore.value = homeGalleryFull.value.length < data.total;
      } else {
        homeGalleryHasMore.value = cards.length >= HOME_GALLERY_PAGE_SIZE;
      }
      if (cards.length === 0) {
        homeGalleryHasMore.value = false;
      } else {
        homeGalleryNextPage.value = pageToFetch + 1;
      }
    }
  } catch {
    if (reset) {
      homeGalleryFull.value = [];
    }
    homeGalleryHasMore.value = false;
  } finally {
    gallerySpotLoading.value = false;
    galleryMoreLoading.value = false;
  }
};

/**
 * 进入图库页（按分区；其他图库不再带频道参数）
 */
const openGalleryPage = (card?: HomeGalleryCard) => {
  let url = "/pages/gallery/gallery";
  const t = activeGreenTab.value;
  const region = card
    ? card.gallery_type
    : t === "jianada"
      ? "aomen"
      : greenTabToGalleryType(t);
  url += `?region=${encodeURIComponent(region)}`;
  uni.navigateTo({ url });
};

/** 精选图库自定义大图预览（替代 uni.previewImage） */
const galleryPreview = ref<{
  show: boolean;
  urls: string[];
  /** 与 urls 同序，用于「查看更多」跳转对应分区 */
  types: GalleryTypeKey[];
  current: number;
}>({ show: false, urls: [], types: [], current: 0 });
const galleryPreviewKey = ref(0);

/**
 * 打开大图预览：与当前列表同序，可左右滑动
 */
const onHomeGalleryPreview = (item: HomeGalleryCard) => {
  const cur = item.image;
  if (!cur) return;
  const slides = homeGalleryList.value
    .map((x) => ({ url: x.image, type: x.gallery_type }))
    .filter((s) => Boolean(s.url));
  const urls = slides.map((s) => s.url);
  const types = slides.map((s) => s.type);
  const idx = Math.max(0, urls.indexOf(cur));
  galleryPreviewKey.value += 1;
  galleryPreview.value = {
    show: true,
    urls: urls.length ? urls : [cur],
    types: types.length ? types : [item.gallery_type],
    current: idx,
  };
};

/**
 * 关闭预览并恢复页面滚动（H5）
 */
const closeGalleryPreview = () => {
  galleryPreview.value.show = false;
  // #ifdef H5
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
  // #endif
};

/**
 * swiper 切换时同步当前下标
 */
const onGalleryPreviewSwiperChange = (e: { detail?: { current?: number } }) => {
  const c = e.detail?.current;
  if (typeof c === "number") galleryPreview.value.current = c;
};

watch(
  () => galleryPreview.value.show,
  (open) => {
    // #ifdef H5
    if (typeof document !== "undefined") {
      document.body.style.overflow = open ? "hidden" : "";
    }
    // #endif
  }
);

/** 关闭预览并进入图库列表（当前滑动项所属分区） */
const goGalleryListFromPreview = () => {
  const { types, current } = galleryPreview.value;
  const region = types[current];
  closeGalleryPreview();
  let url = "/pages/gallery/gallery";
  if (region) {
    url += `?region=${encodeURIComponent(region)}`;
  }
  uni.navigateTo({ url });
};
</script>

<template>
  <div class="page-wrap">
    <!-- 顶部横幅 -->
    <header class="header">
      <!-- #ifdef H5 -->
      <img
        class="header-logo"
        :src="headerLogoDisplay"
        alt="logo"
        @error="onHeaderLogoError"
      />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <image
        class="header-logo header-logo--native"
        :src="headerLogoDisplay"
        mode="aspectFill"
        @error="onHeaderLogoError"
      />
      <!-- #endif -->
      <div class="header-info">
        <span class="header-title">{{ headerTitleText }}</span>
        <span v-if="headerSubtitleText" class="header-domain">{{ headerSubtitleText }}</span>
      </div>
      <!-- #ifdef H5 -->
      <img class="header-spin" :src="staticAsset('/static/tj.svg')" alt="" />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <image class="header-spin header-spin--native" :src="staticAsset('/static/tj.svg')" mode="aspectFit" />
      <!-- #endif -->
      <div class="header-home" @click="goHome">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M12 3.3l8 6V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1V9.3l8-6z"/></svg>
        <span>首页</span>
      </div>
    </header>

    <!-- 后台「页头配置」：H5 用 v-html；小程序等用 rich-text（脚本类仅 H5 生效） -->
    <!-- #ifdef H5 -->
    <div
      v-if="siteLayout.header_config"
      class="site-custom-html site-custom-html--header"
      v-html="siteLayout.header_config"
    />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view v-if="siteLayout.header_config" class="site-custom-html site-custom-html--header">
      <rich-text :nodes="siteLayout.header_config" />
    </view>
    <!-- #endif -->

    <!-- 首页轮播：有数据且首张图 load 后再显示，无数据则不占位 -->
    <section
      v-if="homeBanners.length > 0"
      class="banner-strip"
      :class="{ 'banner-strip--compact': !homeBannerImagesReady }"
      aria-label="活动轮播"
    >
      <div v-show="!homeBannerImagesReady" class="banner-offscreen-preload" aria-hidden="true">
        <!-- #ifdef H5 -->
        <img
          :src="homeBanners[0].image"
          alt=""
          decoding="async"
          @load="onHomeBannerPreloadDone"
          @error="onHomeBannerPreloadDone"
        />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <image
          :src="homeBanners[0].image"
          mode="aspectFill"
          @load="onHomeBannerPreloadDone"
          @error="onHomeBannerPreloadDone"
        />
        <!-- #endif -->
      </div>
      <div v-show="homeBannerImagesReady" class="banner-card">
        <div class="banner-viewport">
          <swiper
            class="banner-swiper"
            circular
            :autoplay="homeBanners.length > 1"
            :interval="4200"
            :duration="480"
            :indicator-dots="homeBanners.length > 1"
            indicator-color="rgba(255,255,255,0.35)"
            indicator-active-color="#ffeb3b"
          >
            <swiper-item v-for="b in homeBanners" :key="b.id" class="banner-swiper-item">
              <image
                class="banner-slide-img"
                :class="{ 'banner-slide-img--tap': !!b.url }"
                :src="b.image"
                mode="aspectFill"
                @click="onBannerTap(b)"
              />
            </swiper-item>
          </swiper>
        </div>
      </div>
    </section>

    <!-- 快捷跳转：后台「常规管理 → 快捷跳转」；无启用项则整块不展示 -->
    <template v-if="quickJumpRows.length > 0">
      <div
        v-for="(row, ri) in quickJumpRows"
        :key="ri"
        class="quick-btns"
        role="group"
        :aria-label="'快捷跳转第' + (ri + 1) + '行'"
      >
        <div
          v-for="(item, ci) in row"
          :key="item.id"
          class="qbtn"
          :class="{ active: activeQuickJumpIndex === ri * QUICK_JUMP_COLS + ci }"
          role="button"
          tabindex="0"
          @click="onQuickJumpTap(item, ri * QUICK_JUMP_COLS + ci)"
        >{{ item.title }}</div>
      </div>
    </template>

    <!-- 备用网址：后台「常规管理 → 备用网址」；无启用项则整块不展示 -->
    <section
      v-if="backupUrlPairRows.length > 0"
      class="backup-url-block"
      aria-label="备用网址"
    >
      <div class="domain-bar">
        <span class="domain-text">↓↓↓ 请大家记住新网址 ↓↓↓</span>
      </div>
      <div
        v-for="(pair, ri) in backupUrlPairRows"
        :key="ri"
        class="domain-links"
      >
        <a
          class="dlink"
          :class="{ 'dlink--muted': !pair[0].url }"
          :href="pair[0].url || undefined"
          rel="noreferrer"
          @click.prevent="pair[0].url && onBackupUrlTap(pair[0])"
        >{{ pair[0].title }}</a>
        <template v-if="pair[1]">
          <span class="dlink-sep"></span>
          <a
            class="dlink"
            :class="{ 'dlink--muted': !pair[1].url }"
            :href="pair[1].url || undefined"
            rel="noreferrer"
            @click.prevent="pair[1].url && onBackupUrlTap(pair[1])"
          >{{ pair[1].title }}</a>
        </template>
      </div>
    </section>

    <!-- 彩种 Tab + 搅珠状态（与后端返回的 code 是否齐全一致） -->
    <div class="lottery-tab-wrap">
      <div class="tab-bar" role="tablist">
        <button
          v-for="tab in (['jianada','aomen','xianggang'] as GreenTab[])"
          :key="tab"
          type="button"
          class="tab-btn"
          :class="{ active: activeGreenTab === tab }"
          @click="setGreenTab(tab)"
        >{{ tabNames[tab] }}</button>
      </div>
      <div v-if="drawingLive" class="tab-live-strip" role="status" aria-live="polite">
        <span class="tab-live-text">正在进行搅珠中</span>
      </div>
    </div>

    <!-- 主内容区（图库区块依赖此处滚动触底加载更多） -->
    <div class="main-scroll" @scroll.passive="onMainScroll">
      <Card ref="cardCanada" @refresh="handleRefresh" @drawing-live="onDrawingLive" />
      <!-- 开奖框下方：后台「开奖下方」位 lottery_below，无数据则不占位 -->
      <section
        v-if="lotteryBelowBanners.length > 0"
        class="banner-strip banner-strip--below"
        :class="{ 'banner-strip--compact': !lotteryBelowBannerImagesReady }"
        aria-label="开奖下方推荐"
      >
        <div v-show="!lotteryBelowBannerImagesReady" class="banner-offscreen-preload" aria-hidden="true">
          <!-- #ifdef H5 -->
          <img
            :src="lotteryBelowBanners[0].image"
            alt=""
            decoding="async"
            @load="onLotteryBelowBannerPreloadDone"
            @error="onLotteryBelowBannerPreloadDone"
          />
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <image
            :src="lotteryBelowBanners[0].image"
            mode="aspectFill"
            @load="onLotteryBelowBannerPreloadDone"
            @error="onLotteryBelowBannerPreloadDone"
          />
          <!-- #endif -->
        </div>
        <div v-show="lotteryBelowBannerImagesReady" class="banner-card">
          <div class="banner-viewport banner-viewport--below">
            <swiper
              class="banner-swiper banner-swiper--below"
              circular
              :autoplay="lotteryBelowBanners.length > 1"
              :interval="4200"
              :duration="480"
              :indicator-dots="lotteryBelowBanners.length > 1"
              indicator-color="rgba(255,255,255,0.35)"
              indicator-active-color="#ffeb3b"
            >
              <swiper-item
                v-for="b in lotteryBelowBanners"
                :key="b.id"
                class="banner-swiper-item"
              >
                <image
                  class="banner-slide-img banner-slide-img--below"
                  :class="{ 'banner-slide-img--tap': !!b.url }"
                  :src="b.image"
                  mode="aspectFill"
                  @click="onBannerTap(b)"
                />
              </swiper-item>
            </swiper>
          </div>
        </div>
      </section>

      <!-- 功能入口：扁平融入页面背景，无浅绿大底、无图标外圈阴影；接口返回空列表时不占位 -->
      <section
        v-if="displayNavHubItems.length > 0"
        class="nav-hub"
        aria-label="功能入口"
      >
        <div class="nav-hub-head">
          <h2 class="nav-hub-title">常用入口</h2>
        </div>
        <div class="nav-hub-grid">
          <!-- 不用原生 button：微信/H5 会给 button 默认白底+灰边+::after，scoped 也难清干净 -->
          <div
            v-for="it in displayNavHubItems"
            :key="it.id"
            class="nav-hub-cell"
            role="button"
            tabindex="0"
            @click="onNavHubTap(it)"
            @keydown.enter.prevent="onNavHubTap(it)"
            @keydown.space.prevent="onNavHubTap(it)"
          >
            <!-- H5 用原生 img，避免 uni-image 内层 div 把透明区铺成白/灰方框 -->
            <!-- #ifdef H5 -->
            <img class="nav-hub-img" :src="it.icon" :alt="it.label" />
            <!-- #endif -->
            <!-- #ifndef H5 -->
            <image class="nav-hub-img nav-hub-img--native" :src="it.icon" mode="aspectFill" />
            <!-- #endif -->
            <span class="nav-hub-label">{{ it.label }}</span>
          </div>
        </div>
      </section>

      <!-- 精选图库：午夜彩为澳门+香港各 4 条；澳门/香港为对应分区分页 -->
      <section class="home-gal-spot" aria-label="精选图库">
        <div class="home-gal-spot-head">
          <h2 class="home-gal-spot-title">精选图库</h2>
          <div
            class="home-gal-spot-more"
            role="button"
            tabindex="0"
            @click="openGalleryPage()"
            @keydown.enter.prevent="openGalleryPage()"
            @keydown.space.prevent="openGalleryPage()"
          >
            更多
          </div>
        </div>
        <div v-if="gallerySpotLoading" class="home-gal-spot-hint">加载中…</div>
        <div
          v-else-if="homeGalleryList.length === 0"
          class="home-gal-spot-hint home-gal-spot-hint--muted"
        >
          暂无图库，请在后台添加并设为已显示
        </div>
        <div v-else class="home-gal-spot-grid">
          <div
            v-for="g in homeGalleryList"
            :key="`${g.gallery_type}-${g.id}`"
            class="home-gal-card"
          >
            <div
              class="home-gal-card-img-wrap"
              role="button"
              tabindex="0"
              :aria-label="`预览大图：${g.title || '图库'}`"
              @click="onHomeGalleryPreview(g)"
              @keydown.enter.prevent="onHomeGalleryPreview(g)"
              @keydown.space.prevent="onHomeGalleryPreview(g)"
            >
              <span class="home-gal-card-tag">{{ g.regionTag }}</span>
              <!-- #ifdef H5 -->
              <img
                class="home-gal-card-img"
                :src="g.image"
                :alt="g.title || '图库'"
              />
              <!-- #endif -->
              <!-- #ifndef H5 -->
              <image
                class="home-gal-card-img home-gal-card-img--native"
                :src="g.image"
                mode="aspectFill"
              />
              <!-- #endif -->
            </div>
            <p
              class="home-gal-card-name"
              role="button"
              tabindex="0"
              @click="openGalleryPage(g)"
              @keydown.enter.prevent="openGalleryPage(g)"
              @keydown.space.prevent="openGalleryPage(g)"
            >
              {{ g.title || "未命名" }}
            </p>
          </div>
        </div>
        <div
          v-if="galleryMoreLoading"
          class="home-gal-spot-foot home-gal-spot-foot--muted"
        >
          加载更多…
        </div>
        <div
          v-else-if="
            !gallerySpotLoading &&
            !galleryMoreLoading &&
            homeGalleryList.length > 0 &&
            homeGalleryHasMore
          "
          class="home-gal-spot-foot"
        >
          下滑加载更多
        </div>
        <div
          v-else-if="
            !gallerySpotLoading &&
            !galleryMoreLoading &&
            homeGalleryList.length > 0 &&
            !homeGalleryHasMore
          "
          class="home-gal-spot-foot home-gal-spot-foot--muted"
        >
          已显示全部 {{ homeGalleryFull.length }} 条
        </div>
      </section>

      <div v-for="(html, i) in titleContents" :key="i"
           v-html="html" class="title-block" />

      <!-- 后台「页尾配置」「在线客服」 -->
      <!-- #ifdef H5 -->
      <div
        v-if="siteLayout.footer_config"
        class="site-custom-html site-custom-html--footer"
        v-html="siteLayout.footer_config"
      />
      <div
        v-if="siteLayout.customer_service"
        class="site-custom-html site-custom-html--service"
        v-html="siteLayout.customer_service"
      />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <view v-if="siteLayout.footer_config" class="site-custom-html site-custom-html--footer">
        <rich-text :nodes="siteLayout.footer_config" />
      </view>
      <view v-if="siteLayout.customer_service" class="site-custom-html site-custom-html--service">
        <rich-text :nodes="siteLayout.customer_service" />
      </view>
      <!-- #endif -->
    </div>

    <!-- 精选图库大图预览（固定层，盖住整屏） -->
    <div
      v-if="galleryPreview.show"
      class="home-gal-preview"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <div
        class="home-gal-preview__backdrop"
        @click="closeGalleryPreview"
        @touchmove.prevent
      />
      <div class="home-gal-preview__panel" @click.stop>
        <div class="home-gal-preview__toolbar">
          <button
            type="button"
            class="home-gal-preview__btn home-gal-preview__btn--ghost"
            @click="closeGalleryPreview"
          >
            关闭
          </button>
          <button
            type="button"
            class="home-gal-preview__btn home-gal-preview__btn--more"
            @click="goGalleryListFromPreview"
          >
            查看更多
          </button>
        </div>
        <swiper
          :key="galleryPreviewKey"
          class="home-gal-preview__swiper"
          :current="galleryPreview.current"
          @change="onGalleryPreviewSwiperChange"
        >
          <swiper-item
            v-for="(u, ui) in galleryPreview.urls"
            :key="`${galleryPreviewKey}-${ui}`"
            class="home-gal-preview__swiper-item"
          >
            <div class="home-gal-preview__img-wrap">
              <!-- #ifdef H5 -->
              <img class="home-gal-preview__img" :src="u" alt="预览" />
              <!-- #endif -->
              <!-- #ifndef H5 -->
              <image
                class="home-gal-preview__img home-gal-preview__img--native"
                :src="u"
                mode="aspectFit"
              />
              <!-- #endif -->
            </div>
          </swiper-item>
        </swiper>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-wrap {
  max-width: var(--max-w);
  margin: 0 auto;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: linear-gradient(90deg, var(--c-primary), #e53935);
  color: #fff;
  border-radius: 0 0 var(--radius) var(--radius);
}
.header-logo {
  width: 36px; height: 36px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.header-logo--native {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  flex-shrink: 0;
}
.header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.header-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--c-gold);
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  line-height: 1;
}
.header-domain {
  font-size: 13px;
  font-weight: 800;
  opacity: 0.95;
  line-height: 1;
}
.header-spin {
  width: 32px; height: 32px;
  object-fit: contain;
  animation: spin 2s linear infinite;
  margin-left: auto;
}
.header-spin--native {
  width: 32px;
  height: 32px;
  margin-left: auto;
  flex-shrink: 0;
  animation: spin 2s linear infinite;
}
.header-home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  cursor: pointer;
  flex-shrink: 0;
  svg { width: 18px; height: 18px; }
  span { font-size: 9px; font-weight: 700; opacity: 0.9; }
}

/* ── Banner（轮播卡片） ── */
.banner-strip--compact {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  margin: 0;
  background: transparent;
}
.banner-offscreen-preload {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}
.banner-offscreen-preload img,
.banner-offscreen-preload image {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.banner-strip {
  position: relative;
  padding: 10px 10px 6px;
  background: linear-gradient(
    180deg,
    rgba(211, 47, 47, 0.07) 0%,
    rgba(255, 213, 79, 0.04) 45%,
    transparent 100%
  );
}

.banner-card {
  position: relative;
  border-radius: 14px;
  padding: 3px;
  background: linear-gradient(
    145deg,
    #fff8e1 0%,
    #ffd54f 18%,
    var(--c-primary) 52%,
    var(--c-primary-dark) 88%,
    #5d0f0f 100%
  );
  box-shadow:
    0 14px 36px rgba(183, 28, 28, 0.22),
    0 4px 14px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.banner-viewport {
  position: relative;
  border-radius: 11px;
  overflow: hidden;
  background: linear-gradient(180deg, #2a2a2a 0%, #0d0d0d 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

/** 仅顶部淡高光 + 底部渐暗，不遮挡指示点 */
.banner-viewport::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 32%;
  pointer-events: none;
  z-index: 1;
  border-radius: 11px 11px 0 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent);
}
/** 底部轻微压暗，高度压低以免盖住指示点 */
.banner-viewport::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 22%;
  pointer-events: none;
  z-index: 1;
  border-radius: 0 0 11px 11px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.28), transparent);
}

.banner-swiper {
  width: 100%;
  height: 102px;
}

.banner-swiper-item {
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.banner-slide-img {
  width: 100%;
  height: 102px;
  display: block;
  vertical-align: top;
  transform: scale(1.001);
  transition: transform 0.35s ease, filter 0.35s ease;
}

.banner-slide-img--tap:active {
  transform: scale(0.985);
  filter: brightness(1.06);
}

/** 开奖框下方：略紧凑、与主内容留白 */
.banner-strip--below {
  padding: 6px 4px 2px;
  margin-top: 2px;
  background: linear-gradient(
    180deg,
    rgba(46, 125, 50, 0.06) 0%,
    rgba(255, 213, 79, 0.05) 40%,
    transparent 100%
  );
}
.banner-strip--below .banner-card {
  border-radius: 12px;
  padding: 2px;
  box-shadow:
    0 10px 28px rgba(46, 125, 50, 0.14),
    0 3px 10px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.banner-viewport--below {
  border-radius: 10px;
}
.banner-viewport--below::before {
  border-radius: 10px 10px 0 0;
}
.banner-viewport--below::after {
  border-radius: 0 0 10px 10px;
}
.banner-swiper--below {
  height: 88px;
}
.banner-slide-img--below {
  height: 88px;
}

/* H5 / 部分端：轮播指示点下移、略放大，更易点选 */
.banner-viewport :deep(.uni-swiper-dots) {
  bottom: 10px !important;
}
.banner-viewport :deep(.uni-swiper-dot) {
  width: 7px !important;
  height: 7px !important;
  margin: 0 4px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.banner-viewport :deep(.uni-swiper-dot-active) {
  width: 18px !important;
  border-radius: 4px !important;
  background: linear-gradient(90deg, #ffeb3b, #fff59d) !important;
  box-shadow: 0 0 10px rgba(255, 235, 59, 0.65);
}

/* ── 常用入口：无整区底色/边框；图标无阴影外圈（H5 用 img 避免 uni-image 白底方框） ── */
.nav-hub {
  margin: 10px 0 0;
  padding: 8px 6px 12px;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
}
.nav-hub-head {
  padding: 0 4px 6px;
  margin-bottom: 2px;
}
.nav-hub-title {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--c-green);
}
.nav-hub-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px 6px;
  padding-top: 4px;
}
.nav-hub-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  box-shadow: none;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease;
  min-width: 0;
  width: 100%;
  &:active {
    transform: scale(0.96);
  }
  &:focus-visible {
    outline: 2px solid rgba(46, 125, 50, 0.45);
    outline-offset: 2px;
    border-radius: 8px;
  }
}
/** 图标：纯圆形裁切，无 box-shadow（外圈阴影易被看成「多一层框」） */
.nav-hub-img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
  object-fit: cover;
  vertical-align: top;
}
/** 非 H5：uni-image 根节点 + 内层 div 透明，减轻方框感 */
.nav-hub-img--native {
  width: 44px;
  height: 44px;
}
.nav-hub :deep(uni-image.nav-hub-img--native) {
  width: 44px !important;
  height: 44px !important;
  display: block !important;
  border-radius: 50%;
  overflow: hidden;
}
.nav-hub :deep(uni-image.nav-hub-img--native > div) {
  background-color: transparent !important;
  background-size: cover !important;
  background-position: center !important;
}
.nav-hub-label {
  font-size: 10px;
  font-weight: 600;
  color: #37474f;
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
}

/* ── 首页精选图库（上图下文 · 响应式网格，风格对齐参考图库站双列卡片） ── */
.home-gal-spot {
  margin-top: 14px;
  padding: 10px 10px 16px;
  background: #f5f5f5;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.home-gal-spot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 10px;
}
.home-gal-spot-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #1b5e20;
  letter-spacing: 0.04em;
}
.home-gal-spot-more {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-green);
  padding: 4px 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  &:active {
    opacity: 0.75;
  }
  &:focus-visible {
    outline: 2px solid rgba(46, 125, 50, 0.4);
    border-radius: 6px;
  }
}
.home-gal-spot-hint {
  text-align: center;
  padding: 20px 12px;
  font-size: 13px;
  color: #555;
  &--muted {
    color: #888;
  }
}
.home-gal-spot-foot {
  text-align: center;
  padding: 12px 8px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--c-green);
  &--muted {
    color: #999;
    font-weight: 500;
  }
}
.home-gal-spot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 520px) {
  .home-gal-spot-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (min-width: 720px) {
  .home-gal-spot-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.home-gal-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eeeeee;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s ease;
}
.home-gal-card-img-wrap {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  background: #ececec;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease;
  &:active {
    transform: scale(0.98);
  }
  &:focus-visible {
    outline: 2px solid rgba(46, 125, 50, 0.45);
    outline-offset: 2px;
  }
}
.home-gal-card-tag {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 1;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(
    90deg,
    var(--c-green) 0%,
    var(--c-green-light) 100%
  );
  border-radius: 999px;
  line-height: 1.3;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.home-gal-card-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  vertical-align: top;
}
.home-gal-spot :deep(uni-image.home-gal-card-img--native) {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
}
.home-gal-spot :deep(uni-image.home-gal-card-img--native > div) {
  background-size: cover !important;
  background-position: center !important;
}
.home-gal-card-name {
  margin: 0;
  padding: 12px 10px 14px;
  font-size: 14px;
  font-weight: 600;
  color: #333333;
  text-align: center;
  line-height: 1.35;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  &:active {
    opacity: 0.82;
  }
  &:focus-visible {
    outline: 2px solid rgba(46, 125, 50, 0.45);
    outline-offset: -2px;
  }
}

/* 精选图库：全屏预览 */
.home-gal-preview {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: stretch;
  justify-content: center;
}
.home-gal-preview__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
}
.home-gal-preview__panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--max-w, 100%);
  margin: 0 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-sizing: border-box;
}
.home-gal-preview__toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  padding-top: calc(10px + env(safe-area-inset-top, 0px));
}
.home-gal-preview__btn {
  margin: 0;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}
.home-gal-preview__btn--ghost {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
.home-gal-preview__btn--more {
  background: linear-gradient(90deg, #66bb6a, var(--c-green, #2e7d32));
  color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.home-gal-preview__swiper {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 0;
}
.home-gal-preview__swiper-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.home-gal-preview__img-wrap {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px 16px;
  box-sizing: border-box;
}
/* 在可视区域内完整显示，宽度/高度不超过容器，不强行拉满宽度（避免被放大） */
.home-gal-preview__img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block;
  object-fit: contain;
  vertical-align: top;
}
.home-gal-preview :deep(uni-image.home-gal-preview__img--native) {
  max-width: 100% !important;
  max-height: 100% !important;
  width: auto !important;
  height: auto !important;
  display: block !important;
}

/* ── Quick Buttons ── */
.quick-btns {
  display: flex;
  gap: 4px;
  padding: 3px 4px;
}
.qbtn {
  flex: 1;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--c-primary);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
  &:active { background: var(--c-primary-dark); }
  &.active {
    background: var(--c-primary-dark);
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
  }
}

.backup-url-block {
  margin-bottom: 2px;
}

/* ── Domain Bar ── */
.domain-bar {
  background: linear-gradient(90deg, #1565c0, #0d47a1);
  border-radius: 6px;
  margin: 3px 4px;
  padding: 6px 0;
  text-align: center;
}
.domain-text {
  color: var(--c-gold);
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 0.5px;
}
.domain-links {
  display: flex;
  align-items: center;
  background: #ffd54f;
  border-radius: 6px;
  margin: 2px 4px;
  padding: 4px;
  gap: 0;
}
.dlink {
  flex: 1;
  text-align: center;
  color: var(--c-primary-dark);
  font-weight: 800;
  font-size: 12px;
  text-decoration: none;
  padding: 4px;
}
.dlink--muted {
  opacity: 0.65;
  pointer-events: none;
}
.dlink-sep {
  width: 4px;
  height: 18px;
  background: #fff;
  border-radius: 2px;
  flex-shrink: 0;
}

/* ── 彩种 Tab + 搅珠条 ── */
.lottery-tab-wrap {
  margin: 3px 4px;
}
.tab-bar {
  display: flex;
  gap: 6px;
  padding: 5px 6px;
  background: linear-gradient(90deg, var(--c-green) 0%, var(--c-green-light) 50%, var(--c-green) 100%);
  border-radius: 8px 8px 0 0;
}
.tab-live-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  background: linear-gradient(90deg, var(--c-green, #2e7d32), var(--c-green-light, #43a047));
  border-radius: 0 0 8px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
.tab-live-text {
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 4px;
  animation: tab-live-pulse 1.5s ease-in-out infinite;
}
@keyframes tab-live-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.tab-btn {
  flex: 1;
  padding: 7px 0;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.85);
  font-size: 14px;
  font-weight: 800;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
  &.active {
    background: #fff;
    color: var(--c-green);
    border-color: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }
  &:not(.active):active {
    background: rgba(255,255,255,0.25);
  }
}

/* ── Main Scroll ──
 * 不设 flex:1 撑满视口，避免内容短时内部出现大块空白；整页随文档滚动（与 onReachBottom / window 触底一致）
 */
.main-scroll {
  flex: 0 1 auto;
  width: 100%;
  min-height: 0;
  padding: 6px 4px;
}
.title-block {
  width: 100%;
  overflow-x: auto;
  text-align: center;
  background: var(--c-card);
  font-size: 12px;
  margin-top: 2px;
  border-radius: 4px;
}

.site-custom-html {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 1.55;
  color: var(--c-text);
  background: var(--c-card);
  border-radius: var(--radius);
  margin-top: 6px;
  padding: 10px 12px;
}
.site-custom-html--header {
  margin-top: 0;
  margin-bottom: 4px;
}
/* 页尾：通栏底栏、居中、与整页灰底一体（抵消 main-scroll 左右内边距） */
.site-custom-html--footer {
  margin-top: 16px;
  margin-bottom: 0;
  margin-left: -4px;
  margin-right: -4px;
  width: calc(100% + 8px);
  padding: 18px 14px max(22px, env(safe-area-inset-bottom, 0px));
  text-align: center;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-text-secondary);
  background: var(--c-bg);
  border-radius: 0;
  border-top: 1px solid var(--c-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.site-custom-html--footer :deep(p),
.site-custom-html--footer :deep(div) {
  margin: 0 0 0.45em;
  text-align: center;
}
.site-custom-html--footer :deep(p:last-child),
.site-custom-html--footer :deep(div:last-child) {
  margin-bottom: 0;
}
.site-custom-html--footer :deep(a) {
  color: var(--c-green);
  text-decoration: none;
}
.site-custom-html--footer :deep(a:hover) {
  text-decoration: underline;
}
/* 在线客服嵌入区：不抢页尾视觉，居中留白 */
.site-custom-html--service {
  position: relative;
  z-index: 20;
  margin-top: 0;
  margin-left: -4px;
  margin-right: -4px;
  width: calc(100% + 8px);
  padding: 12px 10px 16px;
  text-align: center;
  background: var(--c-bg);
  border-radius: 0;
  border-top: 1px dashed var(--c-border);
}
.site-custom-html--service :deep(*) {
  max-width: 100%;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>