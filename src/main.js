import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import dayjs from 'dayjs'
// Element Plus 的周面板依赖 dayjs 的 locale 来决定一周从哪天开始：
// 不加载语言包时 .locale('zh-cn') 会静默回退到英文（周日开头），周选择和 ISO 周就会错位。
import 'dayjs/locale/zh-cn'
// ISO 周 token（GGGG / WW）所需的插件，Element Plus 只注册了 locale 周（ww / gggg）。
import isoWeek from 'dayjs/plugin/isoWeek'
// 显式注册 advancedFormat（GGGG / WW 这些 token 由它渲染），不再依赖 Element Plus 内部顺手注册。
import advancedFormat from 'dayjs/plugin/advancedFormat'
// dayjs.updateLocale 在 dayjs 1.11 里是独立插件。
import updateLocale from 'dayjs/plugin/updateLocale'
import 'element-plus/dist/index.css'

import App from './App.vue'

dayjs.extend(isoWeek)
dayjs.extend(advancedFormat)
dayjs.extend(updateLocale)
// 以下两行分工不同：
// - 真正让 Element Plus 周面板从周一开头的是「语言包已注册」+「weekStart: 1」（updateLocale 那两行）；
//   Element Plus 会自己给面板实例 .locale('zh-cn')，所以下面这行 dayjs.locale() 不是必须的。
// - 它的作用只是把全局默认 locale 设成中文（例如 dayjs().format('MMMM') 得到「十月」），
//   与 ISO 周计算无关，删掉不影响本 demo 的周逻辑。
dayjs.locale('zh-cn')

// 一周从周一开始：显式写死，避免语言包缺失时静默变成周日开头。
dayjs.updateLocale('zh-cn', { weekStart: 1 })
dayjs.updateLocale('en', { weekStart: 1 })

createApp(App).use(ElementPlus, { locale: zhCn }).mount('#app')
