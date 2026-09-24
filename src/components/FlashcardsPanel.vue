<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  RATINGS, cardsUntil, deckStats, fmtGap, loadDeck, nextCard, preview, rate, resetDeck, saveDeck,
} from '../game/anki.js'

const props = defineProps({
  players: { type: Array, required: true },
})
const emit = defineEmits(['open'])

const base = import.meta.env.BASE_URL
const deck = ref(loadDeck())
const current = ref(null)
const answer = ref('')
const revealed = ref(false)
const correct = ref(false)
const done = ref(0)
const sessionCorrect = ref(0)
const inputEl = ref(null)

const FIELDS_KEY = 'chdle:anki:ask'
const OLD_FIELDS_KEY = 'chdle:anki:fields'
const FIELDS = [
  { key: 'number', label: 'Number' },
  { key: 'position', label: 'Position' },
  { key: 'shoots', label: 'Shoots' },
  { key: 'country', label: 'Country' },
]
const EXTRA = FIELDS.slice(1)
const POSITIONS = ['C', 'LW', 'RW', 'D', 'G']
const HANDS = ['L', 'R']
const asked = ref(loadFields())
const picks = ref({ position: null, shoots: null, country: null })
const countries = computed(() => [...new Set(props.players.map(p => p.country))].sort())
const verdicts = ref({})

function loadFields() {
  try {
    const f = JSON.parse(localStorage.getItem(FIELDS_KEY))
    if (Array.isArray(f) && f.length) return new Set(f)
    const old = JSON.parse(localStorage.getItem(OLD_FIELDS_KEY))
    if (Array.isArray(old)) return new Set(['number', ...old])
  } catch { /* default below */ }
  return new Set(FIELDS.map(f => f.key))
}

function toggleField(key) {
  if (revealed.value) return
  const next = new Set(asked.value)
  if (next.has(key)) {
    if (next.size === 1) return
    next.delete(key)
  } else next.add(key)
  asked.value = next
  localStorage.setItem(FIELDS_KEY, JSON.stringify([...next]))
}

const clues = computed(() => {
  const c = current.value
  if (!c) return ''
  const out = []
  if (!asked.value.has('number') && !revealed.value) out.push(`#${c.number}`)
  if (!asked.value.has('position')) out.push(c.positionName)
  if (!asked.value.has('shoots')) out.push(`${c.position === 'G' ? 'Catches' : 'Shoots'} ${c.shoots}`)
  if (!asked.value.has('country')) out.push(c.country)
  return out.join(' · ')
})

function truth(key) {
  const c = current.value
  return key === 'number' ? c.number : c[key]
}

const stats = computed(() => deckStats(deck.value, props.players))
const isNew = computed(() => current.value && !deck.value.cards[current.value.name])
const card = computed(() => (current.value ? deck.value.cards[current.value.name] : null))
const waits = computed(() => {
  if (!current.value) return {}
  const gaps = preview(card.value ?? undefined, props.players.length)
  const out = {}
  for (const k in gaps) out[k] = cardsUntil(deck.value, props.players, current.value.name, gaps[k])
  return out
})
const others = computed(() => props.players.length - 1)

function start() {
  done.value = 0
  sessionCorrect.value = 0
  next()
}

function next() {
  revealed.value = false
  answer.value = ''
  picks.value = { position: null, shoots: null, country: null }
  verdicts.value = {}
  current.value = nextCard(deck.value, props.players, current.value?.name)
  if (current.value) nextTick(() => inputEl.value?.focus())
}

function check() {
  if (revealed.value || !current.value) return
  const n = Number(answer.value)
  const v = {}
  if (asked.value.has('number')) v.number = answer.value !== '' && Number.isInteger(n) && n === current.value.number
  for (const f of EXTRA) if (asked.value.has(f.key)) v[f.key] = picks.value[f.key] === truth(f.key)
  verdicts.value = v
  correct.value = Object.values(v).every(Boolean)
  revealed.value = true
}

function grade(rating) {
  if (!revealed.value) return
  rate(deck.value, current.value.name, rating, correct.value, props.players.length)
  saveDeck(deck.value)
  deck.value = { ...deck.value }
  done.value += 1
  if (correct.value) sessionCorrect.value += 1
  next()
}

// The answer box is gone once the card is revealed, so grading keys are
// read at the window and only while a revealed card is waiting.
function onKey(e) {
  if (!current.value) return
  if (!revealed.value) {
    if (e.key === 'Enter' && !asked.value.has('number') && e.target.tagName !== 'SELECT') {
      e.preventDefault()
      check()
    }
    return
  }
  const map = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }
  if (map[e.key]) {
    e.preventDefault()
    grade(map[e.key])
  }
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    grade(correct.value ? 'good' : 'again')
  }
}

function wipe() {
  if (!confirm('Forget all flashcard progress?')) return
  deck.value = resetDeck()
  start()
}

onMounted(() => {
  start()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
watch(() => props.players, start)
</script>

<template>
  <section class="cards">
    <div class="panel deck">
      <div class="deck-stats">
        <div class="stat"><b>{{ stats.due }}</b><span>Due</span></div>
        <div class="stat"><b>{{ stats.unseen }}</b><span>New left</span></div>
        <div class="stat"><b>{{ stats.learned }}/{{ stats.total }}</b><span>Learned</span></div>
        <div class="stat"><b>{{ stats.mature }}</b><span>Mature</span></div>
        <div class="stat"><b>{{ stats.retention ?? '—' }}<template v-if="stats.retention != null">%</template></b><span>Recall</span></div>
      </div>

      <div class="fields">
        <span class="fields-label">Ask</span>
        <button
          v-for="f in FIELDS" :key="f.key" type="button" class="field-toggle"
          :class="{ on: asked.has(f.key) }" :disabled="revealed || (asked.size === 1 && asked.has(f.key))"
          :aria-pressed="asked.has(f.key)"
          @click="toggleField(f.key)">{{ asked.has(f.key) ? '✔ ' : '' }}{{ f.label }}</button>
      </div>

      <template v-if="current">
        <p class="prompt">
          <template v-if="asked.has('number')">What number does <b>{{ current.name }}</b> wear?</template>
          <template v-else>What do you know about <b>{{ current.name }}</b>?</template>
          <span v-if="isNew" class="tag new">new · {{ current.nhlGames }} NHL GP</span>
          <span v-else class="tag">{{ card.gap ? `review · seen ${card.seen}×` : 'relearning' }}</span>
        </p>
        <div class="card" :class="{ revealed, correct, wrong: revealed && !correct }">
          <button
            class="face-btn" type="button" :title="`Open ${current.name}'s card`"
            @click="emit('open', { player: current, hideNumber: !revealed })">
            <img class="face" :src="base + 'portraits/' + current.portrait" :alt="current.name" />
            <span class="face-hint">Player card</span>
          </button>
          <div class="side">
            <span v-if="clues" class="who">{{ clues }}</span>
            <div v-if="!revealed" class="extras">
              <div v-if="asked.has('position')" class="pickrow">
                <button
                  v-for="x in POSITIONS" :key="x" type="button" class="pick"
                  :class="{ sel: picks.position === x }" @click="picks.position = x">{{ x }}</button>
              </div>
              <div v-if="asked.has('shoots')" class="pickrow">
                <span class="pick-label">Hand</span>
                <button
                  v-for="x in HANDS" :key="x" type="button" class="pick"
                  :class="{ sel: picks.shoots === x }" @click="picks.shoots = x">{{ x }}</button>
              </div>
              <select v-if="asked.has('country')" v-model="picks.country" class="country">
                <option :value="null" disabled>Country…</option>
                <option v-for="x in countries" :key="x" :value="x">{{ x }}</option>
              </select>
            </div>
            <form v-if="!revealed && asked.has('number')" class="answer" @submit.prevent="check">
              <span class="hash">#</span>
              <input
                ref="inputEl" v-model="answer" type="number" inputmode="numeric" min="1" max="99"
                placeholder="??" autocomplete="off" @keydown.enter.prevent.stop="check" />
              <button type="submit" class="show" :title="answer ? 'Check' : 'Show answer'">{{ answer ? 'Check' : 'Show' }}</button>
            </form>
            <button v-else-if="!revealed" type="button" class="show check-only" @click="check">Check</button>
            <div v-if="revealed" class="result">
              <span class="big">#{{ current.number }}</span>
              <span class="verdict">
                {{ correct ? 'Correct!' : !('number' in verdicts) || verdicts.number ? '' : answer ? `Not #${answer}` : 'Take a look' }}
              </span>
            </div>
            <ul v-if="revealed && EXTRA.some(f => f.key in verdicts)" class="checks">
              <li v-for="f in EXTRA.filter(f => f.key in verdicts)" :key="f.key" :class="verdicts[f.key] ? 'ok' : 'ko'">
                {{ verdicts[f.key] ? '✔' : '✘' }} {{ f.label }}: <b>{{ f.key === 'position' ? current.positionName : truth(f.key) }}</b>
                <template v-if="!verdicts[f.key] && picks[f.key]"> (not {{ picks[f.key] }})</template>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="revealed" class="grades">
          <button
            v-for="r in RATINGS" :key="r.key" class="grade" :class="r.key"
            @click="grade(r.key)">
            <b>{{ r.label }}</b><span>{{ waits[r.key] >= others ? 'after all others' : 'in ' + fmtGap(waits[r.key]) }}</span>
          </button>
        </div>
        <p class="hint">
          <template v-if="!revealed">{{ asked.has('number') ? 'Pick the answers, type the number and press Enter — or just Show if you\'re blank.' : 'Pick the answers, then Check or press Enter.' }}</template>
          <template v-else>Rate how hard it was: keys 1–4, or Enter for {{ correct ? 'Good' : 'Again' }}.</template>
          <span class="progress">{{ done }} this session · {{ sessionCorrect }} right</span>
        </p>
      </template>


      <button class="wipe" @click="wipe">Reset progress</button>
    </div>
  </section>
</template>

<style scoped>
.cards { width: 100%; display: flex; justify-content: center; }
.deck {
  width: min(560px, 100%);
  padding: 16px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.deck-stats {
  display: flex;
  justify-content: space-around;
  gap: 6px;
  border-bottom: 1px solid var(--tan);
  padding-bottom: 10px;
}
.stat { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.stat b { font-size: 20px; color: var(--brown-dark); line-height: 1.1; }
.stat span { font-size: 10.5px; text-transform: uppercase; color: var(--brown); letter-spacing: .3px; }

.prompt { margin: 0; text-align: center; font-size: 16px; color: var(--brown-dark); }
.tag {
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 8px;
  background: var(--parchment-dark);
  color: var(--brown);
  vertical-align: 1px;
}
.tag.new { background: var(--habs-red); color: #fff; }

.card {
  display: flex;
  gap: 16px;
  align-items: center;
  border: 3px solid var(--tan);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  transition: border-color .2s, box-shadow .2s;
}
.card.correct { border-color: var(--green); box-shadow: 0 0 0 3px rgba(71, 159, 75, .25); }
.card.wrong { border-color: var(--red); box-shadow: 0 0 0 3px rgba(178, 60, 57, .25); }
.face-btn {
  position: relative;
  flex: none;
  padding: 0;
  border: none;
  background: none;
  border-radius: 10px;
  overflow: hidden;
  line-height: 0;
}
.face-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0, 0, 0, .25); }
.face-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 0 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .9);
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, .7));
}
.face {
  display: block;
  width: 120px;
  height: 120px;
  border-radius: 10px;
  object-fit: cover;
  object-position: top;
  background: radial-gradient(circle at 50% 30%, #4b6390, #1b2540 75%);
}
.side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.who { font-size: 13px; color: var(--brown); font-weight: 600; }
.fields { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; }
.fields-label { font-size: 11px; text-transform: uppercase; letter-spacing: .3px; color: var(--brown); font-weight: 700; }
.field-toggle {
  font-size: 12.5px;
  font-weight: 700;
  padding: 4px 11px;
  border-radius: 14px;
  border: 1.5px solid var(--tan);
  background: var(--parchment);
  color: var(--brown);
}
.field-toggle.on { background: var(--brown-dark); border-color: var(--brown-dark); color: #fff; }
.field-toggle:disabled { opacity: .6; cursor: default; }
.check-only { align-self: flex-start; }
.extras { display: flex; flex-direction: column; gap: 6px; }
.pickrow { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
.pick-label { font-size: 12px; font-weight: 700; color: var(--brown); margin-right: 2px; }
.pick {
  min-width: 38px;
  font-weight: 700;
  font-size: 13.5px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 2px solid var(--tan);
  background: var(--parchment);
  color: var(--brown-dark);
}
.pick.sel { background: var(--habs-red); border-color: var(--habs-red); color: #fff; }
.country {
  align-self: flex-start;
  font: inherit;
  font-size: 14px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 2px solid var(--tan);
  background: var(--parchment);
  color: var(--ink);
}
.checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; }
.checks .ok { color: var(--green); }
.checks .ko { color: var(--red); }
.checks b { color: var(--brown-dark); }
.answer { display: flex; align-items: center; gap: 6px; }
.hash { font-family: 'Lilita One', cursive; font-size: 34px; color: var(--brown); }
.answer input {
  width: 96px;
  font-family: 'Lilita One', cursive;
  font-size: 34px;
  padding: 4px 10px;
  border-radius: 10px;
  border: 2px solid var(--tan);
  background: var(--parchment);
  color: var(--ink);
  outline: none;
  -moz-appearance: textfield;
}
.answer input::-webkit-outer-spin-button, .answer input::-webkit-inner-spin-button { -webkit-appearance: none; }
.show {
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 8px;
  border: 2px solid var(--tan);
  background: var(--parchment-dark);
  color: var(--brown-dark);
}
.result { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.big {
  font-family: 'Lilita One', cursive;
  font-size: 46px;
  line-height: 1;
  color: var(--habs-red);
  animation: pop .3s cubic-bezier(.2, .9, .3, 1.4) both;
}
@keyframes pop { from { transform: scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
.verdict { font-weight: 700; color: var(--brown-dark); }

.grades { display: flex; gap: 8px; }
.grade {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 8px;
  border: 2px solid var(--tan);
  background: var(--parchment);
  color: var(--brown-dark);
}
.grade span { font-size: 11px; color: var(--brown); }
.grade.again { border-color: var(--red); }
.grade.hard { border-color: var(--yellow); }
.grade.good { border-color: var(--green); }
.grade.easy { border-color: #2f7fc4; }
.grade:hover { background: var(--parchment-dark); }

.hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--brown);
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.progress { font-weight: 700; }

.wipe {
  align-self: flex-end;
  background: none;
  border: none;
  font-size: 11.5px;
  color: var(--brown);
  text-decoration: underline;
  padding: 0;
}

@media (max-width: 480px) {
  .card { flex-direction: column; text-align: center; }
  .side { align-items: center; }
  .answer input { width: 84px; font-size: 30px; }
}
</style>
