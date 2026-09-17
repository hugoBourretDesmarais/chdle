import rawTeams from '../data/teams.json'

// GuessInput and the flashcards read `portrait`, so a team carries its logo there.
export const TEAMS = rawTeams.map(t => ({ ...t, portrait: t.logo }))

export function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
}

export function teamNames(t) {
  return [t.name, t.common, t.place, t.abbrev, t.nameFr, ...(t.aliases || [])].filter(Boolean)
}

// A typed answer counts when it names the club unambiguously: full name,
// nickname, abbreviation, French name or a known alias. City alone is not
// enough where two clubs share one (New York).
export function isTeam(query, t, teams = TEAMS) {
  const q = norm(query)
  if (!q) return false
  const own = teamNames(t).map(norm)
  if (!own.includes(q)) return false
  const shared = teams.filter(o => o.abbrev !== t.abbrev && teamNames(o).map(norm).includes(q))
  return shared.length === 0
}

export function suggestTeams(query, teams = TEAMS, exclude = new Set(), limit = 8) {
  const q = norm(query)
  if (!q) return []
  const scored = []
  for (const t of teams) {
    if (exclude.has(t.name)) continue
    let best = -1
    for (const n of teamNames(t).map(norm)) {
      if (n.startsWith(q)) best = Math.max(best, 2)
      else if (n.split(/\s+/).some(w => w.startsWith(q))) best = Math.max(best, 1)
      else if (n.includes(q)) best = Math.max(best, 0)
    }
    if (best >= 0) scored.push([best, t])
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name))
  return scored.slice(0, limit).map(x => x[1])
}
