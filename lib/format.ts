/**
 * 日本円を「億+万」の複合表記でフォーマットする
 * 例: 142,800,000 -> "¥1億4280万"
 */
export function formatJPYCompound(value: number): string {
  if (!Number.isFinite(value)) return '¥0'

  const isNegative = value < 0
  const absValue = Math.floor(Math.abs(value))

  const OKU = 100_000_000
  const MAN = 10_000

  let result: string

  if (absValue >= OKU) {
    const oku = Math.floor(absValue / OKU)
    const remainderAfterOku = absValue % OKU
    const man = Math.floor(remainderAfterOku / MAN)
    result = man > 0 ? `${oku}億${man}万` : `${oku}億`
  } else if (absValue >= MAN) {
    const man = Math.floor(absValue / MAN)
    result = `${man}万`
  } else {
    result = absValue.toLocaleString('ja-JP')
  }

  return `${isNegative ? '-' : ''}¥${result}`
}

/**
 * +/- の符号付き表示用（Day P&L など）
 * 例: +¥326万, -¥7億8400万, ¥0
 */
export function formatJPYCompoundSigned(value: number): string {
  if (value === 0) return formatJPYCompound(0)
  const formatted = formatJPYCompound(value)
  return value > 0 ? `+${formatted}` : formatted
}
