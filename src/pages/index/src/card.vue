<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { getSx, ballBgColor } from "@/utils/zodiac";
import { openUrl } from "@/utils/common";

const emit = defineEmits<{
  refresh: [];
  /** 后端返回号码未齐（搅珠/陆续公布中）时为 true */
  "drawing-live": [live: boolean];
}>();
const listData = ref<any>({});
const typeData = ref(1);

const init = (data: any, type: number) => {
  typeData.value = type;
  listData.value = { ...data };
};

/**
 * 是否与父级同步「搅珠中」状态：有期号且 code1–7 任一空则视为后端仍在开奖流程中
 */
const syncDrawingLive = () => {
  const d = listData.value;
  emit("drawing-live", !!(d && d.expect) && openUrl(d));
};
watch(listData, syncDrawingLive, { deep: true, immediate: true });

const ballBg = ballBgColor;

/**
 * 获取第 idx 个球的生肖名
 * 优先用后台 zodiac 字段（逗号分隔，如 "羊,虎,豬,虎,馬,豬,羊"）
 * 没有 zodiac 则回退到本地 getSx 映射
 */
const getZodiacName = (idx: number, code: string) => {
  const zStr = listData.value?.zodiac;
  if (zStr && typeof zStr === 'string') {
    const arr = zStr.split(/[,，]/);
    if (arr[idx] && arr[idx].trim()) return arr[idx].trim();
  }
  return code ? getSx(code).name : "";
};

dayjs.locale("zh-cn");

const countdown = ref("--:--:--");
const isUrgent = ref(false);
let cdTimer: any = null;

const TEN_MIN = 10 * 60 * 1000;

const calcCountdown = () => {
  const t = listData.value?.nextTime;
  if (!t) { countdown.value = "--:--:--"; isUrgent.value = false; return; }
  const diff = new Date(t).getTime() - Date.now();
  if (diff <= 0) {
    countdown.value = openUrl(listData.value) ? "--:--:--" : "00:00:00";
    isUrgent.value = false;
    return;
  }
  isUrgent.value = diff <= TEN_MIN;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  countdown.value = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
};

watch(() => listData.value?.nextTime, () => calcCountdown(), { immediate: true });

onMounted(() => {
  calcCountdown();
  cdTimer = setInterval(calcCountdown, 1000);
});
onUnmounted(() => { if (cdTimer) clearInterval(cdTimer); });

const fmtNextTime = (t: string) => t ? dayjs(t).format("YYYY-MM-DD HH:mm") : "--";

const codes = ['code1','code2','code3','code4','code5','code6'];

const history = () => {
  uni.navigateTo({ url: `/pages/index/history?id=${typeData.value}` });
};

defineExpose({ init });
</script>

<template>
  <div class="kcard">
    <!-- 标题行 -->
    <div class="kcard-top">
      <div class="kcard-title">
        <b>{{ listData?.name ?? "--" }}</b>
        &nbsp;第 <span class="kperiod">{{ listData?.expect ?? "--" }}</span> 期
      </div>
      <div class="kcard-links">
        <span class="klink" @click="history">历史记录</span>
        <span class="klink" @click="emit('refresh')">刷新</span>
      </div>
    </div>

    <!-- 球区 -->
    <div class="kballs">
      <div class="kball-item" v-for="(key, idx) in codes" :key="key">
        <div class="kball" :style="{ background: listData[key] ? ballBg(listData[key]) : '#ccc' }">
          {{ listData[key] || "?" }}
        </div>
        <span class="ksx">{{ getZodiacName(idx, listData[key]) }}</span>
      </div>
      <div class="kball-plus">+</div>
      <div class="kball-item">
        <div class="kball kball-te" :style="{ background: listData.code7 ? ballBg(listData.code7) : '#ccc' }">
          {{ listData.code7 || "?" }}
        </div>
        <span class="ksx">{{ getZodiacName(6, listData.code7) }}</span>
      </div>
    </div>

    <!-- 底部信息 -->
    <!-- ≤10分钟：绿色底栏 + 数字格子 -->
    <div v-if="isUrgent" class="kcard-bottom kcard-bottom-urgent">
      <div class="knext">
        第 <b>{{ listData?.expect1 ?? "--" }}</b> 期截止：{{ fmtNextTime(listData?.nextTime) }}
      </div>
      <div class="kcd-urgent">
        <span v-for="(ch, i) in countdown.split('')" :key="i"
          :class="ch === ':' ? 'kcd-colon' : 'kcd-digit'"
        >{{ ch }}</span>
      </div>
    </div>
    <!-- 正常倒计时 -->
    <div v-else class="kcard-bottom">
      <div class="knext">
        第 <b>{{ listData?.expect1 ?? "--" }}</b> 期截止：{{ fmtNextTime(listData?.nextTime) }}
      </div>
      <div class="kcd">{{ countdown }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kcard {
  background: var(--c-card, #fff);
  border-radius: var(--radius, 10px);
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
}

.kcard-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--c-border, #eaeaea);
}
.kcard-title {
  font-size: 15px;
  color: var(--c-text, #222);
  b { font-weight: 800; }
}
.kperiod { color: var(--c-primary, #d32f2f); font-weight: 700; }
.kcard-links { display: flex; gap: 12px; flex-shrink: 0; }
.klink {
  font-size: 12px;
  color: var(--c-accent, #1565c0);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  &:active { opacity: 0.5; }
}

.kballs {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 14px 12px 12px;
}
.kball-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.kball {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 19px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  box-shadow:
    inset 0 2px 4px rgba(255,255,255,0.25),
    inset 0 -3px 5px rgba(0,0,0,0.18),
    0 2px 6px rgba(0,0,0,0.13);
}
.kball-te {
  border: 2.5px solid #e8c326;
  box-shadow:
    inset 0 2px 4px rgba(255,255,255,0.25),
    inset 0 -3px 5px rgba(0,0,0,0.18),
    0 2px 8px rgba(232,195,38,0.3);
}
.ksx {
  margin-top: 4px;
  font-size: 11px;
  color: var(--c-text-secondary, #666);
  font-weight: 700;
  line-height: 1;
}
.kball-plus {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 700;
  color: #bbb;
  padding: 0 3px;
  height: 44px;
}

.kcard-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 10px;
  border-top: 1px solid var(--c-border, #eaeaea);
}
.knext {
  font-size: 11px;
  color: var(--c-text-muted, #999);
  b { color: var(--c-primary, #d32f2f); font-weight: 700; }
}
.kcd {
  font-size: 17px;
  font-weight: 800;
  color: var(--c-accent, #1565c0);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.kcard-bottom-urgent {
  background: linear-gradient(90deg, var(--c-green, #2e7d32), var(--c-green-light, #43a047));
  border-top: none;
  padding: 8px 14px 10px;
}
.kcard-bottom-urgent .knext {
  color: rgba(255,255,255,0.9);
  b { color: #fff; }
}
.kcd-urgent { display: flex; align-items: center; gap: 3px; }
.kcd-digit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px; height: 30px;
  background: #fff;
  color: #222;
  font-size: 18px;
  font-weight: 800;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  font-variant-numeric: tabular-nums;
}
.kcd-colon {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

</style>
