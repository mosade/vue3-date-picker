// 钻取口径 K~R：anchor / start / end / today 的落点与代价
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/drill.mjs）

import dayjs from 'dayjs'
import {
  anchorFor, containsDay, formatPeriod, isCoarser, parsePeriod, periodOf,
} from '../src/utils/period.js'

const TODAY = '2026-10-15'

function createMachine(initial, drillTo = 'anchor', today = TODAY) {
  let range = 'day'
  let anchor = dayjs(today)
  const period = () => periodOf(anchor, range)
  const out = () => `${range} ${formatPeriod(period(), range)} [${period().start.format('YYYY-MM-DD')}~${period().end.format('YYYY-MM-DD')}]`

  function apply(v) {
    const parsed = parsePeriod(v)
    if (!parsed) throw new Error('bad input ' + JSON.stringify(v))
    anchor = anchorFor(parsed, drillTo, anchor, v.range, dayjs(today))
    range = v.range
    return out()
  }
  function switchTo(next) {
    if (!isCoarser(next, range) && drillTo !== 'anchor') {
      anchor = anchorFor(period(), drillTo, anchor, range, dayjs(today))
    }
    range = next
    return out()
  }
  const invariant = () => containsDay(period(), anchor)
  if (initial) apply(initial)
  return { apply, switchTo, out, invariant }
}

let fails = 0
function expect(label, got, want) {
  const ok = got === want
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} ${got}${ok ? '' : `\n${' '.repeat(52)}期望 ${want}`}`)
}

console.log('=== K. 四种钻取口径：日 2026-07-20 -> 年 -> 日 ===')
for (const [mode, want] of [
  ['anchor', 'day 2026-07-20 [2026-07-20~2026-07-20]'],
  ['start', 'day 2026-01-01 [2026-01-01~2026-01-01]'],
  ['end', 'day 2026-12-31 [2026-12-31~2026-12-31]'],
  ['today', 'day 2026-10-15 [2026-10-15~2026-10-15]'],
]) {
  const m = createMachine({ range: 'day', date: '2026-07-20' }, mode)
  m.switchTo('year'); m.switchTo('day')
  expect(`${mode}: 日->年->日`, m.out(), want)
}

console.log('\n=== L. 四种口径：日 2026-07-20 -> 周 -> 日（最常见的那条链） ===')
for (const [mode, want] of [
  ['anchor', 'day 2026-07-20 [2026-07-20~2026-07-20]'],
  ['start', 'day 2026-07-20 [2026-07-20~2026-07-20]'],
  ['end', 'day 2026-07-26 [2026-07-26~2026-07-26]'],
  ['today', 'day 2026-07-26 [2026-07-26~2026-07-26]'],
]) {
  const m = createMachine({ range: 'day', date: '2026-07-20' }, mode)
  m.switchTo('week'); m.switchTo('day')
  expect(`${mode}: 日->周->日`, m.out(), want)
}

console.log('\n=== M. 四种口径：初始就是 年 2019（过去年份）-> 日 ===')
for (const [mode, want] of [
  ['anchor', 'day 2019-10-15 [2019-10-15~2019-10-15]'],
  ['start', 'day 2019-01-01 [2019-01-01~2019-01-01]'],
  ['end', 'day 2019-12-31 [2019-12-31~2019-12-31]'],
  ['today', 'day 2019-12-31 [2019-12-31~2019-12-31]'],
]) {
  const m = createMachine({ range: 'year', date: '2019' }, mode)
  m.switchTo('day')
  expect(`${mode}: 年2019->日`, m.out(), want)
}

console.log('\n=== N. 四种口径：初始就是 年 2026（含今年）-> 日 ===')
for (const [mode, want] of [
  ['anchor', 'day 2026-10-15 [2026-10-15~2026-10-15]'],
  ['start', 'day 2026-01-01 [2026-01-01~2026-01-01]'],
  ['end', 'day 2026-12-31 [2026-12-31~2026-12-31]'],
  ['today', 'day 2026-10-15 [2026-10-15~2026-10-15]'],
]) {
  const m = createMachine({ range: 'year', date: '2026' }, mode)
  m.switchTo('day')
  expect(`${mode}: 年2026->日`, m.out(), want)
}

console.log('\n=== O. 上一轮那个 bug 在四种口径下都必须修好（变粗不受口径影响） ===')
for (const mode of ['anchor', 'start', 'end', 'today']) {
  const m = createMachine({ range: 'day', date: '2027-01-01' }, mode)
  expect(`${mode}: 日 2027-01-01`, m.out(), 'day 2027-01-01 [2027-01-01~2027-01-01]')
  m.switchTo('week');  expect(`${mode}: -> 周`, m.out(), 'week 2026-53 [2026-12-28~2027-01-03]')
  m.switchTo('month'); expect(`${mode}: -> 月（必须是 2027-01）`, m.out(), 'month 2027-01 [2027-01-01~2027-01-31]')
  m.switchTo('year');  expect(`${mode}: -> 年（必须是 2027）`, m.out(), 'year 2027 [2027-01-01~2027-12-31]')
}

console.log('\n=== P. 变粗永远以锚点为准：四种口径下 日 2026-12-30 -> 周 -> 月 都必须是 2026-12 ===')
for (const mode of ['anchor', 'start', 'end', 'today']) {
  const m = createMachine({ range: 'day', date: '2026-12-30' }, mode)
  m.switchTo('week')
  expect(`${mode}: 2026-12-30 -> 周`, m.out(), 'week 2026-53 [2026-12-28~2027-01-03]')
  m.switchTo('month')
  expect(`${mode}: -> 月`, m.out(), 'month 2026-12 [2026-12-01~2026-12-31]')
}

console.log('\n=== Q. anchorFor 直接测（含边界：今天在区间外） ===')
const y2026 = periodOf(dayjs('2026-01-01'), 'year')
const y2019 = periodOf(dayjs('2019-01-01'), 'year')
const y2030 = periodOf(dayjs('2030-01-01'), 'year')
const fmt = (d) => d.format('YYYY-MM-DD')
expect('2026 年 + end', fmt(anchorFor(y2026, 'end', dayjs(TODAY), 'year', dayjs(TODAY))), '2026-12-31')
expect('2026 年 + start', fmt(anchorFor(y2026, 'start', dayjs(TODAY), 'year', dayjs(TODAY))), '2026-01-01')
expect('2026 年 + today（今天在里面）', fmt(anchorFor(y2026, 'today', dayjs(TODAY), 'year', dayjs(TODAY))), '2026-10-15')
expect('2019 年 + today（今天在未来 -> 就近端点 = 区间末）', fmt(anchorFor(y2019, 'today', dayjs(TODAY), 'year', dayjs(TODAY))), '2019-12-31')
expect('2030 年 + today（今天在过去 -> 就近端点 = 区间首）', fmt(anchorFor(y2030, 'today', dayjs(TODAY), 'year', dayjs(TODAY))), '2030-01-01')
expect('未知口径 fallback 到记忆锚点', fmt(anchorFor(y2026, 'nope', dayjs('2026-07-20'), 'year', dayjs(TODAY))), '2026-07-20')

console.log('\n=== R. 除 anchor 外，其他口径都会「丢位置」（记录下来，这是代价） ===')
for (const mode of ['start', 'end', 'today']) {
  const m = createMachine({ range: 'day', date: '2026-07-20' }, mode)
  m.switchTo('week'); m.switchTo('day')
  const back = m.out()
  console.log(`  ${mode.padEnd(6)} 日 2026-07-20 -> 周 -> 日 = ${back.split(' ')[1]}  ${back.startsWith('day 2026-07-20 ') ? '（无损）' : '（位置丢了）'}`)
}
const invFails = []
for (const mode of ['anchor', 'start', 'end', 'today']) {
  for (const a of ['2026-01-01', '2026-12-31', '2027-01-01', '2026-10-15']) {
    const m = createMachine({ range: 'day', date: a }, mode)
    for (const step of ['year', 'week', 'month', 'day']) {
      m.switchTo(step)
      if (!m.invariant()) invFails.push(`${mode} ${a} -> ${step}`)
    }
  }
}
console.log(invFails.length === 0 ? 'ok   四种口径下区间恒含锚点' : `FAIL ${invFails.join(', ')}`)
fails += invFails.length

console.log(fails === 0 ? '\n=== 全部通过 ===' : `\n=== 有 ${fails} 处失败 ===`)
