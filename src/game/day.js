export function montrealDay(now = new Date(), offset = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = key => parts.find(p => p.type === key).value
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function nextReset(now = new Date()) {
  const day = montrealDay(now)
  let lo = now.getTime(), hi = lo + 26 * 3600000
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (montrealDay(new Date(mid)) === day) lo = mid
    else hi = mid
  }
  return hi
}
