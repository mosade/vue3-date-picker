import dayjs from 'dayjs'

/** 最大跨度支持的自然日历单位。 */
export const RANGE_SPAN_UNITS = ['day', 'week', 'month', 'year']

export const RANGE_SPAN_UNIT_LABELS = {
  day: '天',
  week: '周',
  month: '个月',
  year: '年',
}

const UNIT_ALIASES = {
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  week: 'week',
  weeks: 'week',
  m: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  year: 'year',
  years: 'year',
}

function normalizeUnit(unit) {
  return UNIT_ALIASES[String(unit).trim().toLowerCase()] ?? null
}

/**
 * 解析最大跨度。
 *
 *   '1M' / 'month'              1 个自然月
 *   '30D' / '2W' / '1Y'        30 天 / 2 周 / 1 年
 *   30                          30 天
 *   { value: 1, unit: 'month' } 对象写法
 *
 * 返回 { amount, unit }；空值或非法值返回 null。
 */
export function parseRangeSpan(input) {
  if (input === null || input === undefined || input === '') return null

  if (typeof input === 'number') {
    return Number.isInteger(input) && input > 0
      ? { amount: input, unit: 'day' }
      : null
  }

  if (typeof input === 'object') {
    const amount = input.amount ?? input.value ?? input.count
    const unit = normalizeUnit(input.unit)
    return Number.isInteger(amount) && amount > 0 && unit
      ? { amount, unit }
      : null
  }

  const text = String(input).trim().toLowerCase()
  if (!text) return null

  // 允许直接写单位，等价于 1 个该单位
  const unitOnly = normalizeUnit(text)
  if (unitOnly) return { amount: 1, unit: unitOnly }

  const match = /^(\d+)\s*([a-z]+)$/.exec(text)
  if (!match) return null

  const amount = Number(match[1])
  const unit = normalizeUnit(match[2])
  return Number.isInteger(amount) && amount > 0 && unit
    ? { amount, unit }
    : null
}

/** 跨度的人类可读文本，例如 "1 个月"、"30 天"。 */
export function formatRangeSpan(span) {
  if (!span) return ''
  return `${span.amount} ${RANGE_SPAN_UNIT_LABELS[span.unit] ?? span.unit}`
}

/**
 * 以起始日为锚点计算最大跨度的上下界。
 *
 * 1M 表示「起点 + 1 个自然月」，不是固定 30/31 天：
 * 2026-01-31 ~ 2026-02-28、2026-06-15 ~ 2026-07-15 都属于 1M。
 */
export function getRangeBounds(start, span) {
  const anchor = dayjs(start).startOf('day')
  if (!anchor.isValid() || !span) return null

  return {
    start: anchor,
    min: anchor.subtract(span.amount, span.unit).startOf('day'),
    max: anchor.add(span.amount, span.unit).startOf('day'),
  }
}

/** 某一天是否位于最大跨度边界内（含端点）。 */
export function isWithinRangeBounds(day, bounds) {
  if (!bounds) return true
  const value = dayjs(day).startOf('day')
  if (!value.isValid()) return false
  return !value.isBefore(bounds.min, 'day') && !value.isAfter(bounds.max, 'day')
}

/**
 * 一个已完成的日期区间是否在最大跨度内。
 * 顺序写反也能判断；空区间或非法日期返回 false。
 */
export function isRangeWithinSpan(value, span) {
  if (!Array.isArray(value) || value.length !== 2) return false

  const first = dayjs(value[0]).startOf('day')
  const second = dayjs(value[1]).startOf('day')
  if (!first.isValid() || !second.isValid()) return false
  if (!span) return true

  const [start, end] = first.isAfter(second) ? [second, first] : [first, second]
  return isWithinRangeBounds(end, getRangeBounds(start, span))
}

/**
 * 把超跨度的已完成区间裁到上限，便于程序赋值或手输日期时兜底。
 * 返回 [start, end] 两个 dayjs；输入不完整或不合法时返回 null。
 */
export function clampRangeToSpan(value, span) {
  if (!Array.isArray(value) || value.length !== 2) return null
  if (!span) return null

  const first = dayjs(value[0]).startOf('day')
  const second = dayjs(value[1]).startOf('day')
  if (!first.isValid() || !second.isValid()) return null

  const start = first.isAfter(second) ? second : first
  const end = first.isAfter(second) ? first : second
  if (isRangeWithinSpan([start, end], span)) return [start, end]

  const bounds = getRangeBounds(start, span)
  return [start, end.isAfter(bounds.max, 'day') ? bounds.max : end]
}
