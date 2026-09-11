// Daily selection, persistence, stats.
const EPOCH = '2026-09-11' // daily #1

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function localDateString(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dailyNumber(dateStr = localDateString()) {
  const ms = new Date(dateStr) - new Date(EPOCH)
  return Math.round(ms / 86400000) + 1
}

export function dailyIndex(count, dateStr = localDateString()) {
  return hashString('chdle:' + dateStr) % count
}

export function randomIndex(count, avoid = -1) {
  let i = Math.floor(Math.random() * count)
  if (count > 1 && i === avoid) i = (i + 1) % count
  return i
}

export function msUntilMidnight() {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next - now
}

const KEY = 'chdle'

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(`${KEY}:${key}`))
    return v ?? fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  localStorage.setItem(`${KEY}:${key}`, JSON.stringify(value))
}

// Guesses are only meaningful against the answer they were made on, and the
// answer depends on the roster scope, so today's boards are kept per scope.
function scopeKey(scope) {
  return scope || '*'
}

function loadDailyBoards() {
  const all = load('daily', null)
  if (!all || all.date !== localDateString() || !all.boards) {
    return { date: localDateString(), boards: {} }
  }
  return all
}

export function loadDailyState(scope) {
  const s = loadDailyBoards().boards[scopeKey(scope)]
  return s ?? { date: localDateString(), scope, guesses: [], won: false }
}

export function saveDailyState(s) {
  const all = loadDailyBoards()
  all.boards[scopeKey(s.scope)] = s
  save('daily', all)
}

// null = full camp roster
export function loadScope() {
  return load('scope', null)
}

export function saveScope(scope) {
  save('scope', scope)
}

// One account serves every Dle game: the sites share an origin and a players
// table, so the token lives under a common key.
const ACCOUNT_KEY = 'dle:account'

export function loadAccount() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) ?? null
  } catch {
    return null
  }
}

export function saveAccount(account) {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  else localStorage.removeItem(ACCOUNT_KEY)
}

export function loadPromptedDay() {
  return load('promptedDay', null)
}

export function savePromptedDay(day) {
  save('promptedDay', day)
}

// Stored as exclusions so players added to the roster later default to in.
export function loadExcluded() {
  return new Set(load('excluded', []))
}

export function saveExcluded(set) {
  save('excluded', [...set])
}

function emptyMode() {
  return { played: 0, wins: 0, guesses: 0, tries: {}, guessed: {} }
}

function normalizeMode(m) {
  return { ...emptyMode(), ...(m || {}), tries: { ...(m?.tries || {}) }, guessed: { ...(m?.guessed || {}) } }
}

export function loadStats() {
  const raw = load('stats', null)
  const classicExtras = { streak: 0, maxStreak: 0, lastWinDate: null, lastPlayedDate: null }
  if (!raw) {
    return { classic: { ...emptyMode(), ...classicExtras }, practice: emptyMode() }
  }
  return {
    classic: {
      ...classicExtras,
      ...normalizeMode(raw.classic),
      streak: raw.classic?.streak ?? 0,
      maxStreak: raw.classic?.maxStreak ?? 0,
      lastWinDate: raw.classic?.lastWinDate ?? null,
      lastPlayedDate: raw.classic?.lastPlayedDate ?? null,
    },
    practice: normalizeMode(raw.practice),
  }
}

export function recordGuess(mode, name) {
  const stats = loadStats()
  const m = stats[mode]
  m.guesses += 1
  m.guessed[name] = (m.guessed[name] || 0) + 1
  // A classic game is one per calendar day however many times the board resets.
  if (mode === 'classic') {
    const today = localDateString()
    if (m.lastPlayedDate !== today) {
      m.played += 1
      m.lastPlayedDate = today
    }
  }
  save('stats', stats)
  return stats
}

export function recordPracticeStart() {
  const stats = loadStats()
  stats.practice.played += 1
  save('stats', stats)
  return stats
}

export function recordWin(mode, numGuesses) {
  const stats = loadStats()
  const m = stats[mode]
  if (mode === 'classic') {
    const today = localDateString()
    // Already credited today — a second win (e.g. after changing the scope)
    // must not inflate wins or the streak.
    if (m.lastWinDate === today) return stats
    m.streak = m.lastWinDate === localDateString(-1) ? m.streak + 1 : 1
    m.maxStreak = Math.max(m.maxStreak, m.streak)
    m.lastWinDate = today
  }
  m.wins += 1
  m.tries[numGuesses] = (m.tries[numGuesses] || 0) + 1
  save('stats', stats)
  return stats
}

// A streak is only live if the last win was today or yesterday; any longer gap
// breaks it, regardless of how many wins came before.
export function currentStreak() {
  const { classic } = loadStats()
  if (classic.lastWinDate === localDateString() || classic.lastWinDate === localDateString(-1)) {
    return classic.streak
  }
  return 0
}
