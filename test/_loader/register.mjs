// 让 Node 的 ESM 解析器接受 Vite 里惯用的「省略 .js 后缀」写法。
// 用法：node --import ./test/_loader/register.mjs test/xxx.mjs
import { register } from 'node:module'

register('./resolve-hook.mjs', import.meta.url)
