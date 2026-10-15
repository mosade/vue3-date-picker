<template>
  <div class="period-picker">
    <el-radio-group v-model="rangeModel">
      <el-radio-button v-for="item in RANGES" :key="item" :value="item">
        {{ RANGE_LABELS[item] }}
      </el-radio-button>
    </el-radio-group>

    <WeekPicker
      v-if="range === 'week'"
      v-model="pickerValue"
      :clearable="false"
      :disabled-date="disabledDate"
    />

    <el-date-picker
      v-else
      v-model="pickerValue"
      :type="PICKER_TYPE[range]"
      :format="PICKER_FORMAT[range]"
      :value-format="PERIOD_FORMAT[range]"
      :disabled-date="disabledDate"
      :clearable="false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import dayjs from 'dayjs'
import WeekPicker from './WeekPicker.vue'
import {
  PERIOD_FORMAT,
  RANGES,
  RANGE_LABELS,
  anchorFor,
  clampToLimits,
  formatPeriod,
  isCoarser,
  periodOf,
  parsePeriod,
  resolveLimits,
  withinLimits,
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
 *
 * T-n 限制（earliest / latest）三条语义：
 *   - 面板**按天**禁用：整周 / 整月 / 整年全在范围外才点不动，只有部分可用仍然可点
 *     （所以「含 T-1 的那一周」永远可点，而今天所在的那一周可能整周都点不动 ——
 *     例如 latest="T-1" 且今天正好是周一）；
 *   - 夹取只作用于锚点，而且是**单向**的：放开限制不会弹回被挤掉的那个原值；
 *   - 「今天」在跨零点时会自动重算，不会一直停在打开页面那天的口径上。
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
  /**
   * T-n 限制：可选范围的最小/最大日期，含端点。空字符串 = 不限制。
   *   'T' 今天 / 'T-1' 昨天 / 'T+7' 七天后 / -30 相对天数 / '2026-01-01' 绝对日期
   * 例：数据只到昨天、最多回看 90 天 -> earliest="T-90" latest="T-1"
   */
  earliest: { type: [String, Number], default: '' },
  latest: { type: [String, Number], default: '' },
  /** 覆盖「今天」，便于测试或对接服务端日期；不传用本机当前时间。 */
  today: { type: [String, Date], default: undefined },
})

const model = defineModel({ type: Object, default: () => ({ range: 'day', date: '' }) })

const range = ref('day')
const anchor = shallowRef(dayjs())
// 当前区间永远是「包含 anchor 的那个窗口」，没有第二份状态，也就不会两边打架
const period = computed(() => periodOf(anchor.value, range.value))

/**
 * 页面开着过夜时，T-1 / T-30 这类相对限制必须自己醒一次。
 * computed 只认响应式依赖，直接写 dayjs() 是取不到新日期的：它会一直停在打开页面那天，
 * 于是「数据只到 T-1」在零点之后还允许选到昨天之前。用 dayTick 在跨零点时踢一脚。
 */
const dayTick = ref(0)
let dayTimer

function scheduleDayTick() {
  const start = dayjs()
  const nextMidnight = start.add(1, 'day').startOf('day').add(1, 'second')
  // setTimeout 超过 2^31-1 ms 会溢出，先夹一下（一天远小于它，这里只是保险）
  dayTimer = setTimeout(() => {
    dayTick.value += 1
    scheduleDayTick()
  }, Math.min(nextMidnight.diff(start), 2 ** 31 - 1))
}

onMounted(() => {
  if (!props.today) scheduleDayTick()
})
onUnmounted(() => clearTimeout(dayTimer))

const now = computed(() => {
  if (props.today) return dayjs(props.today)
  dayTick.value // 跨零点触发重算
  return dayjs()
})
const limits = computed(() =>
  resolveLimits({ earliest: props.earliest, latest: props.latest }, now.value),
)
/** 有没有真的配了限制（两端都空就不限制，也就不做任何 clamp / disable）。 */
const limitOn = computed(() => Boolean(limits.value.min || limits.value.max))

/** 面板里按天禁用：整周/整月/整年都在范围外时 Element Plus 会自动把那一格禁掉。 */
function disabledDate(time) {
  return !withinLimits(dayjs(time), limits.value)
}

/** 锚点必须落在可选范围内，否则派生出来的区间可能是选不到的。 */
function withLimits(day) {
  return clampToLimits(day, limits.value)
}

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
  // 先按口径定锚点，再按限制裁剪，最后切维度：anchor 落在新区间里，period 派生出来就等于它
  anchor.value = withLimits(anchorFor(parsed, props.drillTo, anchor.value, input.range))
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
      anchor.value = withLimits(anchorFor(period.value, props.drillTo, anchor.value, range.value))
    }
    range.value = next
    syncOut()
  },
})

/** 限制变化（或被父组件改写）时，把锚点拉回可选范围。 */
function applyLimits() {
  if (!limitOn.value) return
  const clamped = withLimits(anchor.value)
  if (!clamped.isSame(anchor.value)) {
    anchor.value = clamped
    syncOut()
  }
}

// 限制值写错时别静默当成「不限制」，否则会以为是组件没生效
function warnBadLimit(name, raw, parsed) {
  if (!import.meta.env.DEV || raw === '' || raw === null || raw === undefined) return
  if (!parsed) {
    console.warn(
      `[PeriodPicker] ${name}="${raw}" 无法识别，已忽略。支持 'T' / 'T-1' / 'T+7' / -30 / '2026-01-01'。`,
    )
  }
}

// 只在参数本身变化时报警，避免跨零点重算时重复刷屏
watch(
  [() => props.earliest, () => props.latest],
  () => {
    warnBadLimit('earliest', props.earliest, limits.value.min)
    warnBadLimit('latest', props.latest, limits.value.max)
  },
  { immediate: true },
)

// limits 依赖 earliest / latest / today；今天跨零点换天后它会重算，锚点跟着回到新范围内
watch(limits, applyLimits)

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
// 顺便把「本来就配了限制、但传进来的值越界」的情况拉回范围内
applyLimits()
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
