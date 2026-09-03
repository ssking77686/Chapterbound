// 把最新 debug APK 复制到项目根 release/ 并带版本号重命名（android:build 成功后自动调用）
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs'
import { join } from 'path'

const root = join(import.meta.dirname, '..')
const apkDir = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug')
const outDir = join(root, 'release')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

const apks = readdirSync(apkDir)
  .filter((f) => f.endsWith('.apk'))
  .map((f) => ({ name: f, mtime: statSync(join(apkDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)

if (apks.length === 0) {
  console.error(`[copy-apk] 未找到 APK：${apkDir}`)
  process.exit(1)
}

const target = `Chapterbound_${version}_debug.apk`
mkdirSync(outDir, { recursive: true })
for (const old of readdirSync(outDir).filter((f) => f.endsWith('.apk'))) {
  rmSync(join(outDir, old), { force: true })
}
copyFileSync(join(apkDir, apks[0].name), join(outDir, target))
console.log(`[copy-apk] APK 已复制到 ${join(outDir, target)}`)
