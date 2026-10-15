<template>
  <el-date-picker
    v-model="innerValue"
    type="week"
    :format="displayFormat"
    value-format="YYYY-MM-DD"
    :clearable="clearable"
    :disabled="disabled"
    :size="size"
    :disabled-date="disabledDate"
    :placeholder="placeholder"
    @change="onChange"
  />
</template>

<script setup>
import { computed, watch } from 'vue'
import {
  ISO_WEEK_DISPLAY_FORMAT,
  isoWeekRange,
  normalizeIsoWeek,
} from '../utils/isoWeek'

/**
 * 周选择器：v-model 直接就是 ISO 周字符串。
 *
 *   <WeekPicker v-model="week" />   // week === "2026-30" / "2026-53"
 *
 * 桥接原理：Element Plus 的 week 面板只会吐「某一天」（配 value-format="YYYY-MM-DD"
 * 时是该周的某一天），而它的 value-format 一旦写成 ISO token（GGGG / WW）就会在跨年周
 * 上算错。所以这里对内用日期、对外用 ISO 周字符串，换算全部交给 utils/isoWeek。
 */
defineProps({
  /** 输入框里的展示格式，默认 "GGGG 年第 WW 周"。 */
  displayFormat: { type: String, default: ISO_WEEK_DISPLAY_FORMAT },
  clearable: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: undefined },
  /** 透传给 el-date-picker 的禁用规则，按天判断；整周都在范围外时这一周点不动。 */
  disabledDate: { type: Function, default: undefined },
  placeholder: { type: String, default: '请选择一周' },
})

const emit = defineEmits(['change'])

const model = defineModel({ type: String, default: '' })

const innerValue = computed({
  // "2026-53" → "2026-12-28"（该周周一，交给 Element Plus）
  get: () => isoWeekRange(model.value)?.start.format('YYYY-MM-DD') ?? '',
  // "2026-12-28" → "2026-53"：不管 Element Plus 吐的是这一周里的哪一天，都能归一化
  set: (value) => {
    model.value = value ? normalizeIsoWeek(value) : ''
  },
})

function onChange(value) {
  emit('change', value ? normalizeIsoWeek(value) : '')
}

// 父组件传了识别不了的值时给个提示，否则面板会静默变空，排查起来很费劲
if (import.meta.env.DEV) {
  watch(
    model,
    (value) => {
      if (value && !normalizeIsoWeek(value)) {
        console.warn(`[WeekPicker] 无法识别的 ISO 周："${value}"，期望 "YYYY-WW"，例如 "2026-30"`)
      }
    },
    { immediate: true },
  )
}
</script>
