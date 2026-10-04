/**
 * 位置接力：位置码的编解码（纯函数模块，UI 无关，两台设备的同一份代码互为"密码本"）。
 *
 * 短码结构：版本(1) + 指纹(3) + 位置(2~4，最小长度) + 校验(2)，字母表为 Crockford Base32。
 * 典型形如 `1-7K2-3QT-9M`。
 *
 * - 指纹 = FNV-1a(文件长度 + 文件前 64KB) 取 15 bits。**基于文件字节**，不依赖书名/元数据解析：
 *   同一份 EPUB 在任何设备上算出来都一样；文件有任何不同（重新下载、另一版本）必不同。
 * - 位置 = epub.js 定位点（locations）序号。定位点按书文本内容生成、与排版无关，
 *   同一文件在两台设备上"序号 ↔ 文本"的对应关系完全一致。
 * - 校验 = 对 (版本 + 指纹 + 位置) 加权和的低 10 bits。载荷长度 ≤ 8 位时，
 *   单字符抄错、相邻两位对调都必然被检出（加权和后误差 < 1024）。
 *
 * 解码宽容：忽略大小写/连字符/空格，O→0，I/L→1（Crockford 惯例）。
 * 版本不符 → 'version'；校验不过 → 'checksum'；形态不符 → 'format'。绝不"猜着解"。
 */

export const RELAY_VERSION = '1'
export const RELAY_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export type RelayCodeError = 'format' | 'version' | 'checksum'

export interface RelayCodePayload {
  fingerprint: string
  locationIndex: number
}

function charValue(ch: string): number {
  return RELAY_CODE_ALPHABET.indexOf(ch)
}

/** value（非负整数）编码为 base32，至少 minDigits 位（左侧补 '0'） */
function encodeValue(value: number, minDigits: number): string {
  let v = Math.max(0, Math.floor(value))
  let out = ''
  do {
    out = RELAY_CODE_ALPHABET[v % 32] + out
    v = Math.floor(v / 32)
  } while (v > 0)
  while (out.length < minDigits) out = '0' + out
  return out
}

function decodeValue(digits: string): number {
  let value = 0
  for (const ch of digits) {
    value = value * 32 + charValue(ch)
  }
  return value
}

/** 归一化：大写、去非字母数字、宽容字符映射（O→0，I/L→1） */
function normalize(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

function checksum(payload: string): string {
  let sum = 0
  for (let i = 0; i < payload.length; i++) {
    sum += (charValue(payload[i]) + 1) * (i + 1)
  }
  return encodeValue(sum % 1024, 2)
}

/**
 * 书指纹（3 位）：文件字节长度 + 文件前 64KB 的 FNV-1a，取低 15 bits。
 * head 传入文件开头切片即可；短文件全给。
 */
export function makeFingerprint(fileSize: number, head: Uint8Array): string {
  let h = 0x811c9dc5
  const mix = (b: number) => {
    h ^= b
    h = Math.imul(h, 0x01000193) >>> 0
  }
  for (let i = 0; i < 4; i++) mix((fileSize >>> (i * 8)) & 0xff)
  const n = Math.min(head.length, 65536)
  for (let i = 0; i < n; i++) mix(head[i])
  return encodeValue(h & 0x7fff, 3)
}

/** 编码短码（显示形如 `1-7K2-3QT-9M`） */
export function encodeRelayCode(fingerprint: string, locationIndex: number): string {
  const fp = fingerprint.toUpperCase()
  const pos = encodeValue(locationIndex, 2)
  const payload = RELAY_VERSION + fp + pos
  return `${RELAY_VERSION}-${fp}-${pos}-${checksum(payload)}`
}

/** 解码短码（可传整段文本里的疑似 token，归一化后长度 8~10 才算数） */
export function decodeRelayCode(
  raw: string,
): { ok: true; payload: RelayCodePayload } | { ok: false; reason: RelayCodeError } {
  const norm = normalize(raw)
  if (norm.length < 8 || norm.length > 10) return { ok: false, reason: 'format' }
  for (const ch of norm) {
    if (charValue(ch) < 0) return { ok: false, reason: 'format' }
  }
  const version = norm[0]
  const fingerprint = norm.slice(1, 4)
  const posLen = norm.length - 6 // 总长 8~10 → 位置 2~4 位
  const pos = norm.slice(4, 4 + posLen)
  const ck = norm.slice(4 + posLen)
  if (version !== RELAY_VERSION) return { ok: false, reason: 'version' }
  if (checksum(version + fingerprint + pos) !== ck) return { ok: false, reason: 'checksum' }
  return { ok: true, payload: { fingerprint, locationIndex: decodeValue(pos) } }
}

export interface RelayParseResult {
  /** 校验/版本都通过的短码 */
  shortcode?: RelayCodePayload
  /** 形态像短码但没过校验（仅在没有任何其他可识别信息时用于报错） */
  shortcodeError?: RelayCodeError
  /** epubcfi(...) */
  cfi?: string
  /** 0~100 */
  percent?: number
  /** 《书名》 */
  title?: string
}

/**
 * 解析一段输入（整卡 / 短码 / 百分比 / 随便什么），按"能认出多少认多少"收集字段。
 * 优先级与校验交给调用方：shortcode → cfi → percent，都没有再用 shortcodeError / title 报错。
 */
export function parseRelayInput(raw: string): RelayParseResult {
  const result: RelayParseResult = {}
  const text = raw.trim()
  if (!text) return result

  const titleMatch = text.match(/《([^》]+)》/)
  if (titleMatch) result.title = titleMatch[1].trim()

  const cfiMatch = text.match(/epubcfi\(([^)]*)\)/)
  if (cfiMatch) result.cfi = `epubcfi(${cfiMatch[1]})`

  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/)
  if (pctMatch) result.percent = Number(pctMatch[1])
  else if (/^\d+(?:\.\d+)?$/.test(text)) result.percent = Number(text) // 裸数字按百分数理解

  // 短码：按 token 扫（字母数字+连字符），只对"长度像、且含数字"的候选做解码尝试。
  // 含数字是必要门：合法短码第一位是版本号 '1'；纯字母的英文单词（如 CHAPTERS）不该被当成码。
  const tokens = text.split(/[^0-9A-Za-z-]+/).filter(Boolean)
  let firstError: RelayCodeError | undefined
  for (const token of tokens) {
    const compact = normalize(token)
    if (compact.length < 8 || compact.length > 10) continue
    if (!/\d/.test(compact)) continue
    const decoded = decodeRelayCode(token)
    if (decoded.ok) {
      result.shortcode = decoded.payload
      break
    }
    if (!firstError && (decoded.reason === 'version' || decoded.reason === 'checksum')) {
      firstError = decoded.reason
    }
  }
  if (!result.shortcode && firstError) result.shortcodeError = firstError

  return result
}
