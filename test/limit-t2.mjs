// T-2 场景（AG~AK）+ 2027-01-02 跨年（AM）+ T-n 的通用规律（AL）：数据滞后 n 天时，各维度从哪一天起才「有得点」
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/limit-t2.mjs）

import dayjs from 'dayjs'
import { formatIsoWeek, isoWeekRange, normalizeIsoWeek } from '../src/utils/isoWeek.js'
import { periodOf, periodWithinLimits, resolveLimits, withinLimits } from '../src/utils/period.js'

const f = (d) => (d ? d.format('YYYY-MM-DD') : '-')
const wd = (d) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(d).day()]
let bad = 0
const chk = (label, got, want) => {
  const ok = String(got) === String(want)
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} ${got}${ok ? '' : `   期望 ${want}`}`)
}

console.log('=== AG. T-2 口径解析（跨月 / 跨年 / 闰日） ===')
for (const [today, want] of [
  ['2026-10-12', '2026-10-10'],
  ['2026-11-02', '2026-10-31'],
  ['2026-03-02', '2026-02-28'],
  ['2024-03-02', '2024-02-29'],
  ['2027-01-02', '2026-12-31'],
  ['2027-01-03', '2027-01-01'],
]) {
  chk(`今天 ${today} → T-2`, f(resolveLimits({ earliest: '', latest: 'T-2' }, dayjs(today)).max), want)
}
{
  const ref = (today, n) => {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + n)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  let diff = 0
  for (let i = 0; i < 400; i++) {
    const day = dayjs('2026-01-01').add(i, 'day').format('YYYY-MM-DD')
    if (f(resolveLimits({ earliest: '', latest: 'T-2' }, dayjs(day)).max) !== ref(day, -2)) diff++
  }
  chk('400 天 对拍 Date 参考实现', diff, 0)
}

console.log('\n=== AH. 2026-10-12 那一周逐天：latest="T-2" 时本周什么时候才有得点 ===')
{
  const iso = (d) => formatIsoWeek(dayjs(d), 'GGGG-WW')
  for (const d of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']) {
    const today = dayjs(d)
    const L = resolveLimits({ earliest: '', latest: 'T-2' }, today)
    const week = periodOf(today, 'week')
    let avail = 0
    for (let k = 0; k < 7; k++) if (withinLimits(week.start.add(k, 'day'), L)) avail++
    console.log(
      `     ${d}（${wd(today)}）T-2=${f(L.max)} → 周 ${iso(d)} 可用 ${avail}/7 天 → 可点：${periodWithinLimits(week, L)}`,
    )
  }
  console.log('  对照（同一周，限制不同）：')
  for (const d of ['2026-10-12', '2026-10-13']) {
    const today = dayjs(d)
    const line = ['T-2', 'T-1', 'T'].map((latest) => {
      const L = resolveLimits({ earliest: '', latest }, today)
      const week = periodOf(today, 'week')
      let avail = 0
      for (let k = 0; k < 7; k++) if (withinLimits(week.start.add(k, 'day'), L)) avail++
      return `${latest}=${avail}/7`
    })
    console.log(`     ${d}（${wd(today)}）  ${line.join('   ')}`)
  }
}

console.log('\n=== AI. T-2 落到上一周 / 上个月 / 上一年时的边界 ===')
{
  const tue = dayjs('2026-10-13')
  const LTue = resolveLimits({ earliest: '', latest: 'T-2' }, tue)
  chk('周二 2026-10-13 的上限（= 上周日）', f(LTue.max), '2026-10-11')
  chk('周 2026-41 完全可用', periodWithinLimits(periodOf(dayjs('2026-10-05'), 'week'), LTue), true)
  chk('周 2026-42（本周）不可点', periodWithinLimits(periodOf(tue, 'week'), LTue), false)

  const first = dayjs('2026-10-01')
  const LFirst = resolveLimits({ earliest: '', latest: 'T-2' }, first)
  chk('2026-10-01 的上限（= 上月 29 号）', f(LFirst.max), '2026-09-29')
  chk('月 2026-10 整月不可点', periodWithinLimits(periodOf(first, 'month'), LFirst), false)
  chk('月 2026-09 可点（09-29、09-30）', periodWithinLimits(periodOf(dayjs('2026-09-01'), 'month'), LFirst), true)
  chk('年 2026 可点', periodWithinLimits(periodOf(first, 'year'), LFirst), true)

  const newYear = dayjs('2027-01-01')
  const LNY = resolveLimits({ earliest: '', latest: 'T-2' }, newYear)
  chk('2027-01-01 的上限（= 去年 12-30）', f(LNY.max), '2026-12-30')
  chk('年 2027 不可点（当年一天都没数据）', periodWithinLimits(periodOf(newYear, 'year'), LNY), false)
  chk('年 2026 可点', periodWithinLimits(periodOf(dayjs('2026-06-01'), 'year'), LNY), true)

  const jan5 = dayjs('2027-01-05')
  const LJan = resolveLimits({ earliest: '', latest: 'T-2' }, jan5)
  chk('2027-01-05 的上限', f(LJan.max), '2027-01-03')
  chk('上限 2027-01-03 的 ISO 周（跨年周）', normalizeIsoWeek('2027-01-03'), '2026-53')
  chk('周 2026-53（2026-12-28 ~ 2027-01-03）完全可用', periodWithinLimits(isoWeekRange('2026-53'), LJan), true)
  chk('周 2027-01（01-04 ~ 01-10）不可点', periodWithinLimits(isoWeekRange('2027-01'), LJan), false)
  chk('年 2027 可点（01-01 ~ 01-03 有数据）', periodWithinLimits(periodOf(jan5, 'year'), LJan), true)
}

console.log('\n=== AJ. 只留 T-2（earliest = latest = "T-2"） ===')
{
  const t = dayjs('2026-10-12')
  const L = resolveLimits({ earliest: 'T-2', latest: 'T-2' }, t)
  chk('可选范围只剩前天', `${f(L.min)} ~ ${f(L.max)}`, '2026-10-10 ~ 2026-10-10')
  chk('今天不可选', withinLimits(t, L), false)
  chk('昨天不可选', withinLimits(t.subtract(1, 'day'), L), false)
  chk('前天可选', withinLimits(t.subtract(2, 'day'), L), true)
  chk('前天那周（2026-41）可点', periodWithinLimits(periodOf(dayjs('2026-10-10'), 'week'), L), true)
  chk('今天那周（2026-42）不可点', periodWithinLimits(periodOf(t, 'week'), L), false)
  chk('前天所在的月 2026-10 可点', periodWithinLimits(periodOf(t, 'month'), L), true)
  chk('前天所在的年 2026 可点', periodWithinLimits(periodOf(t, 'year'), L), true)
}

console.log('\n=== AK. T-2 + 「最近 N 天」组合：earliest="T-32" latest="T-2"（30 天窗口） ===')
{
  const t = dayjs('2026-10-12')
  const L = resolveLimits({ earliest: 'T-32', latest: 'T-2' }, t)
  chk('窗口', `${f(L.min)} ~ ${f(L.max)}`, '2026-09-10 ~ 2026-10-10')
  chk('窗口宽度（含端点）', L.max.diff(L.min, 'day') + 1, 31)
  chk('下限 2026-09-10 落在周中（周四）', wd(L.min), '周四')
  chk('周 2026-36（08-31 ~ 09-06）不可点', periodWithinLimits(periodOf(dayjs('2026-09-02'), 'week'), L), false)
  chk('周 2026-37（09-07 ~ 09-13）可点（09-10 起）', periodWithinLimits(periodOf(dayjs('2026-09-07'), 'week'), L), true)
  chk('周 2026-41（10-05 ~ 10-11）可点（到 10-10）', periodWithinLimits(periodOf(dayjs('2026-10-05'), 'week'), L), true)
  chk('周 2026-42（本周）不可点', periodWithinLimits(periodOf(t, 'week'), L), false)
}

console.log('\n=== AM. 今天 2027-01-02（周六，跨年后第二天）：T-1 与 T-2 的差别 ===')
{
  const t = dayjs('2027-01-02')
  chk('2027-01-02 是', wd(t), '周六')
  chk('它的 ISO 周（跨年周）', normalizeIsoWeek(t), '2026-53')

  // T-1：上限 = 2027-01-01（元旦当天）
  const L1 = resolveLimits({ earliest: '', latest: 'T-1' }, t)
  chk('T-1 上限', f(L1.max), '2027-01-01')
  chk('T-1：周 2026-53 可点（12-28 ~ 01-01 共 5/7 天）', periodWithinLimits(isoWeekRange('2026-53'), L1), true)
  chk('T-1：年 2027 可点（只有元旦一天有数据）', periodWithinLimits(periodOf(t, 'year'), L1), true)
  chk('T-1：月 2027-01 可点（只有 01-01）', periodWithinLimits(periodOf(t, 'month'), L1), true)

  // T-2：上限 = 2026-12-31（退回上一个自然年）
  const L2 = resolveLimits({ earliest: '', latest: 'T-2' }, t)
  chk('T-2 上限', f(L2.max), '2026-12-31')
  chk('T-2 上限的 ISO 周（还在跨年周里）', normalizeIsoWeek('2026-12-31'), '2026-53')
  chk('T-2：周 2026-53 可点（12-28 ~ 12-31 共 4/7 天）', periodWithinLimits(isoWeekRange('2026-53'), L2), true)
  chk('T-2：周 2027-01（01-04 ~ 01-10）不可点', periodWithinLimits(isoWeekRange('2027-01'), L2), false)
  chk('T-2：年 2027 整年不可点（一天数据都没有）', periodWithinLimits(periodOf(t, 'year'), L2), false)
  chk('T-2：月 2027-01 整月不可点', periodWithinLimits(periodOf(t, 'month'), L2), false)
  chk('T-2：年 2026 仍然可点', periodWithinLimits(periodOf(dayjs('2026-12-31'), 'year'), L2), true)
  chk('T-2：月 2026-12 仍然可点（到 12-31）', periodWithinLimits(periodOf(dayjs('2026-12-01'), 'month'), L2), true)
  // 同一周里「部分可用」的两种表现：4/7 可点，且落点会夹到上限
  const week = isoWeekRange('2026-53')
  let avail = 0
  for (let k = 0; k < 7; k++) if (withinLimits(week.start.add(k, 'day'), L2)) avail++
  chk('T-2：周 2026-53 的可用天数', avail, 4)
}

console.log('\n=== AL. 通用规律：latest="T-n" 时，各维度从哪一天起才「有得点」 ===')
console.log('   （周：今天是一周的第几天；月：几号；年：一年中的第几天。都是「第一个有数据的那天」）')
{
  const NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    // 周：从 2026-10-12（周一）起逐天试，找本周第一个可点的
    let first = null
    for (let i = 0; i < 7; i++) {
      const today = dayjs('2026-10-12').add(i, 'day')
      if (periodWithinLimits(periodOf(today, 'week'), resolveLimits({ earliest: '', latest: `T-${n}` }, today))) {
        first = i
        break
      }
    }
    chk(`T-${n}：本周可点 ⟸ 今天是`, first === null ? '永远不可点' : NAMES[first], n <= 6 ? NAMES[n] : '永远不可点')
  }
  console.log('   —')
  for (const n of [1, 2, 3, 5, 10, 30, 31]) {
    // 月：2026-10 有 31 天
    let first = null
    for (let i = 0; i < 31; i++) {
      const today = dayjs('2026-10-01').add(i, 'day')
      if (periodWithinLimits(periodOf(today, 'month'), resolveLimits({ earliest: '', latest: `T-${n}` }, today))) {
        first = i + 1
        break
      }
    }
    chk(`T-${n}：当月可点 ⟸ 今天是`, first === null ? '永远不可点' : `${first} 号`, n + 1 <= 31 ? `${n + 1} 号` : '永远不可点')
  }
  console.log('   —')
  for (const n of [1, 2, 3, 5, 10]) {
    // 年：2027 是平年（365 天）
    let first = null
    for (let i = 0; i < 31; i++) {
      const today = dayjs('2027-01-01').add(i, 'day')
      if (periodWithinLimits(periodOf(today, 'year'), resolveLimits({ earliest: '', latest: `T-${n}` }, today))) {
        first = i + 1
        break
      }
    }
    chk(`T-${n}：当年可点 ⟸ 今天是年内第`, first === null ? '永远不可点' : `${first} 天`, `${n + 1} 天`)
  }
}

console.log(bad === 0 ? '\n=== 全部通过 ===' : `\n=== 有 ${bad} 处失败 ===`)
