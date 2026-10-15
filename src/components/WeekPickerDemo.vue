<template>
  <div class="week-picker-demo">
    <h3>Element Plus 周选择器（跨年周修正版）</h3>

    <el-date-picker
      v-model="weekStartValue"
      type="week"
      format="GGGG 年第 WW 周"
      value-format="YYYY-MM-DD"
      :clearable="false"
      placeholder="请选择一周"
    />

    <div v-if="weekStartValue" class="result">
      <p><strong>选中的 ISO 周：</strong>{{ isoWeekText }}</p>
      <p><strong>v-model 值（该周周一）：</strong>{{ weekStartValue }}</p>
      <p><strong>本周起始（周一）：</strong>{{ rangeText.start }}</p>
      <p><strong>本周结束（周日）：</strong>{{ rangeText.end }}</p>
      <p class="tip">
        跨年周按 ISO 8601 归属周年份：2026 年第 53 周为 2026-12-28 ~ 2027-01-03，横跨两个自然年。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

// v-model 绑定值由 value-format="YYYY-MM-DD" 决定：该周的周一，例如 "2026-12-28"。
// 不要写成 "YYYY-ww"：dayjs 的 ww 是 locale 周，2026-12-28 会被格式化成 "2026-01"，
// 跨年周直接算错（GGGG / WW 才是 ISO 周年份与周数）。
const weekStartValue = ref('2026-12-28')

// ISO 周一律走 dayjs 的 isoWeek 系列（main.js 已 extend isoWeek / advancedFormat）；
// week() / ww / gggg 是 locale 周，会随 locale 的 weekStart 变化，这里不能用。
const WEEKDAY_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * 解析 ISO 周字符串为起止日期
 * 格式: "YYYY-ww"（ISO 周年份 + 两位周数）
 * 注：isoWeekYear() 只有 getter 没有 setter，不能写成 dayjs().isoWeekYear(y).isoWeek(w)，
 *     所以从"每年 1 月 4 日必定属于第 1 周"这个锚点推导。
 */
function parseISOWeek(isoWeekStr) {
  const match = isoWeekStr && isoWeekStr.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null

  const year = parseInt(match[1], 10)
  const week = parseInt(match[2], 10)

  const start = dayjs(new Date(year, 0, 4)).startOf('isoWeek').add(week - 1, 'week')
  return { start, end: start.endOf('isoWeek') }
}

const isoWeekText = computed(() => {
  const date = dayjs(weekStartValue.value)
  return date.isValid() ? date.format('GGGG-WW') : ''
})

const rangeText = computed(() => {
  // 经过 ISO 周字符串再反解，保证起始一定是周一、结束一定是周日
  const range = parseISOWeek(isoWeekText.value)
  if (!range) return { start: '-', end: '-' }
  return {
    start: `${range.start.format('YYYY-MM-DD')} (${WEEKDAY_CN[range.start.isoWeekday() - 1]})`,
    end: `${range.end.format('YYYY-MM-DD')} (${WEEKDAY_CN[range.end.isoWeekday() - 1]})`,
  }
})
</script>

<style scoped>
.week-picker-demo {
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.result {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 6px;
  line-height: 1.8;
}
.result p { margin: 4px 0; }
.tip {
  color: #909399;
  font-size: 13px;
  margin-top: 8px !important;
}
</style>
