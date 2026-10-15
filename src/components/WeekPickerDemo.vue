<template>
  <div class="week-picker-demo">
    <h3>Element Plus 周选择器（v-model 直接用 ISO 周字符串）</h3>

    <!-- v-model 就是 "2026-30" 这种 ISO 周字符串，选完即得，不需要再格式化 -->
    <WeekPicker v-model="weekValue" :clearable="false" />

    <div class="presets">
      <span>程序赋值：</span>
      <el-button v-for="preset in presets" :key="preset" size="small" @click="weekValue = preset">
        {{ preset }}
      </el-button>
    </div>

    <div class="result">
      <p><strong>v-model：</strong>{{ weekValue || '（空）' }}</p>
      <p><strong>周标签：</strong>{{ weekLabel || '-' }}</p>
      <p><strong>本周起始（周一）：</strong>{{ rangeText.start }}</p>
      <p><strong>本周结束（周日）：</strong>{{ rangeText.end }}</p>
      <p class="tip">
        跨年周按 ISO 8601 归属周年份：2026-53 是 2026-12-28 ~ 2027-01-03（横跨两个自然年），
        2026-01 反而是 2025-12-29 ~ 2026-01-04。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import WeekPicker from './WeekPicker.vue'
import { formatIsoWeek, isoWeekRange, ISO_WEEKDAY_CN } from '../utils/isoWeek'

// v-model 就是 ISO 周字符串，零解析、可直接存库/传参
const weekValue = ref('2026-30')

const presets = ['2026-30', '2026-53', '2027-01']

const weekLabel = computed(() => formatIsoWeek(weekValue.value))

const rangeText = computed(() => {
  const range = isoWeekRange(weekValue.value)
  if (!range) return { start: '-', end: '-' }
  return {
    start: `${range.start.format('YYYY-MM-DD')} (${ISO_WEEKDAY_CN[range.start.isoWeekday() - 1]})`,
    end: `${range.end.format('YYYY-MM-DD')} (${ISO_WEEKDAY_CN[range.end.isoWeekday() - 1]})`,
  }
})
</script>

<style scoped>
.week-picker-demo {
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.presets {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 13px;
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
