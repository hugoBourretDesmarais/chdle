// Spaced repetition measured in cards instead of days: every rating sets how
// many other cards go by before this one returns, so a session never runs dry.
// Ease grows with Good/Easy and shrinks with Again/Hard, like Anki's SM-2.

export const DECKS = { numbers: 'chdle:anki', logos: 'chdle:anki:logos' }
const MIN_EASE = 1.3

export const RATINGS = [
  { key: 'again', label: 'Again' },
  { key: 'hard', label: 'Hard' },
  { key: 'good', label: 'Good' },
  { key: 'easy', label: 'Easy' },
]

function empty() {
  return { v: 2, step: 0, cards: {} }
}

// v1 decks counted days; a day becomes five cards so earlier progress carries over.
function migrate(d) {
  const out = empty()
  for (const [name, c] of Object.entries(d.cards ?? {})) {
    const gap = Math.round((c.interval ?? 0) * 5)
    out.cards[name] = {
      ease: c.ease ?? 2.5, gap, due: gap, seen: c.seen ?? 0, correct: c.correct ?? 0, lapses: c.lapses ?? 0,
    }
  }
  return out
}

export function loadDeck(key = DECKS.numbers) {
  try {
    const d = JSON.parse(localStorage.getItem(key))
    if (!d?.cards) return empty()
    return d.v === 2 ? d : migrate(d)
  } catch {
    return empty()
  }
}

export function saveDeck(deck, key = DECKS.numbers) {
  localStorage.setItem(key, JSON.stringify(deck))
}

export function resetDeck(key = DECKS.numbers) {
  localStorage.removeItem(key)
  return empty()
}

function fresh() {
  return { ease: 2.5, gap: 0, due: 0, seen: 0, correct: 0, lapses: 0 }
}

// Cards that go by before this one comes back, for each rating.
// A gap past a few trips through the deck only reorders cards, so it is capped.
export function preview(card = fresh(), size = Infinity) {
  const g = Math.min(card.gap, size * 3)
  const raw = g === 0
    ? { again: 2, hard: 4, good: 8, easy: 16 }
    : {
      again: 2,
      hard: Math.max(3, Math.round(g * 1.2)),
      good: Math.max(g + 2, Math.round(g * card.ease)),
      easy: Math.max(g + 4, Math.round(g * card.ease * 1.3)),
    }
  for (const k in raw) raw[k] = Math.min(raw[k], size * 3)
  return raw
}

export function rate(deck, name, rating, wasCorrect, size = Infinity) {
  const c = { ...(deck.cards[name] ?? fresh()) }
  const gap = preview(c, size)[rating]
  c.seen += 1
  if (wasCorrect) c.correct += 1
  if (rating === 'again') {
    c.ease = Math.max(MIN_EASE, c.ease - 0.2)
    if (c.gap > 0) c.lapses += 1
  } else if (rating === 'hard') {
    c.ease = Math.max(MIN_EASE, c.ease - 0.15)
  } else if (rating === 'easy') {
    c.ease += 0.15
  }
  deck.step += 1
  c.gap = rating === 'again' ? 0 : gap
  c.due = deck.step + gap
  deck.cards[name] = c
  return c
}

// New cards arrive most-experienced first; teams fall back to their preset order.
export function unseenPlayers(deck, items) {
  return items
    .filter(p => !deck.cards[p.name])
    .sort((a, b) => (b.nhlGames ?? 0) - (a.nhlGames ?? 0)
      || (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

// The most overdue card if one is ready, else a new card, else whichever
// comes back soonest. Never the same card twice in a row when there's a choice.
export function nextCard(deck, items, avoid = null) {
  let top = null
  for (const p of items) {
    const c = deck.cards[p.name]
    if (!c || p.name === avoid) continue
    if (!top || c.due < deck.cards[top.name].due) top = p
  }
  if (top && deck.cards[top.name].due <= deck.step) return top
  const unseen = unseenPlayers(deck, items)
  if (unseen.length) return unseen.find(p => p.name !== avoid) ?? unseen[0]
  return top ?? items.find(p => p.name === avoid) ?? null
}

// How many other cards really show before this one returns with the given gap,
// replaying nextCard's order without the ratings those cards will get.
export function cardsUntil(deck, items, name, gap) {
  const back = deck.step + 1 + gap
  const dues = items.filter(p => p.name !== name && deck.cards[p.name]).map(p => deck.cards[p.name].due)
  dues.sort((a, b) => a - b)
  let unseen = items.filter(p => p.name !== name && !deck.cards[p.name]).length
  let shown = 0
  const others = dues.length + unseen
  for (let t = deck.step + 1; ; t++) {
    const head = dues.length ? dues[0] : Infinity
    if (head <= t && head < back) dues.shift()
    else if (back <= t && (shown || !others)) return shown
    else if (unseen) unseen -= 1
    else if (head < back) dues.shift()
    else if (shown || !others) return shown
    else dues.shift()
    shown += 1
  }
}

export function deckStats(deck, items) {
  let learned = 0
  let mature = 0
  let due = 0
  let seen = 0
  let correct = 0
  for (const p of items) {
    const c = deck.cards[p.name]
    if (!c) continue
    learned += 1
    if (c.gap >= items.length) mature += 1
    if (c.due <= deck.step) due += 1
    seen += c.seen
    correct += c.correct
  }
  return {
    learned, mature, due, total: items.length,
    unseen: items.length - learned,
    retention: seen ? Math.round((correct / seen) * 100) : null,
  }
}

export function fmtGap(n) {
  return n === 1 ? '1 card' : `${n} cards`
}
