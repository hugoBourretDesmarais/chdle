import assert from 'node:assert/strict'
import worker from '../api/src/index.js'
import { PLAYERS } from '../api/src/data.js'
import { montrealDay, nextReset } from '../src/game/day.js'

assert.equal(montrealDay(new Date('2026-11-20T04:59:59Z')), '2026-11-19')
assert.equal(montrealDay(new Date('2026-11-20T05:00:00Z')), '2026-11-20')
assert.equal(nextReset(new Date('2026-03-08T05:00:00Z')), Date.parse('2026-03-09T04:00:00Z'))
assert.equal(nextReset(new Date('2026-11-01T04:00:00Z')), Date.parse('2026-11-02T05:00:00Z'))
const rows = new Map()
const env = { DB: { prepare(sql) { return { bind(day, payload) { return {
  async first() { return rows.has(day) ? { payload: rows.get(day) } : null },
  async run() { if (!rows.has(day)) rows.set(day, payload) },
} } } } } }
const request = scope => worker.fetch(new Request(`https://test/daily?arc=${scope}`), env).then(r => r.json())
const [a, b] = await Promise.all([request(''), request('nhl')])
assert.deepEqual(a, b)
assert.equal(rows.size, 1)
assert.ok(a.players.some(p => p.name === a.answer))
const original = PLAYERS[0].name
PLAYERS[0].name = 'Changed after deployment'
const c = await request('')
assert.deepEqual(c.players, a.players)
assert.equal(c.answer, a.answer)
PLAYERS[0].name = original
assert.equal(c.day, montrealDay())
console.log('Shared daily puzzle, concurrent initialization, roster snapshot and DST reset checks passed')
