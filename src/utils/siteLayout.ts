import { ref } from 'vue';
import { getSiteLayout, type SiteLayoutPayload } from '@/api/index.ts';

const emptyLayout: SiteLayoutPayload = {
  header_logo: '',
  header_title: '',
  header_subtitle: '',
  header_config: '',
  footer_config: '',
  statistics_code: '',
  customer_service: '',
};

/** 供各页面读取（小程序端无 document 时仅能用纯展示类 HTML，脚本类需在 H5 注入） */
export const siteLayout = ref<SiteLayoutPayload>({ ...emptyLayout });

let injected = false;

/**
 * 仅 head 内可安全注入的片段（统计脚本、meta 等）
 * 页尾、客服已在各页用 v-html / rich-text 渲染，若再 append 到 document.body 会与页面内重复并错位
 */
function hasHeadInjectPayload(p: SiteLayoutPayload): boolean {
  return [p.header_config, p.statistics_code].some((s) => String(s ?? '').trim() !== '');
}

function appendHtmlFragment(parent: HTMLElement, html: string) {
  const t = html?.trim();
  if (!t) {
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = t;
  while (wrapper.firstChild) {
    const node = wrapper.firstChild;
    wrapper.removeChild(node);
    if (node.nodeName === 'SCRIPT') {
      const old = node as HTMLScriptElement;
      const s = document.createElement('script');
      for (let i = 0; i < old.attributes.length; i++) {
        const a = old.attributes[i];
        s.setAttribute(a.name, a.value);
      }
      s.textContent = old.textContent;
      parent.appendChild(s);
    } else {
      parent.appendChild(node);
    }
  }
}

/** H5：仅向 head 注入统计/页头脚本；页尾与客服仅走页面模板，避免重复与布局错乱 */
export function applySiteLayoutInject(payload: SiteLayoutPayload) {
  if (typeof document === 'undefined') {
    return;
  }
  if (!hasHeadInjectPayload(payload)) {
    return;
  }
  if (injected) {
    return;
  }
  injected = true;
  const { header_config, statistics_code } = payload;
  appendHtmlFragment(document.head, header_config);
  appendHtmlFragment(document.head, statistics_code);
}

export async function loadSiteLayout(): Promise<SiteLayoutPayload> {
  try {
    const res = await getSiteLayout();
    const data = { ...emptyLayout, ...(res.data ?? {}) };
    siteLayout.value = data;
    applySiteLayoutInject(data);
    return data;
  } catch {
    siteLayout.value = { ...emptyLayout };
    return { ...emptyLayout };
  }
}
