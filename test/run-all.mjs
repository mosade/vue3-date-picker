// 跑 test/ 下所有验证脚本，任意一个出现 FAIL 就整体退出码 1。
//
//   pnpm test
//
// 这些脚本是纯计算的断言（不依赖浏览器），直接 import src/utils 下的真源码，
// 所以改完 isoWeek.js / period.js 直接跑这个就够了；界面行为另见 README 的「校验」一节。
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const files = [
  'iso-week.mjs',
  'strict-parse.mjs',
  'period.mjs',
  'drill.mjs',
  'drill-cost.mjs',
  'date-range.mjs',
  'limits.mjs',
  'limit-edge.mjs',
  'limit-edge2.mjs',
  'limit-t2.mjs',
]

// 各脚本自己汇总：只有失败分支才会打印「FAIL ...」或「=== 有 ... 失败 ===」，
// 所以这里不去猜「：false」之类的正文（T-n 边缘那套里「可点：false」是正常结论）。
const FAIL_PATTERNS = [/^FAIL/m, /=== 有/]
const failed = []

for (const file of files) {
  const run = spawnSync(
    process.execPath,
    // --import 要 URL；入口文件给普通绝对路径就行（给 file:// 反而在部分环境会被改写坏）
    ['--import', pathToFileURL(join(here, '_loader', 'register.mjs')).href, join(here, file)],
    { encoding: 'utf8' },
  )
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
  const bad = run.status !== 0 || FAIL_PATTERNS.some((re) => re.test(out))
  if (bad) failed.push(file)

  // 只回显每个脚本的最后一行（都是它自己的结论）
  const lines = out.trim().split('\n')
  const last = lines[lines.length - 1] ?? ''
  console.log(`${bad ? 'FAIL' : 'ok  '} ${file.padEnd(16)} ${last.replace(/^=== ?/, '').replace(/ ?===$/, '')}`)
  if (bad) console.log(out.trimEnd().split('\n').map((l) => `     | ${l}`).join('\n'))
}

console.log(
  failed.length === 0
    ? `\n=== ${files.length} 个测试文件全部通过 ===`
    : `\n=== ${failed.length}/${files.length} 个测试文件失败：${failed.join(', ')} ===`,
)
process.exit(failed.length === 0 ? 0 : 1)
