// husky is a devDependency: skip the hook setup when it was not installed (npm ci --omit=dev).
const husky = await import('husky').then((m) => m.default, (error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return null
  throw error
})
if (husky) process.stdout.write(husky())
