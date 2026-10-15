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

/**
 * 严格解析 YYYY-MM-DD。
 * ⚠️ dayjs 不校验字段范围，会把 '2026-13-01' 悄悄滚成 '2027-01-01'、'2026-02-30' 滚成 '2026-03-02'，
 *    所以必须回读比对一次，否则非法日期会变成另一个合法日期。
 */
function parseStrictDay(input) {
  const str = String(input).trim()
  if (!DAY_RE.test(str)) return null
  const day = dayjs(str)
  return day.isValid() && day.format('YYYY-MM-DD') === str ? day.startOf('day') : null
}

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
  const day = parseStrictDay(str)
  return day ? periodOf(day, 'day') : null
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

// "T" / "T0" / "T-1" / "T+7"
const T_OFFSET_RE = /^[Tt](?:([+-])(\d{1,4})|0)?$/

/**
 * T-n 限制口径：把限制值解析成具体日期。
 *
 *   'T'         今天
 *   'T-1'       昨天        （数据通常只到 T-1）
 *   'T+7'       7 天后      （允许选未来）
 *   -7 / 7      数字 = 相对今天的偏移天数
 *   '2026-01-01' 绝对日期
 *   '' / null   不限制
 */
export function parseLimitDate(input, today = dayjs()) {
  if (input === null || input === undefined || input === '') return null

  const base = dayjs(today).startOf('day')
  if (!base.isValid()) return null

  if (typeof input === 'number') {
    return Number.isFinite(input) ? base.add(input, 'day') : null
  }

  const str = String(input).trim()

  const offset = T_OFFSET_RE.exec(str)
  if (offset) {
    const days = Number(offset[2] ?? 0)
    return base.add(offset[1] === '-' ? -days : days, 'day')
  }

  const day = parseStrictDay(str)
  if (day) return day

  return null
}

/** 解析 earliest / latest，得到 { min, max }；没限制的那端为 null。写反了会自动换回来。 */
export function resolveLimits(input = {}, today = dayjs()) {
  let min = parseLimitDate(input.earliest, today)
  let max = parseLimitDate(input.latest, today)
  if (min && max && min.isAfter(max)) {
    ;[min, max] = [max, min]
  }
  return { min, max }
}

/** 某天是否落在限制范围内（含端点）。 */
export function withinLimits(day, limits) {
  if (!limits) return true
  const d = dayjs(day)
  if (!d.isValid()) return true
  if (limits.min && d.isBefore(limits.min, 'day')) return false
  if (limits.max && d.isAfter(limits.max, 'day')) return false
  return true
}

/** 把某天夹进限制范围；没有限制就原样返回。 */
export function clampToLimits(day, limits) {
  const d = dayjs(day)
  if (!limits || !d.isValid()) return d
  if (limits.min && d.isBefore(limits.min, 'day')) return limits.min
  if (limits.max && d.isAfter(limits.max, 'day')) return limits.max
  return d
}

/**
 * 某个区间和限制范围有没有交集 —— 面板里决定「这一格能不能点」时用它。
 * 注意 Element Plus 的年/月面板自己会用 .every() 聚合按天判定，所以一般直接传
 * disabled-date = (time) => !withinLimits(time, limits) 就够了。
 */
export function periodWithinLimits(period, limits) {
  if (!limits) return true
  if (limits.min && period.end.isBefore(limits.min, 'day')) return false
  if (limits.max && period.start.isAfter(limits.max, 'day')) return false
  return true
}
