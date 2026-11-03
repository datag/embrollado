/**
 * ISO-like timestamp formatting for the debug panel (YYYY-MM-DD HH:MM:SS, local time, zero-padded).
 * Local time is used (not UTC) so the log reads naturally in the user's timezone; the format is
 * fixed and locale-independent so the column stays aligned.
 */

export function formatTimestamp(ms: number): string {
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}
