// 把最新 NSIS 安装包复制到项目根 release/（desktop:build 成功后自动调用）
// 免去在 src-tauri/target/release/bundle/nsis/ 深层目录里翻找产物
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'

const root = join(import.meta.dirname, '..')
const nsisDir = join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
const outDir = join(root, 'release')

const installers = readdirSync(nsisDir)
  .filter((f) => f.endsWith('.exe'))
  .map((f) => ({ name: f, mtime: statSync(join(nsisDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)

if (installers.length === 0) {
  console.error(`[copy-installer] 未找到安装包：${nsisDir}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
for (const old of readdirSync(outDir).filter((f) => f.endsWith('.exe'))) {
  rmSync(join(outDir, old), { force: true })
}
const latest = installers[0].name
copyFileSync(join(nsisDir, latest), join(outDir, latest))
console.log(`[copy-installer] 安装包已复制到 ${join(outDir, latest)}`)
