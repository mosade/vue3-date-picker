// T-n 边缘 W~Z：跨月/跨年/闰年、今天 2026-10-12 各维度可点性、极端限制
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/limit-edge.mjs）

import dayjs from 'dayjs'
import {
  clampToLimits, periodOf, periodWithinLimits, resolveLimits,
} from '../src/utils/period.js'

const f = (d) => (d ? d.format('YYYY-MM-DD') : '-')
let bad = 0
const chk = (label, got, want) => {
  const ok = String(got) === String(want)
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(42)} ${got}${ok ? '' : `   期望 ${want}`}`)
}

console.log('=== W. T-30 跨月/跨年/闰年（今天不同时） ===')
for (const [today, min, max] of [
  ['2026-10-12', '2026-09-12', '2026-10-11'],   // 你说的这个：月初不碰，月末碰
  ['2026-11-01', '2026-10-02', '2026-10-31'],   // 今天是 1 号 -> T-1 落到上月末
  ['2027-01-05', '2026-12-06', '2027-01-04'],   // 跨自然年
  ['2026-03-01', '2026-01-30', '2026-02-28'],   // 跨 2 月，非闰年
  ['2024-03-30', '2024-02-29', '2024-03-29'],   // 跨 2 月，闰年 -> T-30 正好是 2-29
  ['2024-03-01', '2024-01-31', '2024-02-29'],   // 闰年，T-1 落在 2-29
  ['2026-01-01', '2025-12-02', '2025-12-31'],   // 元旦
]) {
  const L = resolveLimits({ earliest: 'T-30', latest: 'T-1' }, dayjs(today))
  chk(`今天 ${today}`, `${f(L.min)} ~ ${f(L.max)}`, `${min} ~ ${max}`)
}

console.log('\n=== X. 今天 2026-10-12（周一）+ T-30 ~ T-1 = 09-12 ~ 10-11：各维度哪些格子能点 ===')
const T = dayjs('2026-10-12')
const L = resolveLimits({ earliest: 'T-30', latest: 'T-1' }, T)
const canPick = (date, range) => periodWithinLimits(periodOf(dayjs(date), range), L)
for (const [label, date, range, want] of [
  ['周 2026-41（10-05~10-11，含 T-1）', '2026-10-11', 'week', true],
  ['周 2026-42（10-12~10-18，就是今天那周）', '2026-10-12', 'week', false],
  ['周 2026-39（09-28~10-04）', '2026-09-28', 'week', true],
  ['周 2026-37（09-07~09-13，只有 09-12 可用）', '2026-09-07', 'week', true],
  ['周 2026-36（08-31~09-06，全在范围外）', '2026-08-31', 'week', false],
  ['月 2026-09（部分可用）', '2026-09-01', 'month', true],
  ['月 2026-08（全在范围外）', '2026-08-01', 'month', false],
  ['月 2026-10（部分可用）', '2026-10-01', 'month', true],
  ['月 2026-11（全在范围外）', '2026-11-01', 'month', false],
  ['年 2026（部分可用）', '2026-06-01', 'year', true],
  ['年 2025（全在范围外）', '2025-06-01', 'year', false],
  ['年 2027（全在范围外）', '2027-06-01', 'year', false],
]) chk(label, canPick(date, range), want)

console.log('\n=== Y. 今天 2026-10-12 的越界夹取 ===')
for (const [input, want] of [
  ['2026-10-12', '2026-10-11'],  // 今天本身超上限
  ['2026-10-11', '2026-10-11'],  // 边界当天不动
  ['2026-09-12', '2026-09-12'],  // 下边界当天不动
  ['2026-09-11', '2026-09-12'],
  ['2026-07-20', '2026-09-12'],
  ['2027-05-05', '2026-10-11'],
]) chk(`clamp ${input}`, f(clampToLimits(input, L)), want)

console.log('\n=== Z. 极端限制 ===')
const onlyYesterday = resolveLimits({ earliest: 'T-1', latest: 'T-1' }, T)
chk('只留 T-1：可选范围', `${f(onlyYesterday.min)} ~ ${f(onlyYesterday.max)}`, '2026-10-11 ~ 2026-10-11')
chk('只留 T-1：今天不可选', periodWithinLimits(periodOf(T, 'day'), onlyYesterday), false)
chk('只留 T-1：那周还能点', periodWithinLimits(periodOf(dayjs('2026-10-11'), 'week'), onlyYesterday), true)
chk('只留 T-1：那年还能点', periodWithinLimits(periodOf(dayjs('2026-10-11'), 'year'), onlyYesterday), true)
const future = resolveLimits({ earliest: 'T', latest: 'T+7' }, T)
chk('T ~ T+7：范围', `${f(future.min)} ~ ${f(future.max)}`, '2026-10-12 ~ 2026-10-19')
chk('T ~ T+7：过去不可选', periodWithinLimits(periodOf(dayjs('2026-10-11'), 'day'), future), false)
console.log(bad === 0 ? '\n=== 全部通过 ===' : `\n=== 有 ${bad} 处失败 ===`)
