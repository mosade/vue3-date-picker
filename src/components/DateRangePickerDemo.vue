<template>
  <div class="range-demo">
    <h3>日期范围选择器（最大跨度 + 禁用日期）</h3>

    <div class="control-row">
      <span>最大跨度：</span>
      <el-radio-group v-model="rangeIndex" size="small">
        <el-radio-button v-for="(item, index) in rangePresets" :key="item.value" :value="index">
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div class="control-row">
      <span>禁用规则：</span>
      <el-radio-group v-model="disabledIndex" size="small">
        <el-radio-button v-for="(item, index) in disabledPresets" :key="item.label" :value="index">
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <DateRangePicker
      v-model="dates"
      :range="selectedRange"
      :disabled-date="disabledDate"
      @range-exceeded="onRangeExceeded"
    />

    <div class="presets">
      <span>程序赋值：</span>
      <el-button
        v-for="item in valuePresets"
        :key="item.label"
        size="small"
        @click="dates = [...item.value]"
      >
        {{ item.label }}
      </el-button>
    </div>

    <div class="result">
      <p><strong>v-model：</strong>{{ JSON.stringify(dates) }}</p>
      <p><strong>已选跨度：</strong>{{ selectedText }}</p>
      <p><strong>最大跨度：</strong>{{ maxRangeText }}</p>
      <p class="tip">
        第一次点选起始日后，超出「起始日 ± {{ maxRangeText }}」的日期会立刻变灰；
        外部禁用规则和跨度限制同时生效。关闭面板后会解除临时限制，下一次可以从任意日期重新开始。
      </p>
      <p v-if="lastExceeded" class="warning">
        最近一次超跨度值已裁为 {{ lastExceeded.corrected.join(' ~ ') }}。
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import DateRangePicker from './DateRangePicker.vue'
import { formatRangeSpan, parseRangeSpan } from '../utils/dateRange'

const rangePresets = [
  { label: '7 天', value: '7D' },
  { label: '30 天', value: '30D' },
  { label: '1 个月', value: '1M' },
  { label: '3 个月', value: '3M' },
]
const rangeIndex = ref(2)
const selectedRange = computed(() => rangePresets[rangeIndex.value].value)
const maxRangeText = computed(() => formatRangeSpan(parseRangeSpan(selectedRange.value)))

const disabledPresets = [
  { label: '不禁用', rule: () => false },
  {
    label: '禁用周末',
    rule: (time) => [0, 6].includes(dayjs(time).day()),
  },
  {
    label: '禁用每月 1 日',
    rule: (time) => dayjs(time).date() === 1,
  },
]
const disabledIndex = ref(0)

function disabledDate(time) {
  return disabledPresets[disabledIndex.value].rule(time)
}

const dates = ref(['2026-10-01', '2026-10-31'])
const lastExceeded = ref(null)

const valuePresets = [
  { label: '7 天：10/01 ~ 10/07', value: ['2026-10-01', '2026-10-07'] },
  { label: '30 天：09/22 ~ 10/21', value: ['2026-09-22', '2026-10-21'] },
  { label: '1 个月：10/15 ~ 11/15', value: ['2026-10-15', '2026-11-15'] },
  { label: '超跨度：08/01 ~ 10/31', value: ['2026-08-01', '2026-10-31'] },
]

const selectedText = computed(() => {
  if (!Array.isArray(dates.value) || dates.value.length !== 2) return '未选择'
  const start = dayjs(dates.value[0])
  const end = dayjs(dates.value[1])
  if (!start.isValid() || !end.isValid()) return '未选择'
  return `${start.format('YYYY-MM-DD')} ~ ${end.format('YYYY-MM-DD')}（${end.diff(start, 'day') + 1} 天）`
})

function onRangeExceeded(payload) {
  lastExceeded.value = payload
}
</script>

<style scoped>
.range-demo {
  padding: 24px;
}

.control-row {
  margin-bottom: 12px;
  color: #909399;
  font-size: 13px;
}

.control-row .el-radio-group {
  margin-left: 8px;
  vertical-align: middle;
}

.presets {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

.result p {
  margin: 4px 0;
}

.tip {
  color: #909399;
  font-size: 13px;
  margin-top: 8px !important;
}

.warning {
  color: #e6a23c;
  font-size: 13px;
}
</style>
