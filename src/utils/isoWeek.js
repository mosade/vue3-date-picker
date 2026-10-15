import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import advancedFormat from 'dayjs/plugin/advancedFormat'

// 本模块自己注册依赖的插件，任何地方 import 进来都能直接用，不依赖 main.js 里的 dayjs.extend 顺序。
// GGGG / WW 这两个 token 由 advancedFormat 渲染，取值分别是 isoWeekYear() / isoWeek()，与 locale 无关。
dayjs.extend(isoWeek)
dayjs.extend(advancedFormat)

/** 对外 v-model 的规范格式：ISO 周年份 + 两位周数，例如 "2026-30"、"2026-53"。 */
export const ISO_WEEK_FORMAT = 'GGGG-WW'

/** 输入框里的展示格式。 */
export const ISO_WEEK_DISPLAY_FORMAT = 'GGGG 年第 WW 周'

// "2026-30" / "2026-3" / "2026-W30" / "2026w30" 都接受
const WEEK_RE = /^(\d{4})[-/]?[wW]?(\d{1,2})$/
// 自然日期，用来兼容「父组件手里只有一个日期」的情况
const DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/

/** 某个 ISO 周年版里一共有多少周（52 或 53）。12 月 28 日永远落在该年的最后一周。 */
export function weeksInIsoYear(year) {
  return dayjs(new Date(year, 11, 28)).isoWeek()
}

/**
 * 把各种输入统一成 { year, week }，无法识别或周数越界返回 null。
 *
 * 注意：绝不能让 dayjs 直接解析 "2026-30" —— 它会被当成「2026 年 30 月」，得到 2028-06-01。
 * 所以先按字符串正则分流，日期分支才交给 dayjs。
 */
export function parseIsoWeek(input) {
  if (input === null || input === undefined || input === '') return null

  if (typeof input === 'object') {
    const date = dayjs(input)
    return date.isValid() ? { year: date.isoWeekYear(), week: date.isoWeek() } : null
  }

  const str = String(input).trim()

  // 日期输入：取它所在的 ISO 周
  const date = parseStrictDate(str)
  if (date) return { year: date.isoWeekYear(), week: date.isoWeek() }

  const match = WEEK_RE.exec(str)
  if (!match) return null

  const year = Number(match[1])
  const week = Number(match[2])
  // 2026 年有 53 周、2027 年只有 52 周，越界的周数一律当无效值
  if (week < 1 || week > weeksInIsoYear(year)) return null
  return { year, week }
}

/**
 * 严格解析日期字符串，字段越界（如 2026-13-01、2026-02-30）直接判无效。
 * ⚠️ dayjs 不校验字段范围，会把它滚成另一个合法日期，必须回读比对。
 */
function parseStrictDate(str) {
  const match = DATE_RE.exec(str)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = dayjs(new Date(year, month - 1, day))
  const ok = date.isValid() && date.year() === year && date.month() === month - 1 && date.date() === day
  return ok ? date : null
}

/** 统一成规范字符串 "2026-30"；无效输入返回空串。 */
export function normalizeIsoWeek(input) {
  const parsed = parseIsoWeek(input)
  return parsed ? `${parsed.year}-${String(parsed.week).padStart(2, '0')}` : ''
}

/** 该周的周一 ~ 周日，返回 dayjs 对象；无效输入返回 null。 */
export function isoWeekRange(input) {
  const parsed = parseIsoWeek(input)
  if (!parsed) return null

  // 用「1 月 4 日必定属于第 1 周」当锚点推日期，避免各年份周数不一致带来的错位。
  // isoWeekYear() 只有 getter 没有 setter（传参会被忽略），所以不能写成
  // dayjs().isoWeekYear(y).isoWeek(w)。
  const start = dayjs(new Date(parsed.year, 0, 4))
    .startOf('isoWeek')
    .add(parsed.week - 1, 'week')

  return { start, end: start.endOf('isoWeek'), year: parsed.year, week: parsed.week }
}

/** 格式化展示，例如 "2026 年第 30 周"；无效输入返回空串。 */
export function formatIsoWeek(input, fmt = ISO_WEEK_DISPLAY_FORMAT) {
  const range = isoWeekRange(input)
  return range ? range.start.format(fmt) : ''
}

/** ISO 周里的周几中文名，1 = 周一 … 7 = 周日。 */
export const ISO_WEEKDAY_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
