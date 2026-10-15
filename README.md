# vue3-date-picker

Element Plus 周选择器 Demo：一周从**周一**开始，按 **ISO 8601** 计算跨年周。

## 运行

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # 产物在 dist/
pnpm preview  # 预览构建产物
```

## 为什么不能用 `value-format="YYYY-ww"`

Element Plus 用 dayjs 的 **locale 周**（`w` / `ww`）来格式化周，同时 `YYYY` 是自然年。
这两个 token 组合起来在跨年周会算错：

| 点击的周 | ISO 8601 | `YYYY-ww` 的输出 |
| --- | --- | --- |
| 2026-12-28 ~ 2027-01-03 | 2026-W53 | `2026-01` ❌（年尾跨年周会回绕成第 1 周） |

于是 `v-model` 拿到 `2026-01`，再反解就变成了 2025-12-29 ~ 2026-01-04，UI 与选择结果完全错位。

## 正确做法

1. `value-format="YYYY-MM-DD"`：`v-model` 存该周的周一（如 `2026-12-28`），没有歧义、也能被
   `customParseFormat` 正确解析。**不要**用 ISO token 当 `value-format`（见下文「token 速查」）。
2. `format="GGGG 年第 WW 周"`：只用于输入框展示，`GGGG` / `WW` 是 ISO 周年份与 ISO 周数。
3. `src/main.js` 中的 dayjs 配置（**必须的是「注册语言包」+「weekStart: 1」这两件**）：
   - `import 'dayjs/locale/zh-cn'`：**必须注册语言包**，否则 Element Plus 内部的 `.locale('zh-cn')`
     会静默回退到英文，一周就从周日开始了；
   - `dayjs.locale('zh-cn')`：只是把**全局默认** locale 设成中文，删掉不影响周逻辑
     （Element Plus 会自己给面板实例 `.locale('zh-cn')`，我们自己的 ISO 计算也与 locale 无关）；
   - `dayjs/plugin/isoWeek`：提供 `isoWeek` / `isoWeekYear` / `startOf('isoWeek')` 与 `GGGG`、`WW`；
   - `dayjs/plugin/advancedFormat`：渲染 `GGGG` / `WW` 的 token，显式注册，不依赖 Element Plus 顺手注册；
   - `dayjs/plugin/updateLocale`：配合 `dayjs.updateLocale(..., { weekStart: 1 })` 把「周一开头」写死，
     避免语言包缺失时静默变化。
4. `src/components/WeekPickerDemo.vue` 里的 ISO 周计算全部走 dayjs 的 `isoWeek` 系列：
   - 取 ISO 周：`dayjs(v).format('GGGG-WW')`（等价 `isoWeekYear()` + `isoWeek()`）
   - 取起止：`startOf('isoWeek')` / `endOf('isoWeek')`，周几用 `isoWeekday()`（1=周一 … 7=周日）
   - 由 `"2026-53"` 推日期：`dayjs(new Date(y, 0, 4)).startOf('isoWeek').add(w - 1, 'week')`。
     ⚠️ `isoWeekYear()` **只有 getter 没有 setter**（传参会被忽略），所以不能写
     `dayjs().isoWeekYear(y).isoWeek(w)`，只能从「1 月 4 日必定属于第 1 周」这个锚点推导。

## token 速查

| token / 方法 | 口径 | 是否随 locale 变 | 所属插件 |
| --- | --- | --- | --- |
| `w` `ww` `gggg` / `week()` `weekYear()` | locale 周 | **会**（跟 `weekStart` 走） | `weekOfYear` + `weekYear` |
| `W` `WW` `GGGG` / `isoWeek()` `isoWeekYear()` | ISO 周 | 不会 | `isoWeek` |
| `YYYY` `MM` `DD` | 自然年/月/日 | 不会 | 内置 |

配对只能同口径：`gggg`+`ww`、`GGGG`+`WW`、`YYYY`+`MM/DD`。
`YYYY-ww`（原写法）和 `gggg-WW` 这类混搭都是错的，例如 `2027-01-01` 用 `YYYY-ww` 会得到
`2027-53` —— 2027 年根本没有第 53 周。

另外 `customParseFormat`（Element Plus 反解析 `v-model` 用的）**只认 `ww`**，不认
`W` / `WW` / `GGGG` / `gggg`；所以 ISO token 只能用于 `format`（展示），不能用于 `value-format`。

## 校验

ISO 周计算已对 2010-01-01 ~ 2040-12-31 做过往返校验：**11323 天 + 1617 个 ISO 周**，
在 `zh-cn`（`weekStart=1`）与 `en`（`weekStart=0`）两套 locale 下结果一致，0 差异；
每个周区间都满足「起始为周一、结束为周日、包含原日期、`format('GGGG-WW')` 回读等于输入」。
