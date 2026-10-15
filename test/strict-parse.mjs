// 严格解析：拒绝被 dayjs 静默滚动的日期（2026-13-01 / 2026-02-30）
// 运行：pnpm test（或 node --import ./test/_loader/register.mjs test/strict-parse.mjs）

import { parsePeriod } from '../src/utils/period.js'
let bad = 0
const cases = [
  [{ range: 'day', date: '2026-13-01' }, null, '月 13 会滚成 2027-01-01'],
  [{ range: 'day', date: '2026-02-30' }, null, '2 月 30 会滚成 3 月 2 日'],
  [{ range: 'day', date: '2026-02-29' }, null, '2026 不是闰年'],
  [{ range: 'day', date: '2024-02-29' }, 'ok', '2024 是闰年'],
  [{ range: 'day', date: '2026-00-10' }, null, '月 0'],
  [{ range: 'day', date: '2026-12-00' }, null, '日 0'],
  [{ range: 'day', date: '2026-12-32' }, null, '日 32'],
]
for (const [input, want, why] of cases) {
  const got = parsePeriod(input) ? 'ok' : null
  const ok = got === want
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify(input).padEnd(44)} -> ${got}  (${why})`)
}
console.log(bad === 0 ? 'ok   parsePeriod 日分支拒绝所有滚动日期' : `FAIL ${bad} 处`)
