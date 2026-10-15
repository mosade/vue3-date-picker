# vue3-date-picker

Element Plus 日期选择器 Demo：

- **维度选择器**（`PeriodPicker`）：日 / 周 / 月 / 年 随时切换，`v-model` 形如 `{ range: 'year', date: '2026' }`。
- **周选择器**（`WeekPicker`）：一周从**周一**开始，按 **ISO 8601** 计算跨年周，`v-model` 直接是 `"2026-30"`。

## 运行

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # 产物在 dist/
pnpm preview  # 预览构建产物
```

## 组件用法：`v-model` 直接用 ISO 周字符串

```vue
<WeekPicker v-model="week" />   <!-- week === "2026-30" -->
```

`v-model` 的值就是 ISO 周字符串 `"YYYY-WW"`（如 `"2026-30"`、`"2026-53"`），选完即得，
不用再二次格式化，可以直接存库/传参。

| 传进去的值 | 归一化结果 | 该周区间 |
| --- | --- | --- |
| `"2026-30"` | `2026-30` | 2026-07-20 ~ 2026-07-26 |
| `"2026-53"` | `2026-53` | 2026-12-28 ~ 2027-01-03（跨年） |
| `"2026-01"` | `2026-01` | 2025-12-29 ~ 2026-01-04（跨年） |
| `"2026-3"` / `"2026-W30"` / `"2026w30"` | `2026-30` | 同上（宽松输入） |
| `"2026-12-28"` / `Date` / dayjs 对象 | `2026-53` | 取该日期所在的 ISO 周 |
| `"2027-53"` / `"abc"` / `""` / `null` | `""` | 无效或该年没有第 53 周 → 视为空值（dev 下 `console.warn`） |

API（`src/components/WeekPicker.vue`）：

| prop / event | 说明 |
| --- | --- |
| `v-model` | `String`，ISO 周字符串，默认 `''` |
| `display-format` | 输入框展示格式，默认 `"GGGG 年第 WW 周"` |
| `clearable` | 默认 `false` |
| `disabled` / `size` / `placeholder` | 透传给 `el-date-picker` |
| `@change` | 选中变化时触发，参数是归一化后的 ISO 周字符串 |

配套工具函数在 `src/utils/isoWeek.js`：`parseIsoWeek` / `normalizeIsoWeek` / `isoWeekRange` /
`formatIsoWeek` / `weeksInIsoYear`（该模块自己 `dayjs.extend` 依赖的插件，可单独 import）。

## 维度选择器：日 / 周 / 月 / 年

```vue
<PeriodPicker v-model="period" />
// { range: 'day',   date: '2026-07-20' }
// { range: 'week',  date: '2026-30' }
// { range: 'month', date: '2026-07' }
// { range: 'year',  date: '2026' }
```

| 维度 | `date` 格式 | 示例 | 对应区间 |
| --- | --- | --- | --- |
| `day` | `YYYY-MM-DD` | `2026-07-20` | 2026-07-20 ~ 2026-07-20 |
| `week` | `GGGG-WW` | `2026-53` | 2026-12-28 ~ 2027-01-03（跨年） |
| `month` | `YYYY-MM` | `2026-12` | 2026-12-01 ~ 2026-12-31 |
| `year` | `YYYY` | `2026` | 2026-01-01 ~ 2026-12-31 |

### 切换维度时「日期怎么算」

组件里只有一份真状态：`anchor`（你最后停在哪一天）。当前区间永远是「包含 anchor 的那个窗口」
（`period = periodOf(anchor, range)`），是纯派生值 —— 没有第二份状态，也就不会两边打架。

**默认口径下一条规则就够：切维度只是换一个包含 anchor 的窗口，anchor 不动。** 所以任意方向来回切都无损：

| 操作 | 结果 |
| --- | --- |
| 日 `2026-07-20` → 年 → 日 | `2026-07-20` |
| 日 `2026-07-20` → 月 → 周 → 日 | `2026-07` → `2026-30` → `2026-07-20` |
| 日 `2027-01-01` → 周 → 月 → 年 → 日 | `2026-53` → `2027-01` → `2027` → `2027-01-01` |
| 日 `2026-12-30` → 周 → 年 → 日 | `2026-53` → `2026` → `2026-12-30` |

> ⚠️ **别用「区间起点」去归属更粗的维度。** 第一版就是这么写的，被 `2027-01-01` 打回来了：
> 周 `2026-53` 的起点是 2026-12-28，于是 `2027-01-01 → 周 → 月` 得到 `2026-12`、`→ 年` 得到 `2026`，
> 再切回日变成 `2026-01-01`，白丢一整年。根因是「周的 ISO 周年份」和「自然年」本来就可以不一致
> （`2026-53` 覆盖 2027-01-01 ~ 01-03），拿区间起点当归属依据必然出错。

**在面板里点选 / 父组件赋值时**，区间听传入的，`anchor` 投影进新区间：锚点本来就在里面就用它本身，
否则保住更细的信息（`week` 保「周几」、`month` 保「几号」、`year` 保「几月几号」），
保不住的按月长裁到月末（1-31 → 2-28），最后才退回区间起点。

| 面板点选 | 结果 |
| --- | --- |
| 日 `2026-07-20` → 年视图改成 2027 → 日 | `2027-07-20`（保住月日） |
| 日 `2026-01-31` → 月视图选 2026-02 → 日 | `2026-02-28`（31 号裁到月末） |
| 日 `2024-02-29` → 年 2025 → 日 | `2025-02-28`（闰日裁切） |

### 钻取口径 `drillTo`：粗 → 细 时落在区间的哪一天

```vue
<PeriodPicker v-model="period" :drill-to="drillTo" />
```

| `drillTo` | 含义 | 日 `2026-07-20` → 年 → 日 | 日 `2026-07-20` → 周 → 日 | 年 `2026`（今年）→ 日 |
| --- | --- | --- | --- | --- |
| `anchor`（默认） | 记住你原来那天，无损往返 | `2026-07-20` | `2026-07-20` | 你原来那天 |
| `start` | 区间起点 | `2026-01-01` | `2026-07-20`¹ | `2026-01-01` |
| `end` | 区间终点 | `2026-12-31` | `2026-07-26` | `2026-12-31`（未来日期） |
| `today` | 今天在区间里就用今天，否则就近 clamp 到端点 | `2026-10-15` | `2026-07-26` | `2026-10-15` |

¹ `start` 只有在那天正好是区间起点时才「无损」：日 `2026-07-23`（周四）→ 周 → 日 会得到 `2026-07-20`。

⚠️ `end` 的两个已知坑（demo 里可以直接切着看）：

- **当年包含今天时会定位到未来的 `12-31`**（年 `2026` → 日 = `2026-12-31`），筛选默认值给未来日期一般不合适；
- **最常见的「选一天 → 看这一周 → 回到那一天」会漂**：日 `2026-12-30` → 周 → 日 变成 `2027-01-03`，还跨了年。

`start` / `end` / `today` 只影响**落点**，不影响**归属**：变粗永远以锚点为准，
否则跨年周会把 `2027-01-01` 一路拉回 2026（见上面的 ⚠️）。四套口径的实测数据在
`PeriodPickerDemo.vue` 顶部的「钻取口径」开关里可以直接切换对比。

配套工具函数在 `src/utils/period.js`：`periodOf` / `parsePeriod` / `formatPeriod` / `projectDay` /
`anchorFor` / `isCoarser` / `RANGES` / `RANGE_LABELS` / `PERIOD_FORMAT` / `DRILL_MODES` /
`DRILL_MODE_LABELS`。`PeriodPickerDemo.vue` 里有一份
「切换轨迹」的可视化，改规则时可以直接对着看每次切换算成了什么。

## 为什么不能用 `value-format="YYYY-ww"`

Element Plus 用 dayjs 的 **locale 周**（`w` / `ww`）来格式化周，同时 `YYYY` 是自然年。
这两个 token 组合起来在跨年周会算错：

| 点击的周 | ISO 8601 | `YYYY-ww` 的输出 |
| --- | --- | --- |
| 2026-12-28 ~ 2027-01-03 | 2026-W53 | `2026-01` ❌（年尾跨年周会回绕成第 1 周） |

于是 `v-model` 拿到 `2026-01`，再反解就变成了 2025-12-29 ~ 2026-01-04，UI 与选择结果完全错位。

## 正确做法

1. 组件内部用 `value-format="YYYY-MM-DD"` 当「日期 ↔ ISO 周」的桥接：Element Plus 吐回来的是一个
   普通日期（周一），`WeekPicker.vue` 再换算成 ISO 周字符串吐给 `v-model`。**不要**用 ISO token
   当 `value-format`（见下文「token 速查」）。
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
4. `src/utils/isoWeek.js` 里的 ISO 周计算全部走 dayjs 的 `isoWeek` 系列：
   - 取 ISO 周：`dayjs(v).format('GGGG-WW')`（等价 `isoWeekYear()` + `isoWeek()`）
   - 取起止：`startOf('isoWeek')` / `endOf('isoWeek')`，周几用 `isoWeekday()`（1=周一 … 7=周日）
   - 由 `"2026-53"` 推日期：`dayjs(new Date(y, 0, 4)).startOf('isoWeek').add(w - 1, 'week')`。
     ⚠️ `isoWeekYear()` **只有 getter 没有 setter**（传参会被忽略），所以不能写
     `dayjs().isoWeekYear(y).isoWeek(w)`，只能从「1 月 4 日必定属于第 1 周」这个锚点推导。
   - ⚠️ 绝不能让 dayjs 直接解析 `"2026-30"`：它会被当成「2026 年 30 月」得到 `2028-06-01`。
     所以 `parseIsoWeek` 先用正则把「周字符串」和「日期字符串」分流，只有日期分支才交给 dayjs。

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

- ISO 周计算对 2010-01-01 ~ 2040-12-31 做了**逐日对拍**：11323 天 / 1619 个 ISO 周，与一个
  独立的纯 `Date` 参考实现 0 差异；每个周区间都满足「起始为周一、结束为周日、跨度 6 天、
  包含原日期、`format('GGGG-WW')` 回读等于输入」。
- 1990 ~ 2060 每年周数与参考实现一致（52/53 年判定）。
- 21 个宽松/非法输入用例（含 `"2026-3"`、`"2026-W30"`、`"2027-53"`、Date、非法 Date）全部符合预期。
- 界面实测：点击跨年周行 `2026-12-28 ~ 2027-01-03` → `v-model` 得到 `"2026-53"`（不是 `"2026-01"`）；
  程序赋值 `"2027-01"` → 输入框显示「2027 年第 01 周」、区间 2027-01-04 ~ 2027-01-10。
- 维度切换：把 `PeriodPicker.vue` 的状态机搬到测试脚本里跑了 A~J 共 10 组断言（往返无损、
  跨年周归属、月末/闰日裁切、四种维度的 parse-format 往返、非法输入拒绝），全部通过。
  其中 I 是**属性测试**：14 个锚点 × 8 条乱序切换路线，「日 → 任意粗 → 日」必须回到同一天，
  且任何时刻区间都必须包含锚点（这条正是 `2027-01-01` 那个 bug 的回归用例）。
- 钻取口径：K~R 共 8 组断言覆盖 `anchor` / `start` / `end` / `today` 四种口径的落点，
  以及两条必须成立的底线 ——「变粗永远以锚点为准」（四种口径下 `2027-01-01 → 周 → 月` 都是 `2027-01`）、
  「任何口径下区间恒含锚点」。口径带来的位置丢失也逐条记录下来，不做隐藏。
  界面侧也按同一批链路实测过一遍，控制台无 error/warning。
