// 维度切换 A~J：往返无损、跨年周归属、月末裁切、parse/format 往返
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/period.mjs）

import dayjs from 'dayjs'
import {
  RANGES, formatPeriod, parsePeriod, periodOf, projectDay, containsDay,
} from '../src/utils/period.js'

// ---- 把 PeriodPicker.vue 的状态机原样搬过来 ----
function createMachine(initial, today = '2026-10-15') {
  let range = 'day'
  let anchor = dayjs(today)
  const period = () => periodOf(anchor, range)

  const out = () => ({
    range,
    date: formatPeriod(period(), range),
    range_text: `${period().start.format('YYYY-MM-DD')}~${period().end.format('YYYY-MM-DD')}`,
    anchor: anchor.format('YYYY-MM-DD'),
    // 不变量：anchor 必须落在当前区间里
    invariant: containsDay(period(), anchor),
  })

  function apply(v) {
    const parsed = parsePeriod(v)
    if (!parsed) throw new Error('bad input ' + JSON.stringify(v))
    anchor = projectDay(anchor, parsed, v.range)
    range = v.range
    return out()
  }

  // 切换维度 = 换一个包含 anchor 的窗口，anchor 不动
  function switchTo(next) {
    range = next
    return out()
  }

  if (initial) apply(initial)
  return { apply, switchTo, out }
}

let fails = 0
const invariantFails = []
function expect(label, actual, expected) {
  const got = typeof actual === "string" ? actual : `${actual.range} ${actual.date} [${actual.range_text}]`
  const ok = got === expected
  if (!ok) fails++
  if (typeof actual !== "string" && !actual.invariant) invariantFails.push(label)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}\n       ${got}${ok ? '' : `\n       期望 ${expected}`}`)
}

console.log('=== A. 日 -> 年 -> 日 无损往返 ===')
let m = createMachine({ range: 'day', date: '2026-07-20' })
m.switchTo('year');  expect('日->年', m.out(), 'year 2026 [2026-01-01~2026-12-31]')
m.switchTo('day');   expect('年->日', m.out(), 'day 2026-07-20 [2026-07-20~2026-07-20]')
m.switchTo('month'); expect('日->月', m.out(), 'month 2026-07 [2026-07-01~2026-07-31]')
m.switchTo('week');  expect('月->周', m.out(), 'week 2026-30 [2026-07-20~2026-07-26]')
m.switchTo('day');   expect('周->日', m.out(), 'day 2026-07-20 [2026-07-20~2026-07-20]')

console.log('\n=== B. 在粗维度上跳到别的年份 ===')
m = createMachine({ range: 'day', date: '2026-07-20' })
m.switchTo('year'); expect('->年 2026', m.out(), 'year 2026 [2026-01-01~2026-12-31]')
m.apply({ range: 'year', date: '2027' }); expect('年视图选 2027', m.out(), 'year 2027 [2027-01-01~2027-12-31]')
m.switchTo('day');  expect('2027年->日（保住月日）', m.out(), 'day 2027-07-20 [2027-07-20~2027-07-20]')
m.switchTo('month'); expect('->月', m.out(), 'month 2027-07 [2027-07-01~2027-07-31]')

console.log('\n=== C. 跨年周（2026-53 = 2026-12-28 ~ 2027-01-03） ===')
m = createMachine({ range: 'week', date: '2026-53' })   // 锚点取 today 的周几 -> 2026-12-31（周四）
expect('周 2026-53 初始', m.out(), 'week 2026-53 [2026-12-28~2027-01-03]')
m.switchTo('month'); expect('锚点 2026-12-31 -> 月', m.out(), 'month 2026-12 [2026-12-01~2026-12-31]')
m.switchTo('year');  expect('-> 年', m.out(), 'year 2026 [2026-01-01~2026-12-31]')
m.switchTo('day');   expect('-> 日（锚点无损）', m.out(), 'day 2026-12-31 [2026-12-31~2026-12-31]')

console.log('\n--- 回归：2027-01-01 往粗切（上一版按「区间起点」归属，会一路粘在 2026） ---')
m = createMachine({ range: 'day', date: '2027-01-01' })
expect('日 2027-01-01', m.out(), 'day 2027-01-01 [2027-01-01~2027-01-01]')
m.switchTo('week');  expect('-> 周（ISO 周年份是 2026）', m.out(), 'week 2026-53 [2026-12-28~2027-01-03]')
m.switchTo('month'); expect('-> 月（必须回到 2027-01）', m.out(), 'month 2027-01 [2027-01-01~2027-01-31]')
m.switchTo('year');  expect('-> 年（必须是 2027）', m.out(), 'year 2027 [2027-01-01~2027-12-31]')
m.switchTo('day');   expect('-> 日（回到原点）', m.out(), 'day 2027-01-01 [2027-01-01~2027-01-01]')

console.log('\n--- 直接从 2027-01-01 跳粗 ---')
m = createMachine({ range: 'day', date: '2027-01-01' })
m.switchTo('year');  expect('日->年', m.out(), 'year 2027 [2027-01-01~2027-12-31]')
m.switchTo('month'); expect('年->月', m.out(), 'month 2027-01 [2027-01-01~2027-01-31]')

m = createMachine({ range: 'day', date: '2027-01-03' })
m.switchTo('week');  expect('2027-01-03 -> 周', m.out(), 'week 2026-53 [2026-12-28~2027-01-03]')
m.switchTo('day');   expect('周 -> 日（锚点在区间内，无损）', m.out(), 'day 2027-01-03 [2027-01-03~2027-01-03]')
m.switchTo('year');  expect('-> 年', m.out(), 'year 2027 [2027-01-01~2027-12-31]')

m = createMachine({ range: 'day', date: '2026-12-30' })
m.switchTo('week');  expect('2026-12-30 -> 周 2026-53', m.out(), 'week 2026-53 [2026-12-28~2027-01-03]')
m.switchTo('year');  expect('-> 年（锚点在 2026）', m.out(), 'year 2026 [2026-01-01~2026-12-31]')
m.switchTo('day');   expect('-> 日（无损）', m.out(), 'day 2026-12-30 [2026-12-30~2026-12-30]')

console.log('\n=== D. 月末 / 闰日 clamp ===')
m = createMachine({ range: 'day', date: '2026-01-31' })
m.switchTo('month'); expect('1-31 -> 月', m.out(), 'month 2026-01 [2026-01-01~2026-01-31]')
m.apply({ range: 'month', date: '2026-02' }); expect('月视图选 2 月', m.out(), 'month 2026-02 [2026-02-01~2026-02-28]')
m.switchTo('day');   expect('2 月 -> 日（31 号被裁到 28）', m.out(), 'day 2026-02-28 [2026-02-28~2026-02-28]')

m = createMachine({ range: 'day', date: '2024-02-29' })
m.switchTo('year'); expect('闰日 -> 年 2024', m.out(), 'year 2024 [2024-01-01~2024-12-31]')
m.apply({ range: 'year', date: '2025' }); expect('选 2025', m.out(), 'year 2025 [2025-01-01~2025-12-31]')
m.switchTo('day');  expect('2025 -> 日（2-29 不存在，裁到 2-28）', m.out(), 'day 2025-02-28 [2025-02-28~2025-02-28]')

console.log('\n=== E. 四种维度的 date 格式与区间 ===')
for (const [input, date, text] of [
  [{ range: 'day', date: '2026-07-20' }, '2026-07-20', '2026-07-20~2026-07-20'],
  [{ range: 'week', date: '2026-53' }, '2026-53', '2026-12-28~2027-01-03'],
  [{ range: 'month', date: '2026-12' }, '2026-12', '2026-12-01~2026-12-31'],
  [{ range: 'year', date: '2026' }, '2026', '2026-01-01~2026-12-31'],
]) {
  expect(`parse ${JSON.stringify(input)}`, createMachine(input).out(), `${input.range} ${date} [${text}]`)
}

console.log('\n=== F. 非法输入 ===')
for (const bad of [
  { range: 'year', date: '26' }, { range: 'month', date: '2026-13' }, { range: 'month', date: '2026' },
  { range: 'day', date: '2026-7-20' }, { range: 'week', date: '2027-53' }, { range: 'quarter', date: '2026' },
  { range: 'week', date: 'abc' }, null, { range: 'year', date: '' },
]) {
  const parsed = parsePeriod(bad)
  const ok = parsed === null
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} reject ${JSON.stringify(bad)} -> ${parsed ? 'parsed!' : 'null'}`)
}

console.log('\n=== G. projectDay 的四种投影 ===')
const p2027 = periodOf(dayjs('2027-01-01'), 'year')
const pFeb  = periodOf(dayjs('2026-02-01'), 'month')
const pWeek = periodOf(dayjs('2026-07-20'), 'week')
expect('anchor 在区间内 -> 原样返回', projectDay(dayjs('2026-07-20'), pWeek, 'week').format('YYYY-MM-DD'), '2026-07-20')
expect('week 保周几（周四）', projectDay(dayjs('2026-07-23'), periodOf(dayjs('2026-08-03'), 'week'), 'week').format('YYYY-MM-DD'), '2026-08-06')
expect('month 保几号', projectDay(dayjs('2026-01-15'), pFeb, 'month').format('YYYY-MM-DD'), '2026-02-15')
expect('month 月末裁切', projectDay(dayjs('2026-01-31'), pFeb, 'month').format('YYYY-MM-DD'), '2026-02-28')
expect('year 保月日', projectDay(dayjs('2026-07-20'), p2027, 'year').format('YYYY-MM-DD'), '2027-07-20')
expect('day 用区间起点', projectDay(dayjs('2026-07-20'), periodOf(dayjs('2027-05-05'), 'day'), 'day').format('YYYY-MM-DD'), '2027-05-05')

console.log('\n=== H. 每个维度 date 的 parse/format 往返 ===')
let roundFails = 0
for (let y = 2018; y <= 2032; y++) {
  for (let mo = 1; mo <= 12; mo++) {
    for (const day of [1, 15, 28]) {
      const d = dayjs(new Date(y, mo - 1, Math.min(day, new Date(y, mo, 0).getDate())))
      for (const r of RANGES) {
        const p = periodOf(d, r)
        const str = formatPeriod(p, r)
        const back = parsePeriod({ range: r, date: str })
        if (!back || back.start.format('YYYY-MM-DD') !== p.start.format('YYYY-MM-DD') || back.end.format('YYYY-MM-DD') !== p.end.format('YYYY-MM-DD')) {
          roundFails++; if (roundFails <= 10) console.log(`  FAIL ${r} ${str}`)
        }
      }
    }
  }
}
console.log(roundFails === 0 ? 'ok   2018-2032 x 4 维度 parse/format 往返一致' : `FAIL ${roundFails} 处往返不一致`)
fails += roundFails

console.log('\n=== I. 乱序来回切换的不变性（日 -> 任意粗 -> 日 必须回到同一天） ===')
const anchors = [
  '2026-01-01', '2026-01-31', '2026-02-28', '2026-07-20', '2026-12-28',
  '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04',
  '2024-02-29', '2025-12-29', '2032-12-31', '2020-12-28',
]
const routes = [
  ['year', 'day'],
  ['week', 'day'],
  ['month', 'day'],
  ['week', 'month', 'year', 'day'],
  ['year', 'week', 'day'],
  ['month', 'year', 'day'],
  ['week', 'month', 'week', 'day'],
  ['year', 'month', 'week', 'year', 'day'],
]
let routeFails = 0
for (const a of anchors) {
  for (const route of routes) {
    const mm = createMachine({ range: 'day', date: a })
    let invariantOk = mm.out().invariant
    for (const step of route) {
      mm.switchTo(step)
      invariantOk = invariantOk && mm.out().invariant
    }
    const o = mm.out()
    if (o.date !== a || !invariantOk) {
      routeFails++
      if (routeFails <= 8) console.log(`  FAIL ${a} via ${route.join('->')} -> ${o.date}（不变量 ${invariantOk ? 'ok' : '破' }）`)
    }
  }
}
console.log(routeFails === 0 ? `ok   ${anchors.length} 个锚点 x ${routes.length} 条路线，全部回到同一天且不变量成立` : `FAIL ${routeFails} 条路线不满足`)
fails += routeFails

console.log('\n=== J. 任意维度组合后 period 一定包含 anchor ===')
let invFails = 0
for (const r of RANGES) {
  for (const a of anchors) {
    const mm = createMachine({ range: 'day', date: a })
    mm.switchTo(r)
    if (!mm.out().invariant) { invFails++; console.log(`  FAIL ${a} -> ${r}`) }
  }
}
console.log(invFails === 0 ? 'ok   所有维度的区间都包含锚点' : `FAIL ${invFails} 处不包含`)
fails += invFails

console.log(fails === 0 ? '\n=== 全部通过 ===' : `\n=== 有 ${fails} 处失败 ===`)

