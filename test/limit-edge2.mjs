// T-n 边缘 AA~AF：今天=周一、边界落在周中、属性测试、日历日语义
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/limit-edge2.mjs）

import dayjs from 'dayjs'
import { formatIsoWeek, isoWeekRange, normalizeIsoWeek } from '../src/utils/isoWeek.js'
import {
  DRILL_MODES,
  RANGES,
  anchorFor,
  clampToLimits,
  containsDay,
  formatPeriod,
  parsePeriod,
  periodOf,
  periodWithinLimits,
  resolveLimits,
  withinLimits,
} from '../src/utils/period.js'

const f = (d) => (d ? d.format('YYYY-MM-DD') : '-')
const wd = (d) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(d).day()]
let bad = 0
const chk = (label, got, want) => {
  const ok = String(got) === String(want)
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} ${got}${ok ? '' : `   期望 ${want}`}`)
}

console.log('=== AA. 今天 2026-10-12 是周一：latest="T-1" 时「本周」整周都点不动 ===')
{
  const T = dayjs('2026-10-12')
  console.log(`   2026-10-12 是 ${wd(T)}；T-1 = 2026-10-11（周日）`)
  const L = resolveLimits({ earliest: '', latest: 'T-1' }, T)
  chk('可选上限', f(L.max), '2026-10-11')
  const week = (d) => periodOf(dayjs(d), 'week')
  const iso = (d) => formatIsoWeek(dayjs(d), 'GGGG-WW')
  chk(`周 ${iso('2026-10-12')}（10-12~10-18 本周）`, periodWithinLimits(week('2026-10-12'), L), false)
  chk(`周 ${iso('2026-10-05')}（10-05~10-11 上周）`, periodWithinLimits(week('2026-10-05'), L), true)

  // 对照：同样的限制，今天如果是周四（本周已经有 T-1 了）本周就能点
  const T2 = dayjs('2026-10-15')
  console.log(`   对照：今天换成 2026-10-15 是 ${wd(T2)}；T-1 = 2026-10-14`)
  const L2 = resolveLimits({ earliest: '', latest: 'T-1' }, T2)
  chk(`周 ${iso('2026-10-12')}（10-12~10-18 本周）`, periodWithinLimits(week('2026-10-12'), L2), true)

  // 规律：只要本周有一天 <= T-1 就能点；周一那天恰好是「这周全是未来」
  for (const d of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']) {
    const today = dayjs(d)
    const Ll = resolveLimits({ earliest: '', latest: 'T-1' }, today)
    const week = periodOf(today, 'week')
    let avail = 0
    for (let k = 0; k < 7; k++) if (withinLimits(week.start.add(k, 'day'), Ll)) avail++
    console.log(
      `     今天 ${d}（${wd(today)}）→ 周 ${iso(d)} ${f(week.start)}~${f(week.end)}，可用 ${avail}/7 天 → 可点：${periodWithinLimits(week, Ll)}`,
    )
  }
}

console.log('\n=== AB. 边界落在周中：earliest="T-30"，今天 2026-10-12 → 下限 09-12 是周六 ===')
{
  const T = dayjs('2026-10-12')
  const L = resolveLimits({ earliest: 'T-30', latest: 'T-1' }, T)
  chk('下限 / 上限', `${f(L.min)} ~ ${f(L.max)}`, '2026-09-12 ~ 2026-10-11')
  chk('下限 2026-09-12 是', wd(L.min), '周六')
  chk('上限 2026-10-11 是', wd(L.max), '周日')
  for (const [d, want] of [
    ['2026-09-07', true], // 周 2026-37：09-07 ~ 09-13，只有周六日可用
    ['2026-09-14', true], // 周 2026-38：整周可用
    ['2026-08-31', false], // 周 2026-36：整周在范围外
    ['2026-10-05', true], // 周 2026-41：整周可用（到 T-1 为止）
  ]) {
    const r = isoWeekRange(dayjs(d).format('YYYY-MM-DD'))
    chk(`周 ${normalizeIsoWeek(d)}（${f(r.start)}~${f(r.end)}）`, periodWithinLimits(periodOf(dayjs(d), 'week'), L), want)
  }
  // 边界周里点哪一天都能选到同一周（Element Plus 收到的是 startOf('week')）
  chk('周 2026-37 里 09-12（周六）归一化', normalizeIsoWeek('2026-09-12'), '2026-37')
  chk('周 2026-37 里 09-13（周日）归一化', normalizeIsoWeek('2026-09-13'), '2026-37')
  chk('周 2026-38 里 09-14（周一）归一化', normalizeIsoWeek('2026-09-14'), '2026-38')
  // 月 / 年：部分可用即可点（Element Plus 用 .every() 聚合）
  chk('月 2026-09', periodWithinLimits(periodOf(dayjs('2026-09-01'), 'month'), L), true)
  chk('月 2026-08', periodWithinLimits(periodOf(dayjs('2026-08-01'), 'month'), L), false)
  chk('年 2026', periodWithinLimits(periodOf(dayjs('2026-06-01'), 'year'), L), true)
  chk('年 2025', periodWithinLimits(periodOf(dayjs('2025-06-01'), 'year'), L), false)
}

console.log('\n=== AC. 上下限正好落在整段维度的边界（贴边不算越界）===')
{
  const T = dayjs('2026-10-12')
  const L = resolveLimits({ earliest: '2026-09-07', latest: '2026-10-11' }, T) // 周一 ~ 周日
  chk('周 2026-37（起点 == 下限）', periodWithinLimits(periodOf(dayjs('2026-09-07'), 'week'), L), true)
  chk('周 2026-41（终点 == 上限）', periodWithinLimits(periodOf(dayjs('2026-10-05'), 'week'), L), true)
  chk('周 2026-36（终点 09-06 < 下限）', periodWithinLimits(periodOf(dayjs('2026-09-02'), 'week'), L), false)
  chk('周 2026-42（起点 10-12 > 上限）', periodWithinLimits(periodOf(dayjs('2026-10-14'), 'week'), L), false)
  chk('下限当天在范围内', withinLimits(L.min, L), true)
  chk('上限当天在范围内', withinLimits(L.max, L), true)
  chk('下限前一天越界', withinLimits(L.min.subtract(1, 'day'), L), false)
  chk('上限后一天越界', withinLimits(L.max.add(1, 'day'), L), false)
}

console.log('\n=== AD. 属性测试：选得到的区间，四种口径下「定锚点 + 夹取」都必须落在该区间内 ===')
{
  const limitSets = [
    { earliest: '', latest: '' },
    { earliest: '', latest: 'T-1' },
    { earliest: 'T-30', latest: 'T-1' },
    { earliest: 'T-90', latest: 'T+7' },
    { earliest: 'T-1', latest: 'T-1' },
    { earliest: '2026-09-12', latest: '2026-10-11' },
  ]
  const todays = ['2026-10-12', '2026-10-15', '2026-11-01', '2026-12-31', '2027-01-01', '2024-02-29']
  const prevAnchors = ['2026-10-01', '2026-07-20', '2026-12-30', '2027-01-01', '2025-12-31', '2024-02-29']
  let periods = 0
  let combos = 0
  const fails = []
  for (const today of todays) {
    const T = dayjs(today)
    for (const set of limitSets) {
      const L = resolveLimits(set, T)
      for (let i = -75; i <= 75; i++) {
        const day = T.add(i, 'day')
        for (const range of RANGES) {
          const period = periodOf(day, range)
          if (!periodWithinLimits(period, L)) continue
          periods++
          // 写出去的 date 必须能读回来（parse -> format 往返一致）
          const out = formatPeriod(period, range)
          const back = parsePeriod({ range, date: out })
          if (!back || !back.start.isSame(period.start)) {
            fails.push(`往返失败 ${range} ${out} @${today} ${set.earliest}~${set.latest}`)
          }
          for (const mode of DRILL_MODES) {
            for (const prev of prevAnchors) {
              combos++
              const a = clampToLimits(anchorFor(period, mode, dayjs(prev), range, T), L)
              if (!containsDay(period, a)) {
                fails.push(
                  `落点跑出区间 ${range} ${f(period.start)}~${f(period.end)} 口径=${mode} prev=${prev} today=${today} 限制=${set.earliest}~${set.latest} → ${f(a)}`,
                )
              }
              if (!withinLimits(a, L)) {
                fails.push(
                  `落点越界 ${range} 口径=${mode} prev=${prev} today=${today} 限制=${set.earliest}~${set.latest} → ${f(a)}`,
                )
              }
            }
          }
        }
      }
    }
  }
  chk(`可选区间 ${periods} 个 × 口径/前值组合 ${combos} 组，全部满足「区间含锚点 + 锚点在限制内」`, fails.length, 0)
  for (const item of fails.slice(0, 10)) console.log('     ' + item)
}

console.log('\n=== AE. 今天本身越界：初始值 / 单向夹取 ===')
{
  const T = dayjs('2026-10-12')
  const L = resolveLimits({ earliest: 'T-30', latest: 'T-1' }, T)
  chk('v-model 初始 = 今天，会被夹到', f(clampToLimits(T, L)), '2026-10-11')
  chk('夹取后落在周 2026-41', normalizeIsoWeek('2026-10-11'), '2026-41')
  const only = resolveLimits({ earliest: 'T-1', latest: 'T-1' }, T)
  chk('只留 T-1：今天（10-12 周一）不可选', withinLimits(T, only), false)
  chk('只留 T-1：今天那周 2026-42 也不可点', periodWithinLimits(periodOf(T, 'week'), only), false)
  chk('只留 T-1：昨天那周 2026-41 仍可点', periodWithinLimits(periodOf(T.subtract(1, 'day'), 'week'), only), true)
  chk('只留 T-1：月 2026-10 仍可点', periodWithinLimits(periodOf(T, 'month'), only), true)
  // 放开限制不会弹回（组件里的 withLimits 是单向的）
  const loosened = clampToLimits(dayjs('2026-10-11'), resolveLimits({ earliest: '', latest: '' }, T))
  chk('放开限制后原值（10-11）不动', f(loosened), '2026-10-11')
}

console.log('\n=== AF. T-n 的「天」是日历日（跨月 / 跨年 / 闰年 / 月末）===')
{
  const cases = [
    ['2026-10-12', -30, '2026-09-12'],
    ['2026-10-12', -1, '2026-10-11'],
    ['2026-11-01', -1, '2026-10-31'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2024-03-01', -1, '2024-02-29'],
    ['2027-01-02', -1, '2027-01-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-10-12', 7, '2026-10-19'],
  ]
  for (const [today, offset, want] of cases) {
    const L = resolveLimits({ earliest: offset, latest: '' }, dayjs(today))
    chk(`今天 ${today} + ${offset} 天`, f(L.min), want)
  }
  // 用 Date 参考实现再对一遍（同样是日历日语义）
  const ref = (today, n) => {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + n)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  let diff = 0
  for (let i = 0; i < 400; i++) {
    const day = dayjs('2026-01-01').add(i, 'day').format('YYYY-MM-DD')
    for (const n of [-1, -7, -30, -90, 1, 7]) {
      const got = f(resolveLimits({ earliest: n, latest: '' }, dayjs(day)).min)
      if (got !== ref(day, n)) diff++
    }
  }
  chk('400 天 × 6 个偏移 对拍 Date 参考实现', diff, 0)
}

console.log(bad === 0 ? '\n=== 全部通过 ===' : `\n=== 有 ${bad} 处失败 ===`)
