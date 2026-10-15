import dayjs from 'dayjs'
import { ISO_WEEK_FORMAT, isoWeekRange } from './isoWeek'

/** 支持的时间维度，从细到粗。 */
export const RANGES = ['day', 'week', 'month', 'year']

/** 维度中文名。 */
export const RANGE_LABELS = { day: '日', week: '周', month: '月', year: '年' }

/** 钻取口径：粗 -> 细 时锚点落在区间的哪一天。 */
export const DRILL_MODES = ['anchor', 'start', 'end', 'today']

/** 钻取口径中文名。 */
export const DRILL_MODE_LABELS = {
  anchor: '记忆锚点',
  start: '区间起点',
  end: '区间终点',
  today: '今天优先',
}

/**
 * 每个维度在 v-model 里的 date 格式：
 *   day   "2026-07-20"
 *   week  "2026-30"（ISO 周年份 + 周数，跨年周会横跨两个自然年）
 *   month "2026-07"（自然月）
 *   year  "2026"（自然年）
 */
export const PERIOD_FORMAT = {
  day: 'YYYY-MM-DD',
  week: ISO_WEEK_FORMAT, // 'GGGG-WW'
  month: 'YYYY-MM',
  year: 'YYYY',
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^(\d{4})-(\d{1,2})$/
const YEAR_RE = /^(\d{4})$/

/** 维度 a 是否比维度 b 更粗。 */
export function isCoarser(a, b) {
  return RANGES.indexOf(a) > RANGES.indexOf(b)
}

/** 某一天所在的区间（含首尾）。 */
export function periodOf(day, range) {
  const d = dayjs(day)
  switch (range) {
    case 'week':
      return { start: d.startOf('isoWeek'), end: d.endOf('isoWeek') }
    case 'month':
      return { start: d.startOf('month'), end: d.endOf('month') }
    case 'year':
      return { start: d.startOf('year'), end: d.endOf('year') }
    default:
      return { start: d.startOf('day'), end: d.endOf('day') }
  }
}

/** 把区间格式化成该维度的 date 字符串。 */
export function formatPeriod(period, range) {
  return period.start.format(PERIOD_FORMAT[range] ?? PERIOD_FORMAT.day)
}

/** 解析 { range, date } 成区间；格式不对返回 null。 */
export function parsePeriod(input) {
  if (!input || !RANGES.includes(input.range) || !input.date) return null

  const str = String(input.date).trim()

  if (input.range === 'week') {
    const week = isoWeekRange(str)
    return week ? { start: week.start, end: week.end } : null
  }

  if (input.range === 'month') {
    const match = MONTH_RE.exec(str)
    if (!match) return null
    const month = Number(match[2])
    if (month < 1 || month > 12) return null
    return periodOf(dayjs(new Date(Number(match[1]), month - 1, 1)), 'month')
  }

  if (input.range === 'year') {
    const match = YEAR_RE.exec(str)
    return match ? periodOf(dayjs(new Date(Number(match[1]), 0, 1)), 'year') : null
  }

  if (!DAY_RE.test(str)) return null
  const day = dayjs(str)
  return day.isValid() ? periodOf(day, 'day') : null
}

/** 区间是否包含某天。 */
export function containsDay(period, day) {
  const d = dayjs(day)
  return d.isValid() && !d.isBefore(period.start) && !d.isAfter(period.end)
}

/** 按月长裁掉越界的「几号」（2 月 31 日 -> 2 月 28/29 日）。 */
function clampDay(year, monthIndex, dayOfMonth) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return dayjs(new Date(year, monthIndex, Math.min(dayOfMonth, lastDay)))
}

/**
 * 把「记住的那一天」投影到目标区间，尽量保住用户在更细维度上的位置：
 *   day   区间只有一天，直接用区间起点
 *   week  保住「周几」
 *   month 保住「几号」
 *   year  保住「几月几号」
 * 锚点本来就在区间里就原样返回；保不住的（2 月 31 日之类）按月长裁掉。
 */
export function projectDay(anchor, period, range = 'day') {
  const a = dayjs(anchor)
  if (containsDay(period, a)) return a

  const start = period.start
  const weekday = a.isValid() ? a.isoWeekday() : 1

  switch (range) {
    case 'week':
      return start.add(weekday - 1, 'day')
    case 'month':
      return clampDay(start.year(), start.month(), a.isValid() ? a.date() : 1)
    case 'year':
      return clampDay(start.year(), a.isValid() ? a.month() : 0, a.isValid() ? a.date() : 1)
    default:
      return start
  }
}

/**
 * 按「钻取口径」给某个区间算一个锚点，用在粗 -> 细、以及面板里明确选一段的时候。
 *
 *   anchor 记住你原来那天（投影进区间，尽量保住周几 / 几号 / 月日）—— 无损，默认口径
 *   start  区间起点（年 2026 -> 2026-01-01）
 *   end    区间终点（年 2026 -> 2026-12-31）
 *   today  今天在区间里就用今天，否则就近 clamp 到区间端点
 *
 * ⚠️ end 的两个坑：当年包含今天时会把你定位到未来的 12-31；
 *    而「选一天 -> 看这一周 -> 回到那一天」会漂到周日（2026-07-20 -> 2026-07-26）。
 */
export function anchorFor(period, mode, prevAnchor, range = 'day', today = dayjs()) {
  switch (mode) {
    case 'start':
      return period.start
    case 'end':
      return period.end.startOf('day')
    case 'today': {
      const t = dayjs(today).startOf('day')
      if (containsDay(period, t)) return t
      return t.isBefore(period.start) ? period.start : period.end.startOf('day')
    }
    default:
      return projectDay(prevAnchor, period, range)
  }
}
