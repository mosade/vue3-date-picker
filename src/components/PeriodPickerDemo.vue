<template>
  <div class="period-demo">
    <h3>时间维度选择器（日 / 周 / 月 / 年）</h3>

    <div class="drill">
      <span>T-n 限制：</span>
      <el-radio-group v-model="limitIndex" size="small">
        <el-radio-button v-for="(item, index) in limitPresets" :key="item.label" :value="index">
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
      <span class="resolved">可选范围：{{ limitText }}</span>
    </div>

    <div class="drill">
      <span>钻取口径（粗 → 细 时落在区间的哪一天）：</span>
      <el-radio-group v-model="drillTo" size="small">
        <el-radio-button v-for="item in DRILL_MODES" :key="item" :value="item">
          {{ DRILL_MODE_LABELS[item] }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <PeriodPicker
      v-model="period"
      :drill-to="drillTo"
      :earliest="limits.earliest"
      :latest="limits.latest"
    />

    <div class="presets">
      <span>程序赋值：</span>
      <el-button
        v-for="item in presets"
        :key="item.label"
        size="small"
        @click="period = { ...item.value }"
      >
        {{ item.label }}
      </el-button>
    </div>

    <div class="result">
      <p><strong>v-model：</strong>{{ JSON.stringify(period) }}</p>
      <p><strong>区间：</strong>{{ rangeText.start }} ~ {{ rangeText.end }}（{{ rangeText.days }} 天）</p>
      <p v-if="limitOn" class="tip">
        限制生效中：越界的日期在面板里点不动，外部传进来的越界值会被夹到
        {{ limitText }} 边界上。
      </p>
      <p class="tip">
        切维度只是换一个「包含锚点」的窗口，锚点不动，所以任意方向来回切都无损：<br />
        日 2026-07-20 → 年 → 日 还是 2026-07-20；日 2027-01-01 → 周 2026-53 → 年 2027 → 日 还是 2027-01-01。<br />
        换成「区间终点」口径后：年 2026 → 日 会落在 2026-12-31（今年的话是个未来日期），
        且「日 2026-07-20 → 周 → 日」会漂到周日 2026-07-26。改口径后请重新切几次维度看效果。
      </p>
    </div>

    <div v-if="trace.length" class="trace">
      <p class="trace-title">切换轨迹（最新在上）</p>
      <ul>
        <li v-for="(item, index) in trace" :key="index">{{ item }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PeriodPicker from './PeriodPicker.vue'
import {
  DRILL_MODE_LABELS,
  DRILL_MODES,
  RANGE_LABELS,
  formatPeriod,
  parsePeriod,
  resolveLimits,
} from '../utils/period'

const period = ref({ range: 'day', date: '2026-07-20' })
const drillTo = ref('anchor')

// T-n 限制：数据通常只到 T-1，这里顺便演示「最多回看 N 天」和「允许看未来」
const limitPresets = [
  { label: '不限', earliest: '', latest: '' },
  { label: '最晚 T-1', earliest: '', latest: 'T-1' },
  { label: '最近 30 天', earliest: 'T-30', latest: 'T-1' },
  { label: 'T-90 ~ T+7', earliest: 'T-90', latest: 'T+7' },
]
const limitIndex = ref(0)
const limits = computed(() => limitPresets[limitIndex.value])
const resolved = computed(() => resolveLimits(limits.value))
const limitOn = computed(() => Boolean(resolved.value.min || resolved.value.max))
const limitText = computed(() => {
  if (!limitOn.value) return '不限'
  const min = resolved.value.min ? resolved.value.min.format('YYYY-MM-DD') : '-∞'
  const max = resolved.value.max ? resolved.value.max.format('YYYY-MM-DD') : '+∞'
  return `${min} ~ ${max}（${limits.value.earliest || '不限'} ~ ${limits.value.latest || '不限'}）`
})

const presets = [
  { label: '日 2026-07-20', value: { range: 'day', date: '2026-07-20' } },
  { label: '日 2027-01-01', value: { range: 'day', date: '2027-01-01' } },
  { label: '周 2026-53', value: { range: 'week', date: '2026-53' } },
  { label: '月 2026-12', value: { range: 'month', date: '2026-12' } },
  { label: '年 2026', value: { range: 'year', date: '2026' } },
]

const rangeText = computed(() => {
  const parsed = parsePeriod(period.value)
  if (!parsed) return { start: '-', end: '-', days: 0 }
  return {
    start: parsed.start.format('YYYY-MM-DD'),
    end: parsed.end.format('YYYY-MM-DD'),
    days: parsed.end.startOf('day').diff(parsed.start.startOf('day'), 'day') + 1,
  }
})

// 轨迹只是为了把「切换时怎么算的」摊开给人看
const trace = ref([])

function describe(value) {
  const label = RANGE_LABELS[value.range] ?? value.range
  const parsed = parsePeriod(value)
  if (!parsed) return `${label} ${value.date}（无效）`
  return `${label} ${formatPeriod(parsed, value.range)} → ${rangeLabel(parsed)}`
}

function rangeLabel(parsed) {
  return `${parsed.start.format('YYYY-MM-DD')} ~ ${parsed.end.format('YYYY-MM-DD')}`
}

watch(
  period,
  (now, before) => {
    trace.value.unshift(`${describe(now)}　←　${describe(before)}`)
    if (trace.value.length > 8) trace.value.pop()
  },
  { deep: true },
)

// 首次渲染时补一条初始状态，方便对照
trace.value.unshift(`${describe(period.value)}　（初始）`)
</script>

<style scoped>
.period-demo {
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.presets {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: #909399;
  font-size: 13px;
}
.drill {
  margin-bottom: 12px;
  color: #909399;
  font-size: 13px;
}
.drill .el-radio-group {
  margin-left: 8px;
  vertical-align: middle;
}
.drill .resolved {
  margin-left: 12px;
  color: #e6a23c;
}
.result {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 6px;
  line-height: 1.8;
}
.result p {
  margin: 4px 0;
}
.tip {
  color: #909399;
  font-size: 13px;
  margin-top: 8px !important;
}
.trace {
  margin-top: 16px;
  font-size: 13px;
  color: #606266;
}
.trace-title {
  margin: 0 0 6px;
  color: #303133;
}
.trace ul {
  margin: 0;
  padding-left: 18px;
  line-height: 1.9;
}
</style>
