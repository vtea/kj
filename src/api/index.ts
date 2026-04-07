import axios from '@/utils/http'

// ── 原始 API 调用 ──

const _getXtlhcLast = () => axios({ url: 'api/get_xtlhc/index_last', method: 'get' });
const _getXtlhcAll  = () => axios({ url: 'api/get_xtlhc/index_all',  method: 'get' });
const _getAomenLast = () => axios({ url: 'api/get_aomen/index',       method: 'get' });
const _getAomenAll  = () => axios({ url: 'api/get_aomen/index_all',   method: 'get' });
const _getXgLast    = () => axios({ url: 'api/get_xianggang/index',     method: 'get' });
const _getXgAll     = () => axios({ url: 'api/get_xianggang/index_all', method: 'get' });

// ── 归一化封装：统一返回 { latest, list } ──

export const getLatest = {
  xtlhc: async () => {
    const { data } = await _getXtlhcLast();
    return data?.last_data;
  },
  aomen: async () => {
    const { data } = await _getAomenLast();
    return data?.last_one;
  },
  xianggang: async () => {
    const { data } = await _getXgLast();
    return data?.last_one;
  },
};

export const getAll = {
  xtlhc: async () => {
    const { data } = await _getXtlhcAll();
    return data?.last_data ?? [];
  },
  aomen: async () => {
    const { data } = await _getAomenAll();
    return data?.all_data ?? [];
  },
  xianggang: async () => {
    const { data } = await _getXgAll();
    return data?.all_data ?? [];
  },
};

// ── 兼容旧调用（逐步迁移后可删除） ──

export const getIndexLast = _getXtlhcLast;
export const getAomen     = _getAomenLast;
export const getAomenAll  = _getAomenAll;
export const getXianggangLast = _getXgLast;
export const getXianggangAll  = _getXgAll;
export const getIndexAll  = _getXtlhcAll;

/** 历史记录分页：传 offset + limit 时后端返回 { list, has_more, total } */
export type HistoryModuleKey = 'xtlhc' | 'aomen' | 'xianggang';

const _historyUrl: Record<HistoryModuleKey, string> = {
  xtlhc: 'api/get_xtlhc/index_all',
  aomen: 'api/get_aomen/index_all',
  xianggang: 'api/get_xianggang/index_all',
};

export const getHistoryPage = (module: HistoryModuleKey, offset: number, limit: number) =>
  axios({
    url: _historyUrl[module],
    method: 'get',
    params: { offset, limit },
  });

export const getMenuNames = () => axios({ url: 'api/get_menu_names/index', method: 'get' });

export const getTitle = (params: { title_num: number }) =>
  axios({ url: '/api/Title/title_1', method: 'get', params });

/**
 * 首页轮播广告（后台 position = home_carousel）
 */
export const getHomeBanners = (params?: { position?: string }) =>
  axios({ url: 'api/ad_banner/list', method: 'get', params });

/** 后台「基础配置」中的页头/页尾/统计/客服片段 */
export type SiteLayoutPayload = {
  /** 后台上传或相对路径，空则用站内默认 /static/logo.svg */
  header_logo: string;
  header_title: string;
  header_subtitle: string;
  header_config: string;
  footer_config: string;
  statistics_code: string;
  customer_service: string;
};

export const getSiteLayout = () =>
  axios({ url: 'api/common/sitelayout', method: 'get' });

/** 备用网址（首页「新网址」板块，仅 status=显示） */
export type BackupUrlItem = { id: number; title: string; url: string };

export const getBackupUrlList = () =>
  axios({ url: 'api/backup_url/list', method: 'get' });

/** 快捷跳转（首页红按钮网格，每行 5 个，后台「常规管理 → 快捷跳转」） */
export type QuickJumpItem = { id: number; title: string; url: string };

export const getQuickJumpList = () =>
  axios({ url: 'api/quick_jump/list', method: 'get' });

/** 常用入口（首页图标宫格，后台「常规管理 → 常用入口」） */
export type CommonEntranceItem = {
  id: number;
  title: string;
  image: string;
  url: string;
};

export const getCommonEntranceList = () =>
  axios({ url: 'api/common_entrance/list', method: 'get' });

/** 后台图库：澳门 / 香港 / 其他（gallery_type=sicai，可选 sicai_channel 筛选） */
export type GalleryTypeKey = 'aomen' | 'xianggang' | 'sicai';

/** 与后台 `Gallery::MAX_PAGE_LIMIT` 一致，单次列表最多 8 条 */
export const GALLERY_LIST_PAGE_MAX = 8;

export const getGalleryList = (params: {
  gallery_type: GalleryTypeKey;
  sicai_channel?: number;
  page?: number;
  limit?: number;
}) => {
  const cap = GALLERY_LIST_PAGE_MAX;
  const lim = Math.min(cap, Math.max(1, params.limit ?? cap));
  return axios({
    url: 'api/gallery/list',
    method: 'get',
    params: {
      ...params,
      page: params.page ?? 1,
      limit: lim,
    },
  });
};
