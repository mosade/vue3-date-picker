<template>
  <div class="date-range-picker">
    <el-date-picker
      ref="pickerRef"
      v-model="innerValue"
      class="date-range-picker__picker"
      type="daterange"
      :format="format"
      :value-format="valueFormat"
      :disabled-date="mergedDisabledDate"
      :clearable="clearable"
      :disabled="disabled"
      :editable="editable"
      :size="size"
      :start-placeholder="startPlaceholder"
      :end-placeholder="endPlaceholder"
      :range-separator="rangeSeparator"
      :unlink-panels="unlinkPanels"
      :default-value="defaultValue"
      @calendar-change="onCalendarChange"
      @visible-change="onVisibleChange"
      @change="onChange"
    />

    <div v-if="showHint && rangeHint" class="date-range-picker__hint">
      {{ rangeHint }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import dayjs from 'dayjs'
import {
  clampRangeToSpan,
  formatRangeSpan,
  getRangeBounds,
  isRangeWithinSpan,
  isWithinRangeBounds,
  parseRangeSpan,
} from '../utils/dateRange'

/**
 * 起止日期范围选择器。
 *
 *   <DateRangePicker
 *     v-model="dates"
 *     range="1M"
 *     :disabled-date="disabledDate"
 *   />
 *
 * range 是「最大跨度」而不是默认值：
 *   - 第一次点选起始日后，超出起止跨度边界的日期会立即禁用；
 *   - 界面上最多只能选到 range 指定的跨度，例如 1M / 30D / 2W；
 *   - 外部 disabled-date 与跨度限制取并集，任一规则禁用即不可选。
 */
const props = defineProps({
  /** 最大跨度：'1M' / '30D' / '2W' / '1Y'，数字表示天数，也可传 { value, unit }。 */
  range: { type: [String, Number, Object], default: '' },
  /** 外部禁用规则，参数与 Element Plus disabled-date 一致。 */
  disabledDate: { type: Function, default: undefined },
  format: { type: String, default: 'YYYY-MM-DD' },
  valueFormat: { type: String, default: 'YYYY-MM-DD' },
  clearable: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  /**
   * 默认关闭手动输入：日期范围通过面板选择，避免绕过跨度限制。
   * 打开后，超跨度输入仍会被裁到最大边界，并触发 range-exceeded。
   */
  editable: { type: Boolean, default: false },
  size: { type: String, default: undefined },
  startPlaceholder: { type: String, default: '开始日期' },
  endPlaceholder: { type: String, default: '结束日期' },
  rangeSeparator: { type: String, default: '至' },
  unlinkPanels: { type: Boolean, default: false },
  defaultValue: { type: [Date, Array], default: undefined },
  /** 第一次点选起始日后，是否在输入框下方展示本次可选窗口。 */
  showHint: { type: Boolean, default: true },
})

const emit = defineEmits(['change', 'calendar-change', 'visible-change', 'range-exceeded'])
const model = defineModel({ type: Array, default: () => [] })

const pickerRef = ref()
const selectionStart = shallowRef(null)

const span = computed(() => parseRangeSpan(props.range))
const selectionBounds = computed(() =>
  selectionStart.value ? getRangeBounds(selectionStart.value, span.value) : null,
)

const rangeHint = computed(() => {
  if (!selectionBounds.value || !span.value) return ''
  const { min, max } = selectionBounds.value
  return `已选 ${formatDay(selectionStart.value)}；本次最多 ${formatRangeSpan(span.value)}，可选 ${formatDay(min)} ~ ${formatDay(max)}`
})

function formatDay(value) {
  return dayjs(value).format('YYYY-MM-DD')
}

function normalizeRange(value) {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean).slice(0, 2)
}

function sameRange(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

function enforceSpan(value) {
  const normalized = normalizeRange(value)
  if (normalized.length !== 2 || !span.value) return normalized
  if (isRangeWithinSpan(normalized, span.value)) return normalized

  const clamped = clampRangeToSpan(normalized, span.value)
  if (!clamped) return normalized

  const corrected = clamped.map((item) => item.format(props.valueFormat))
  emit('range-exceeded', {
    value: normalized,
    corrected,
    range: span.value,
  })
  return corrected
}

const innerValue = computed({
  get: () => (Array.isArray(model.value) ? model.value : []),
  set: (value) => {
    const normalized = normalizeRange(value)
    if (!normalized.length) {
      selectionStart.value = null
      model.value = []
      return
    }
    // 范围选择只在两端都确定时写入 v-model，避免半截日期污染父组件。
    if (normalized.length === 2) model.value = enforceSpan(normalized)
  },
})

// 函数引用本身必须随起始日变化：Element Plus 只在 disabled-date prop 变化时重算日期格，
// 仅修改函数内部读取的 ref 不会触发它重新渲染。
const mergedDisabledDate = computed(() => {
  const external = props.disabledDate
  const bounds = selectionBounds.value
  return (time) => {
    if (external?.(time)) return true
    return bounds ? !isWithinRangeBounds(time, bounds) : false
  }
})

function onCalendarChange(value) {
  const [start, end] = Array.isArray(value) ? value : []
  selectionStart.value = start && !end ? dayjs(start).startOf('day') : null
  emit('calendar-change', value)
}

function onVisibleChange(visible) {
  // 关闭面板后解除临时限制，下次可以重新从任意日期开始选。
  if (!visible) selectionStart.value = null
  emit('visible-change', visible)
}

function onChange() {
  emit('change', Array.isArray(model.value) ? [...model.value] : [])
}

// 父组件直接写入超跨度初始值时也做一次兜底，保证 v-model 最终始终合法。
watch(
  model,
  (value) => {
    const normalized = normalizeRange(value)
    if (normalized.length !== 2) return
    const corrected = enforceSpan(normalized)
    if (!sameRange(normalized, corrected)) model.value = corrected
  },
  { deep: true, immediate: true },
)

// range 变小时，当前值也要同步裁到新的最大跨度。
watch(span, () => {
  const normalized = normalizeRange(model.value)
  if (normalized.length !== 2) return
  const corrected = enforceSpan(normalized)
  if (!sameRange(normalized, corrected)) model.value = corrected
})

watch(
  () => props.range,
  (value) => {
    if (!import.meta.env.DEV) return
    if (value === '' || value === null || value === undefined) return
    if (!parseRangeSpan(value)) {
      console.warn(
        `[DateRangePicker] 无法识别的 range="${value}"，已按不限制处理。支持 '1M' / '30D' / '2W' / '1Y' 或 { value: 1, unit: 'month' }。`,
      )
    }
  },
  { immediate: true },
)

defineExpose({
  focus: () => pickerRef.value?.focus(),
  handleOpen: () => pickerRef.value?.handleOpen?.(),
  handleClose: () => pickerRef.value?.handleClose?.(),
})
</script>

<style scoped>
.date-range-picker {
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100%;
}

.date-range-picker__hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
