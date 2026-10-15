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
  formatPeriod,
  isCoarser,
  periodOf,
  parsePeriod,
  projectDay,
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
 *   - period：当前区间，决定对外吐出的 { range, date }
 *   - anchor：记忆里用户停在哪一天，只在切换维度时用来还原位置
 *
 * 切换规则（这是「符合常识」的关键）：
 *   - 变粗（日 -> 周 -> 月 -> 年）：按「当前区间从哪开始」去归属更粗的维度。
 *     例：周 2026-53 的起点是 2026-12-28，所以 -> 月 2026-12、-> 年 2026。
 *   - 变细（年 -> 月 -> 周 -> 日）：把 anchor 投影回当前区间再开窗，
 *     先在区间里找 anchor 本身，找不到就保住「周几 / 几号 / 几月几号」，最后退回区间起点。
 *     例：日 2026-07-20 -> 年 -> 日，仍然是 2026-07-20（无损往返）。
 *   - 在面板里点选 / 父组件赋值：区间听传入的，anchor 投影进新区间。
 *     例：年视图点 2027，再切回日 -> 2027-07-20（记住月日）。
 */
const PICKER_TYPE = { day: 'date', month: 'month', year: 'year' }
const PICKER_FORMAT = { day: 'YYYY-MM-DD', month: 'YYYY 年 MM 月', year: 'YYYY 年' }

const model = defineModel({ type: Object, default: () => ({ range: 'day', date: '' }) })

const range = ref('day')
const anchor = shallowRef(dayjs())
const period = shallowRef(periodOf(anchor.value, 'day'))

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
  range.value = input.range
  period.value = parsed
  anchor.value = projectDay(anchor.value, parsed, input.range)
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

    if (isCoarser(next, range.value)) {
      // 变粗：用当前区间的起点去归属更粗的维度；anchor 留在原处，等变细时再投影
      period.value = periodOf(period.value.start, next)
    } else {
      // 变细：先把 anchor 投影回当前区间，再开窗
      const day = projectDay(anchor.value, period.value, range.value)
      anchor.value = day
      period.value = periodOf(day, next)
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
