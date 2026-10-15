// T-n 限制 S~V：口径解析、resolveLimits、范围判定、夹取、区间交集
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/limits.mjs）

import dayjs from 'dayjs'
import {
  clampToLimits, parseLimitDate, periodOf, periodWithinLimits, resolveLimits, withinLimits,
} from '../src/utils/period.js'

const TODAY = dayjs('2026-10-15')
const f = (d) => (d ? d.format('YYYY-MM-DD') : String(d))
let fails = 0
function expect(label, got, want) {
  const ok = String(got) === String(want)
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(48)} ${got}${ok ? '' : `   期望 ${want}`}`)
}

console.log('=== S. T-n 口径解析（今天 = 2026-10-15） ===')
expect("parseLimitDate('T')", f(parseLimitDate('T', TODAY)), '2026-10-15')
expect("parseLimitDate('T-1')", f(parseLimitDate('T-1', TODAY)), '2026-10-14')
expect("parseLimitDate('T+7')", f(parseLimitDate('T+7', TODAY)), '2026-10-22')
expect("parseLimitDate('t-30') 小写", f(parseLimitDate('t-30', TODAY)), '2026-09-15')
expect("parseLimitDate('T0') 显式零", f(parseLimitDate('T0', TODAY)), '2026-10-15')
expect("parseLimitDate('T90') 不带符号 -> 无效", f(parseLimitDate('T90', TODAY)), 'null')
expect("parseLimitDate(-7) 数字", f(parseLimitDate(-7, TODAY)), '2026-10-08')
expect("parseLimitDate(7) 数字", f(parseLimitDate(7, TODAY)), '2026-10-22')
expect("parseLimitDate('2026-01-01') 绝对日期", f(parseLimitDate('2026-01-01', TODAY)), '2026-01-01')
expect("parseLimitDate('') 不限制", f(parseLimitDate('', TODAY)), 'null')
expect("parseLimitDate(null) 不限制", f(parseLimitDate(null, TODAY)), 'null')
expect("parseLimitDate('abc') 无效", f(parseLimitDate('abc', TODAY)), 'null')
expect("parseLimitDate('2026-13-01') 拒绝月滚年", f(parseLimitDate('2026-13-01', TODAY)), 'null')
expect("parseLimitDate('2026-02-30') 拒绝日滚月", f(parseLimitDate('2026-02-30', TODAY)), 'null')
expect("parseLimitDate('2024-02-29') 合法闰日", f(parseLimitDate('2024-02-29', TODAY)), '2024-02-29')

console.log('\n=== T. resolveLimits ===')
let L = resolveLimits({ earliest: 'T-90', latest: 'T-1' }, TODAY)
expect('T-90 ~ T-1', `${f(L.min)} ~ ${f(L.max)}`, '2026-07-17 ~ 2026-10-14')
expect('写反了自动换回来', f(resolveLimits({ earliest: 'T-1', latest: 'T-30' }, TODAY).min), '2026-09-15')
expect('只给 latest', f(resolveLimits({ latest: 'T-1' }, TODAY).min), 'null')
expect('两端都不给', f(resolveLimits({}, TODAY).min) + '/' + f(resolveLimits({}, TODAY).max), 'null/null')

console.log('\n=== U. withinLimits / clampToLimits ===')
L = resolveLimits({ earliest: 'T-30', latest: 'T-1' }, TODAY) // 2026-09-15 ~ 2026-10-14
expect('T-30 当天算在内（含端点）', withinLimits('2026-09-15', L), true)
expect('早一天越界', withinLimits('2026-09-14', L), false)
expect('T-1 当天算在内', withinLimits('2026-10-14', L), true)
expect('今天超上限', withinLimits('2026-10-15', L), false)
expect('未来超上限', withinLimits('2027-01-01', L), false)
expect('范围内不动', f(clampToLimits('2026-10-01', L)), '2026-10-01')
expect('太早夹到 min', f(clampToLimits('2026-07-20', L)), '2026-09-15')
expect('太晚夹到 max', f(clampToLimits('2027-05-05', L)), '2026-10-14')
expect('无限制不动', f(clampToLimits('1999-01-01', resolveLimits({}, TODAY))), '1999-01-01')

console.log('\n=== V. 区间与限制的交集（面板禁用的依据） ===')
expect('整月全在范围外 -> 禁', periodWithinLimits(periodOf(dayjs('2025-01-15'), 'month'), L), false)
expect('整月全在范围后 -> 禁', periodWithinLimits(periodOf(dayjs('2027-03-15'), 'month'), L), false)
expect('整月部分在内 -> 可点', periodWithinLimits(periodOf(dayjs('2026-09-15'), 'month'), L), true)
expect('整年全在范围外 -> 禁', periodWithinLimits(periodOf(dayjs('2025-01-01'), 'year'), L), false)
expect('2026 年部分在内 -> 可点', periodWithinLimits(periodOf(dayjs('2026-06-01'), 'year'), L), true)
expect('跨年周部分在内 -> 可点', periodWithinLimits(periodOf(dayjs('2026-12-30'), 'week'), resolveLimits({ earliest: 'T-90', latest: 'T+30' }, TODAY)), false)
expect('无限制 -> 全可点', periodWithinLimits(periodOf(dayjs('1999-01-01'), 'year'), resolveLimits({}, TODAY)), true)
console.log(fails === 0 ? '\n=== 全部通过 ===' : `\n=== 有 ${fails} 处失败 ===`)

