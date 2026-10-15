// ISO 周逐日对拍：2010-01-01 ~ 2040-12-31 与独立 Date 参考实现比对
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/iso-week.mjs）

import {
  normalizeIsoWeek,
  isoWeekRange,
  weeksInIsoYear,
  formatIsoWeek,
  parseIsoWeek,
  ISO_WEEK_FORMAT,
} from '../src/utils/isoWeek.js'

// ---------- 独立参考实现（纯 Date 数学，不用 dayjs） ----------
function refIso(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return { year: date.getUTCFullYear(), week }
}
const refStr = (d) => { const { year, week } = refIso(d); return `${year}-${String(week).padStart(2, '0')}` }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

let fails = 0
const fail = (msg) => { fails++; if (fails <= 20) console.log('  FAIL ' + msg) }

// ---------- 1. 逐日对拍 2010-01-01 ~ 2040-12-31 ----------
const days = []
for (let d = new Date(2010, 0, 1); d <= new Date(2040, 11, 31); d.setDate(d.getDate() + 1)) days.push(new Date(d))
let weekCount = 0
const seenWeeks = new Set()
for (const d of days) {
  const expect = refStr(d)
  const got = normalizeIsoWeek(d)
  if (got !== expect) fail(`day ${iso(d)}: normalize=${got} ref=${expect}`)

  // 日期字符串输入
  if (normalizeIsoWeek(iso(d)) !== expect) fail(`day-string ${iso(d)}: ${normalizeIsoWeek(iso(d))} ref=${expect}`)

  const range = isoWeekRange(got)
  if (!range) { fail(`range null for ${got}`); continue }
  if (range.start.isoWeekday() !== 1) fail(`${got} start weekday=${range.start.isoWeekday()}`)
  if (range.end.isoWeekday() !== 7) fail(`${got} end weekday=${range.end.isoWeekday()}`)
  if (range.end.diff(range.start, 'day') !== 6) fail(`${got} span != 6d`)
  if (d < range.start.toDate() || d > range.end.toDate()) fail(`${got} 不包含原日期 ${iso(d)}`)
  // 反解回读
  if (range.start.format(ISO_WEEK_FORMAT) !== got) fail(`${got} 回读=${range.start.format(ISO_WEEK_FORMAT)}`)
  if (range.end.format(ISO_WEEK_FORMAT) !== got) fail(`${got} 周日回读=${range.end.format(ISO_WEEK_FORMAT)}`)

  if (!seenWeeks.has(got)) { seenWeeks.add(got); weekCount++ }
}
console.log(`逐日对拍 ${days.length} 天 / ${weekCount} 个 ISO 周，独立参考实现 0 差异：${fails === 0}`)

// ---------- 2. 每周都是整周、且周内每一天都归一化到同一周 ----------
let weekFails = 0
for (const w of seenWeeks) {
  const range = isoWeekRange(w)
  for (let i = 0; i < 7; i++) {
    const d = range.start.add(i, 'day')
    if (normalizeIsoWeek(d.toDate()) !== w) { weekFails++; if (weekFails <= 5) console.log(`  FAIL ${w} 第 ${i} 天 → ${normalizeIsoWeek(d.toDate())}`) }
  }
}
console.log(`周内 7 天一致性：${weekFails === 0 ? 'OK' : weekFails + ' 处不一致'}`)

// ---------- 3. 周数（52/53）与参考实现一致 ----------
let wkFails = 0
for (let y = 1990; y <= 2060; y++) {
  const expect = refIso(new Date(y, 11, 28)).week
  if (weeksInIsoYear(y) !== expect) { wkFails++; console.log(`  FAIL ${y}: weeksInIsoYear=${weeksInIsoYear(y)} ref=${expect}`) }
}
console.log(`1990-2060 周数校验：${wkFails === 0 ? 'OK' : wkFails + ' 处不一致'}`)

// ---------- 4. 宽松输入 ----------
const cases = [
  ['2026-30', '2026-30'], ['2026-3', '2026-03'], ['2026-W30', '2026-30'], ['2026w30', '2026-30'],
  ['2026-53', '2026-53'], ['2026-01', '2026-01'], ['2027-01', '2027-01'],
  ['2026-12-28', '2026-53'], ['2027-01-03', '2026-53'], ['2027-01-04', '2027-01'],
  ['2025-12-29', '2026-01'],
  [new Date(2026, 11, 30), '2026-53'],
  ['', ''], [null, ''], [undefined, ''], ['abc', ''], ['2026-54', ''], ['2027-53', ''], ['2026-00', ''], ['2026-99', ''],
  [new Date('nope'), ''],
]
let caseFails = 0
for (const [input, expect] of cases) {
  const got = normalizeIsoWeek(input)
  const ok = got === expect
  if (!ok) caseFails++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify(input)} → "${got}"${ok ? '' : `  (期望 "${expect}")`}`)
}
console.log(`宽松输入用例：${caseFails === 0 ? '全部通过' : caseFails + ' 个失败'}`)

// ---------- 5. 关键回归点 ----------
console.log('parseIsoWeek("2026-30") =', JSON.stringify(parseIsoWeek('2026-30')), '（不能被 dayjs 当成 2026 年 30 月）')
console.log('formatIsoWeek("2026-53") =', formatIsoWeek('2026-53'))
console.log('formatIsoWeek("2026-53", "GGGG-WW") =', formatIsoWeek('2026-53', ISO_WEEK_FORMAT))
console.log('2026-53 区间 =', isoWeekRange('2026-53').start.format('YYYY-MM-DD'), '~', isoWeekRange('2026-53').end.format('YYYY-MM-DD'))
console.log('2026-01 区间 =', isoWeekRange('2026-01').start.format('YYYY-MM-DD'), '~', isoWeekRange('2026-01').end.format('YYYY-MM-DD'))
console.log('2026-30 区间 =', isoWeekRange('2026-30').start.format('YYYY-MM-DD'), '~', isoWeekRange('2026-30').end.format('YYYY-MM-DD'))
console.log(fails === 0 && weekFails === 0 && wkFails === 0 && caseFails === 0 ? '\n=== 全部通过 ===' : '\n=== 有失败 ===')
