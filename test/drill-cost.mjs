// 钻取口径的代价：日 -> 周 -> 日 在不同口径下是否丢位置
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/drill-cost.mjs）

import dayjs from 'dayjs'
import { anchorFor, formatPeriod, isCoarser, parsePeriod, periodOf } from '../src/utils/period.js'
const TODAY = dayjs('2026-10-15')
function run(start, drillTo) {
  let range = 'day'
  let anchor = dayjs('2026-10-15')
  const period = () => periodOf(anchor, range)
  const stamp = () => `${range} ${formatPeriod(period(), range)}`
  anchor = anchorFor(parsePeriod({ range: 'day', date: start }), drillTo, anchor, 'day', TODAY); range = 'day'
  for (const next of ['week', 'day']) {
    if (!isCoarser(next, range) && drillTo !== 'anchor') anchor = anchorFor(period(), drillTo, anchor, range, TODAY)
    range = next
  }
  return stamp()
}
console.log('日 2026-07-23（周四）-> 周 -> 日：')
for (const m of ['anchor', 'start', 'end', 'today']) console.log(`  ${m.padEnd(6)} ${run('2026-07-23', m)}${run('2026-07-23', m).endsWith('2026-07-23') ? '  （无损）' : '  （位置丢了）'}`)
console.log('日 2026-12-30 -> 周 -> 日：')
for (const m of ['anchor', 'start', 'end', 'today']) console.log(`  ${m.padEnd(6)} ${run('2026-12-30', m)}${run('2026-12-30', m).endsWith('2026-12-30') ? '  （无损）' : '  （位置丢了）'}`)
