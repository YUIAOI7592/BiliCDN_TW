/** Declared content metadata only; never a playback or route capability. */
export function declaredFrameRate(value: unknown): number | undefined {
  let rate: number
  if (typeof value === 'number') rate = value
  else if (typeof value === 'string' && value.length <= 64) {
    const text = value.trim()
    if (/^\d+(?:\.\d+)?$/.test(text)) rate = Number(text)
    else {
      const match = /^(\d+)\/(\d+)$/.exec(text)
      if (!match) return undefined
      const numerator = Number(match[1]),
        denominator = Number(match[2])
      if (
        !Number.isSafeInteger(numerator) ||
        !Number.isSafeInteger(denominator) ||
        denominator <= 0
      )
        return undefined
      rate = numerator / denominator
    }
  } else return undefined
  return Number.isFinite(rate) && rate > 0 ? rate : undefined
}
