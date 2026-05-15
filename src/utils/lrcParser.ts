
export interface LrcLine {
  time: number
  text: string
}

const META_TAG =
  /^\[(ar|ti|al|by|offset|length|re|ve|tool|hash|sign):/i

function parseTimestamp(min: string, sec: string, frac?: string): number {
  const m = parseInt(min, 10)
  const s = parseInt(sec, 10)
  let extra = 0
  if (frac !== undefined && frac !== '') {
    if (frac.length === 2) extra = parseInt(frac, 10) / 100
    else extra = parseInt(frac.padEnd(3, '0').slice(0, 3), 10) / 1000
  }
  return m * 60 + s + extra
}

export function parseLrc(raw: string): LrcLine[] {
  const text = raw.replace(/^\uFEFF/, '')
  const out: LrcLine[] = []

  for (const row of text.split(/\r?\n/)) {
    const line = row.trim()
    if (!line) continue
    if (META_TAG.test(line)) continue

    const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
    const parts: { time: number; endIdx: number }[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      parts.push({
        time: parseTimestamp(m[1], m[2], m[3]),
        endIdx: m.index + m[0].length,
      })
    }
    if (parts.length === 0) continue

    const lastEnd = parts[parts.length - 1].endIdx
    const lyricText = line.slice(lastEnd).trim()
    if (!lyricText) continue

    for (const p of parts) {
      out.push({ time: p.time, text: lyricText })
    }
  }

  out.sort((a, b) => a.time - b.time || a.text.localeCompare(b.text))
  return out
}

export function findActiveLrcIndex(lines: LrcLine[], t: number): number {
  if (lines.length === 0) return -1
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= t) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}
