<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { loadSiteLayout } from "@/utils/siteLayout";

onLaunch(() => {
  loadSiteLayout();
});
onShow(() => {});
onHide(() => {});
</script>
<style lang="scss">
@import "./styles/vars.scss";

page {
  background: var(--c-bg);
  font-family: var(--font);
  color: var(--c-text);
  -webkit-font-smoothing: antialiased;
}
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
</style>
