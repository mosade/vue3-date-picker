// DateRangePicker 的跨度 DP：解析 range、计算边界、判定、裁剪
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/date-range.mjs）

import dayjs from 'dayjs'
import {
  clampRangeToSpan,
  formatRangeSpan,
  getRangeBounds,
  isRangeWithinSpan,
  isWithinRangeBounds,
  parseRangeSpan,
} from '../src/utils/dateRange.js'

const f = (value) => (value ? dayjs(value).format('YYYY-MM-DD') : String(value))
let fails = 0

function expect(label, got, want) {
  const ok = String(got) === String(want)
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(52)} ${got}${ok ? '' : `   期望 ${want}`}`)
}

function expectSpan(label, got, amount, unit) {
  expect(label, got ? `${got.amount}/${got.unit}` : 'null', `${amount}/${unit}`)
}

console.log('=== DA. range 解析 ===')
expectSpan("parseRangeSpan('1M')", parseRangeSpan('1M'), 1, 'month')
expectSpan("parseRangeSpan('1m')", parseRangeSpan('1m'), 1, 'month')
expectSpan("parseRangeSpan('month')", parseRangeSpan('month'), 1, 'month')
expectSpan("parseRangeSpan('30D')", parseRangeSpan('30D'), 30, 'day')
expectSpan("parseRangeSpan('2 W')", parseRangeSpan('2 W'), 2, 'week')
expectSpan("parseRangeSpan('1year')", parseRangeSpan('1year'), 1, 'year')
expectSpan('parseRangeSpan(30)', parseRangeSpan(30), 30, 'day')
expectSpan(
  'parseRangeSpan({ value: 3, unit: "month" })',
  parseRangeSpan({ value: 3, unit: 'month' }),
  3,
  'month',
)
for (const input of ['', null, undefined, 0, -1, 1.5, 'abc', '1Q', {}, []]) {
  expect(`拒绝 ${JSON.stringify(input)}`, parseRangeSpan(input) === null, true)
}

console.log('\n=== DB. 边界按自然日历计算 ===')
for (const [start, unit, amount, min, max] of [
  ['2026-01-31', 'month', 1, '2025-12-31', '2026-02-28'],
  ['2024-01-31', 'month', 1, '2023-12-31', '2024-02-29'],
  ['2026-06-15', 'month', 1, '2026-05-15', '2026-07-15'],
  ['2026-10-21', 'day', 30, '2026-09-21', '2026-11-20'],
  ['2026-10-21', 'week', 2, '2026-10-07', '2026-11-04'],
  ['2026-10-21', 'year', 1, '2025-10-21', '2027-10-21'],
]) {
  const bounds = getRangeBounds(start, { amount, unit })
  expect(
    `${start} + ${amount}${unit}`,
    `${f(bounds.min)} ~ ${f(bounds.max)}`,
    `${min} ~ ${max}`,
  )
}

console.log('\n=== DC. 日期与起止区间判定 ===')
const june = getRangeBounds('2026-06-15', { amount: 1, unit: 'month' })
expect('下边界当天可选', isWithinRangeBounds('2026-05-15', june), true)
expect('下边界前一天不可选', isWithinRangeBounds('2026-05-14', june), false)
expect('上边界当天可选', isWithinRangeBounds('2026-07-15', june), true)
expect('上边界后一天不可选', isWithinRangeBounds('2026-07-16', june), false)
expect('区间正好 1M', isRangeWithinSpan(['2026-06-15', '2026-07-15'], { amount: 1, unit: 'month' }), true)
expect('区间超过 1M', isRangeWithinSpan(['2026-06-15', '2026-07-16'], { amount: 1, unit: 'month' }), false)
expect('逆序也按首尾判断', isRangeWithinSpan(['2026-07-15', '2026-06-15'], { amount: 1, unit: 'month' }), true)
expect('不限制时任意完整区间可用', isRangeWithinSpan(['1999-01-01', '2099-12-31'], null), true)
expect('不限制时非法日期仍无效', isRangeWithinSpan(['abc', '2026-06-15'], null), false)
expect('半截区间无效', isRangeWithinSpan(['2026-06-15'], { amount: 1, unit: 'month' }), false)

console.log('\n=== DD. 超跨度兜底裁剪 ===')
for (const [input, want] of [
  [['2026-06-15', '2026-07-16'], '2026-06-15 ~ 2026-07-15'],
  [['2026-07-16', '2026-06-15'], '2026-06-15 ~ 2026-07-15'],
  [['2026-01-31', '2026-03-15'], '2026-01-31 ~ 2026-02-28'],
  [['2026-06-01', '2026-06-30'], '2026-06-01 ~ 2026-06-30'],
]) {
  const got = clampRangeToSpan(input, { amount: 1, unit: 'month' })
  expect(`裁剪 ${input.join(' ~ ')}`, got ? `${f(got[0])} ~ ${f(got[1])}` : '-', want)
}

expect('跨度文案', formatRangeSpan({ amount: 1, unit: 'month' }), '1 个月')

console.log('\n=== DE. 边界属性检查 ===')
let attrFails = 0
for (const unit of ['day', 'week', 'month', 'year']) {
  for (let offset = 0; offset < 500; offset += 7) {
    const start = dayjs('2024-01-01').add(offset, 'day')
    const span = { amount: 2, unit }
    const bounds = getRangeBounds(start, span)
    if (!bounds.min.isValid() || !bounds.max.isValid()) attrFails++
    if (!isRangeWithinSpan([start, bounds.max], span)) attrFails++
    if (!isRangeWithinSpan([bounds.min, start], span)) attrFails++
    if (isRangeWithinSpan([start, bounds.max.add(1, 'day')], span)) attrFails++
    const clamped = clampRangeToSpan([start, bounds.max.add(30, 'day')], span)
    if (!clamped || !clamped[1].isSame(bounds.max, 'day')) attrFails++
  }
}
expect('随机起点边界 / 正逆序 / 裁剪', attrFails, 0)

console.log(fails === 0 ? '\n=== 全部通过 ===' : `\n=== 有 ${fails} 处失败 ===`)
