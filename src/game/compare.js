export const COLUMNS = [
  { key: 'portrait', label: 'Player' },
  { key: 'position', label: 'Position' },
  { key: 'shoots', label: 'Shoots' },
  { key: 'country', label: 'Country' },
  { key: 'number', label: 'Number' },
  { key: 'age', label: 'Age' },
  { key: 'height', label: 'Height' },
  { key: 'draft', label: 'Draft' },
  { key: 'salary', label: 'Cap hit' },
  { key: 'since', label: 'With CH since' },
]

export const POSITION_NAMES = { C: 'Centre', LW: 'Left wing', RW: 'Right wing', D: 'Defence', G: 'Goalie' }
const FORWARDS = new Set(['C', 'LW', 'RW'])

// Roster scopes stand in for the other games' spoiler limit: the daily answer,
// suggestions and roster all narrow to the scope, and players on the same scope
// share the same daily player.
export const SCOPES = [
  { key: 'nhl', label: 'NHL veterans only', hint: 'players with at least one NHL game', test: p => p.nhlGames > 0 },
]

export function inScope(p, scope) {
  if (!scope) return true
  const s = SCOPES.find(x => x.key === scope)
  return s ? s.test(p) : true
}

export function scopeLabel(scope) {
  return SCOPES.find(x => x.key === scope)?.label ?? null
}

export function ageOn(birthDate, today = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number)
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1
  return age
}

export function decorate(p) {
  return { ...p, age: ageOn(p.birthDate) }
}

function positionResult(guess, answer) {
  if (guess === answer) return 'exact'
  if (FORWARDS.has(guess) && FORWARDS.has(answer)) return 'partial'
  return 'wrong'
}

function numResult(guess, answer) {
  if (guess == null && answer == null) return { result: 'exact', arrow: null }
  if (guess == null || answer == null) return { result: 'wrong', arrow: null }
  if (guess === answer) return { result: 'exact', arrow: null }
  return { result: 'wrong', arrow: answer > guess ? 'up' : 'down' }
}

// Round first, then who picked: a first-rounder taken by another club is
// half-right against a Canadiens first-rounder. The arrow follows the round.
function draftResult(guess, answer) {
  if (!guess && !answer) return { result: 'exact', arrow: null }
  if (!guess || !answer) return { result: 'wrong', arrow: null }
  const sameRound = guess.round === answer.round
  const sameTeam = guess.team === answer.team
  const arrow = sameRound ? null : answer.round > guess.round ? 'up' : 'down'
  if (sameRound && sameTeam) return { result: 'exact', arrow }
  if (sameRound || sameTeam) return { result: 'partial', arrow }
  return { result: 'wrong', arrow }
}

export function compareGuess(guess, answer) {
  const cells = {}
  cells.portrait = { result: guess.name === answer.name ? 'exact' : 'neutral' }
  cells.position = { result: positionResult(guess.position, answer.position), text: guess.position }
  cells.shoots = { result: guess.shoots === answer.shoots ? 'exact' : 'wrong', text: guess.shoots }
  cells.country = { result: guess.country === answer.country ? 'exact' : 'wrong', text: guess.country }
  cells.number = { ...numResult(guess.number, answer.number), text: formatNumber(guess.number) }
  cells.age = { ...numResult(guess.age, answer.age), text: String(guess.age) }
  cells.height = { ...numResult(guess.heightIn, answer.heightIn), text: formatHeight(guess.heightIn) }
  cells.draft = { ...draftResult(guess.draft, answer.draft), text: formatDraft(guess.draft), sub: draftSub(guess.draft) }
  cells.salary = { ...numResult(guess.capHit, answer.capHit), text: formatSalary(guess.capHit) }
  cells.since = { ...numResult(guess.sinceSeason, answer.sinceSeason), text: formatSeason(guess.sinceSeason) }
  return cells
}

export function formatNumber(n) {
  return n == null ? '—' : `#${n}`
}

export function formatHeight(inches) {
  if (inches == null) return '?'
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

export function formatHeightMetric(inches) {
  return inches == null ? '?' : `${Math.round(inches * 2.54)} cm`
}

export function formatWeight(lb) {
  return lb == null ? '?' : `${lb} lb (${Math.round(lb * 0.4536)} kg)`
}

// Unsigned restricted free agents have no cap hit yet.
export function formatSalary(d) {
  if (d == null) return 'RFA'
  return d >= 1e6 ? `$${(d / 1e6).toFixed(2).replace(/0$/, '')}M` : `$${Math.round(d / 1000)}K`
}

export function salarySentence(p) {
  if (p.capHit == null) return 'Unsigned restricted free agent'
  return `$${p.capHit.toLocaleString('en-US')} through ${formatSeason(p.contractEnd)}`
}

export function formatSeason(startYear) {
  return startYear == null ? '?' : `${startYear}-${String(startYear + 1).slice(2)}`
}

export function formatDraft(d) {
  return d ? `R${d.round}` : 'Undrafted'
}

function draftSub(d) {
  return d ? `${d.team} · ${d.year}` : null
}

const ORDINAL = n => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function draftSentence(d) {
  if (!d) return 'Undrafted'
  return `${d.year} · Round ${d.round}, ${ORDINAL(d.overall)} overall by ${d.teamName}`
}

export function lastSeasonSentence(p) {
  const s = p.lastSeason
  if (!s || !s.gp) return 'No games on record last season'
  const head = `${s.season} ${s.league} · ${s.team} · ${s.gp} GP`
  if (p.position === 'G') {
    const sv = s.svPct != null ? `, .${String(Math.round(s.svPct * 1000)).padStart(3, '0')} SV%` : ''
    const gaa = s.gaa != null ? `, ${s.gaa.toFixed(2)} GAA` : ''
    return `${head}, ${s.wins ?? 0} W${gaa}${sv}`
  }
  return `${head}, ${s.goals ?? 0} G, ${s.assists ?? 0} A, ${s.points ?? 0} PTS`
}

export function displayName(p) {
  return p.name
}
