// Vite 允许省略 .js 后缀，Node ESM 不允许；测试脚本里统一补上。
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (specifier.startsWith('dayjs/') || specifier.startsWith('./') || specifier.startsWith('../')) {
      return nextResolve(`${specifier}.js`, context)
    }
    throw err
  }
}
