<template>
  <div class="period-picker">
    <el-radio-group v-model="rangeModel">
      <el-radio-button v-for="item in RANGES" :key="item" :value="item">
        {{ RANGE_LABELS[item] }}
      </el-radio-button>
    </el-radio-group>

    <WeekPicker v-if="range === 'week'" v-model="pickerValue" :clearable="false" />

    <el-date-picker
      v-else
      v-model="pickerValue"
      :type="PICKER_TYPE[range]"
      :format="PICKER_FORMAT[range]"
      :value-format="PERIOD_FORMAT[range]"
      :clearable="false"
    />
  </div>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import dayjs from 'dayjs'
import WeekPicker from './WeekPicker.vue'
import {
  PERIOD_FORMAT,
  RANGES,
  RANGE_LABELS,
  anchorFor,
  formatPeriod,
  isCoarser,
  periodOf,
  parsePeriod,
} from '../utils/period'

/**
 * 时间维度选择器：日 / 周 / 月 / 年 可随时切换。
 *
 *   <PeriodPicker v-model="period" />
 *   // period = { range: 'day',   date: '2026-07-20' }
 *   //        | { range: 'week',  date: '2026-30' }
 *   //        | { range: 'month', date: '2026-07' }
 *   //        | { range: 'year',  date: '2026' }
 *
 * 内部同时维护两样东西：
 *   - anchor：记忆里用户停在哪一天（唯一的真状态）
 *   - period：当前区间，始终等于「包含 anchor 的那个 range 区间」，是纯派生值
 *
 * 切换规则（这是「符合常识」的关键）：
 *   - 变粗（日 -> 周 -> 月 -> 年）：换一个「包含 anchor 的窗口」，anchor 不动。
 *     日 2026-12-30 -> 周 2026-53 -> 年 2026，锚点还在 12-30，切回日就是 12-30。
 *     ⚠️ 不要用「区间起点」去归属更粗的维度：跨年周（2026-53 起点 2026-12-28）会把
 *     2027-01-01 一路拉进 2026-12 / 2026 年，最后回到 2026-01-01，白丢一整年。
 *   - 变细（年 -> 月 -> 周 -> 日）：按 drillTo 口径定锚点，默认 'anchor' = 锚点不动，
 *     所以任意方向来回切都无损：日 2026-07-20 -> 年 -> 日 仍是 2026-07-20，
 *     日 2027-01-01 -> 周 2026-53 -> 年 2027 -> 日 仍是 2027-01-01。
 *     换成 'start' / 'end' / 'today' 则会重新落点（代价是丢掉记忆，见 anchorFor 的注释）。
 *   - 在面板里点选 / 父组件赋值：区间听传入的，锚点同样按 drillTo 口径落在新区间里
 *     （默认口径下保住「周几 / 几号 / 几月几号」，裁到月末，最后退回区间起点）。
 *     例：年视图点 2027，再切回日 -> 2027-07-20（记住月日）。
 */
const PICKER_TYPE = { day: 'date', month: 'month', year: 'year' }
const PICKER_FORMAT = { day: 'YYYY-MM-DD', month: 'YYYY 年 MM 月', year: 'YYYY 年' }

const props = defineProps({
  /**
   * 钻取口径：粗 -> 细（以及在面板里明确选一段）时，锚点落在区间的哪一天。
   *   'anchor' 记忆锚点，无损往返（默认）
   *   'start'  区间起点
   *   'end'    区间终点
   *   'today'  今天优先，今天不在区间里就就近 clamp 到端点
   */
  drillTo: { type: String, default: 'anchor' },
})

const model = defineModel({ type: Object, default: () => ({ range: 'day', date: '' }) })

const range = ref('day')
const anchor = shallowRef(dayjs())
// 当前区间永远是「包含 anchor 的那个窗口」，没有第二份状态，也就不会两边打架
const period = computed(() => periodOf(anchor.value, range.value))

function currentModel() {
  return { range: range.value, date: formatPeriod(period.value, range.value) }
}

function syncOut() {
  const next = currentModel()
  const cur = model.value
  if (cur && cur.range === next.range && cur.date === next.date) return
  model.value = next
}

/** 外部赋值 / 面板点选：区间用传入的，锚点投影进新区间。 */
function applyPeriod(input) {
  const parsed = parsePeriod(input)
  if (!parsed) {
    if (import.meta.env.DEV) {
      console.warn(`[PeriodPicker] 无法识别的取值：`, input)
    }
    return
  }
  // 先按口径定锚点，再切维度：anchor 落在新区间里，period 派生出来就等于它
  anchor.value = anchorFor(parsed, props.drillTo, anchor.value, input.range)
  range.value = input.range
  syncOut()
}

const pickerValue = computed({
  get: () => formatPeriod(period.value, range.value),
  set: (value) => {
    if (value) applyPeriod({ range: range.value, date: value })
  },
})

const rangeModel = computed({
  get: () => range.value,
  set: (next) => {
    if (next === range.value) return
    // 变细时按口径重新落点；'anchor' 口径不动锚点，所以来回切是无损的
    if (!isCoarser(next, range.value) && props.drillTo !== 'anchor') {
      anchor.value = anchorFor(period.value, props.drillTo, anchor.value, range.value)
    }
    range.value = next
    syncOut()
  },
})

watch(
  model,
  (value) => {
    if (!value || !value.range || !value.date) return
    // 自己刚写出去的值会被 watch 再收到一次，直接忽略，避免来回抖动
    const cur = currentModel()
    if (value.range === cur.range && value.date === cur.date) return
    applyPeriod(value)
  },
  { immediate: true, deep: true },
)

// 没绑 v-model 或外面给的是空值时，补一个可用的初始值
syncOut()
</script>

<style scoped>
.period-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
