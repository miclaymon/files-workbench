// Time/duration formatting helpers, mainly for notifications.
// `<time datetime>` wants an ISO 8601 string; the visible text is human-friendly.

// Elapsed ms → ISO 8601 duration ("PT2H30M", "P1D", "PT0S"). Rounds to seconds.
export function isoDuration(ms) {
  let s = Math.max(0, Math.round(ms / 1000))
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  const date = d ? `${d}D` : ''
  let time = ''
  if (h) time += `${h}H`
  if (m) time += `${m}M`
  if (s || (!date && !time)) time += `${s}S`
  return `P${date}${time ? 'T' + time : ''}`
}

// Elapsed ms → "just now" / "30s ago" / "2h 30m ago" (up to two units).
export function humanAgo(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60), rs = s % 60
  if (m < 60) return rs ? `${m}m ${rs}s ago` : `${m}m ago`
  const h = Math.floor(m / 60), rm = m % 60
  if (h < 24) return rm ? `${h}h ${rm}m ago` : `${h}h ago`
  const d = Math.floor(h / 24), rh = h % 24
  return rh ? `${d}d ${rh}h ago` : `${d}d ago`
}

// Sub-second-aware ISO duration for operation timings ("PT0.142S", "PT1.5S").
export function isoDurationMs(ms) {
  if (ms == null) return undefined
  return `PT${(ms / 1000)}S`
}

// Operation duration → "142 ms" / "1.50 s".
export function humanDurationMs(ms) {
  if (ms == null) return ''
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`
}

// Absolute timestamp → { iso, label } for a clock-time <time> element.
export function clockTime(ts) {
  if (ts == null) return { iso: undefined, label: '' }
  const date = new Date(ts)
  return { iso: date.toISOString(), label: date.toLocaleTimeString() }
}
