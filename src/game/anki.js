// Spaced repetition for sweater numbers, scheduled the way Anki's SM-2 does:
// each card carries an ease factor and an interval in days, and a rating
// stretches or resets them. Progress lives in localStorage under chdle:anki.
import { localDateString } from './state.js'

const KEY = 'chdle:anki'
export const NEW_PER_DAY = 8
const MIN_EASE = 1.3

export const RATINGS = [
  { key: 'again', label: 'Again' },
  { key: 'hard', label: 'Hard' },
  { key: 'good', label: 'Good' },
  { key: 'easy', label: 'Easy' },
]

export function loadDeck() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    return d && d.cards ? d : { cards: {}, log: {} }
  } catch {
    return { cards: {}, log: {} }
  }
}

export function saveDeck(deck) {
  localStorage.setItem(KEY, JSON.stringify(deck))
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// A card that has never been reviewed. Interval 0 keeps it in today's queue.
function fresh() {
  return { ease: 2.5, interval: 0, due: null, reps: 0, lapses: 0, seen: 0, correct: 0 }
}

// What each rating would do to the card, so the buttons can show the wait.
export function preview(card = fresh()) {
  const c = card
  const learning = c.interval === 0
  return {
    again: 0,
    hard: learning ? 1 : Math.max(1, Math.round(c.interval * 1.2)),
    good: learning ? 1 : Math.max(c.interval + 1, Math.round(c.interval * c.ease)),
    easy: learning ? 4 : Math.max(c.interval + 2, Math.round(c.interval * c.ease * 1.3)),
  }
}

export function rate(deck, name, rating, wasCorrect, today = localDateString()) {
  const c = { ...(deck.cards[name] ?? fresh()) }
  const days = preview(c)[rating]
  c.seen += 1
  if (wasCorrect) c.correct += 1
  if (rating === 'again') {
    c.ease = Math.max(MIN_EASE, c.ease - 0.2)
    if (c.interval > 0) c.lapses += 1
    c.interval = 0
    c.due = today
  } else {
    if (rating === 'hard') c.ease = Math.max(MIN_EASE, c.ease - 0.15)
    if (rating === 'easy') c.ease += 0.15
    c.interval = days
    c.due = addDays(today, days)
    c.reps += 1
  }
  deck.cards[name] = c
  const log = deck.log[today] ?? { reviews: 0, correct: 0, introduced: 0 }
  log.reviews += 1
  if (wasCorrect) log.correct += 1
  deck.log[today] = log
  return c
}

export function markIntroduced(deck, today = localDateString()) {
  const log = deck.log[today] ?? { reviews: 0, correct: 0, introduced: 0 }
  log.introduced += 1
  deck.log[today] = log
}

export function introducedToday(deck, today = localDateString()) {
  return deck.log[today]?.introduced ?? 0
}

// New cards arrive most-experienced first: the regulars you see every game are
// the numbers worth knowing before the call-ups.
export function unseenPlayers(deck, players) {
  return players
    .filter(p => !deck.cards[p.name])
    .sort((a, b) => b.nhlGames - a.nhlGames || a.name.localeCompare(b.name))
}

// Due cards first, oldest due at the front; then new cards up to the daily cap.
export function buildQueue(deck, players, today = localDateString()) {
  const due = []
  for (const p of players) {
    const c = deck.cards[p.name]
    if (c && c.due <= today) due.push([c.due, p])
  }
  const fresh = unseenPlayers(deck, players)
  due.sort((a, b) => a[0].localeCompare(b[0]))
  const room = Math.max(0, NEW_PER_DAY - introducedToday(deck, today))
  return { due: due.map(x => x[1]), fresh: fresh.slice(0, room), unseen: fresh.length }
}

export function deckStats(deck, players, today = localDateString()) {
  let learned = 0
  let mature = 0
  let due = 0
  let seen = 0
  let correct = 0
  for (const p of players) {
    const c = deck.cards[p.name]
    if (!c) continue
    learned += 1
    if (c.interval >= 21) mature += 1
    if (c.due <= today) due += 1
    seen += c.seen
    correct += c.correct
  }
  return {
    learned, mature, due, total: players.length,
    unseen: players.length - learned,
    retention: seen ? Math.round((correct / seen) * 100) : null,
    today: deck.log[today] ?? { reviews: 0, correct: 0, introduced: 0 },
  }
}

export function resetDeck() {
  localStorage.removeItem(KEY)
  return { cards: {}, log: {} }
}
