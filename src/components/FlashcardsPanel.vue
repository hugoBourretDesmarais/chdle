<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import {
  NEW_PER_DAY, RATINGS, buildQueue, deckStats, loadDeck, markIntroduced, preview, rate, resetDeck,
  saveDeck, unseenPlayers,
} from '../game/anki.js'

const props = defineProps({
  players: { type: Array, required: true },
})

const base = import.meta.env.BASE_URL
const deck = ref(loadDeck())
const queue = ref([]) // players still to review this session
const current = ref(null)
const answer = ref('')
const revealed = ref(false)
const correct = ref(false)
const done = ref(0)
const sessionCorrect = ref(0)
const inputEl = ref(null)
const finished = ref(false)

const stats = computed(() => deckStats(deck.value, props.players))
const isNew = computed(() => current.value && !deck.value.cards[current.value.name])
const card = computed(() => (current.value ? deck.value.cards[current.value.name] : null))
const waits = computed(() => preview(card.value ?? undefined))

function fmtWait(days) {
  if (days === 0) return 'now'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

function start() {
  const q = buildQueue(deck.value, props.players)
  queue.value = [...q.due, ...q.fresh]
  done.value = 0
  sessionCorrect.value = 0
  finished.value = false
  next()
}

function next() {
  revealed.value = false
  answer.value = ''
  current.value = queue.value.shift() ?? null
  if (!current.value) {
    finished.value = true
    return
  }
  nextTick(() => inputEl.value?.focus())
}

function check() {
  if (revealed.value || !current.value) return
  const n = Number(answer.value)
  correct.value = Number.isInteger(n) && n === current.value.number
  revealed.value = true
  if (isNew.value) markIntroduced(deck.value)
}

function grade(rating) {
  if (!revealed.value) return
  rate(deck.value, current.value.name, rating, correct.value)
  saveDeck(deck.value)
  deck.value = { ...deck.value }
  done.value += 1
  if (correct.value) sessionCorrect.value += 1
  // Anki shows a lapsed card again before the session ends.
  if (rating === 'again') queue.value.splice(Math.min(3, queue.value.length), 0, current.value)
  next()
}

// The answer box is gone once the card is revealed, so grading keys are
// read at the window and only while a revealed card is waiting.
function onKey(e) {
  if (!revealed.value || !current.value) return
  const map = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }
  if (map[e.key]) grade(map[e.key])
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
        <div class="stat"><b>{{ Math.max(0, Math.min(stats.unseen, NEW_PER_DAY - stats.today.introduced)) }}</b><span>New today</span></div>
        <div class="stat"><b>{{ stats.learned }}/{{ stats.total }}</b><span>Learned</span></div>
        <div class="stat"><b>{{ stats.mature }}</b><span>Mature</span></div>
        <div class="stat"><b>{{ stats.retention ?? '—' }}<template v-if="stats.retention != null">%</template></b><span>Recall</span></div>
      </div>

      <template v-if="current">
        <p class="prompt">
          What number does <b>{{ current.name }}</b> wear?
          <span v-if="isNew" class="tag new">new · {{ current.nhlGames }} NHL GP</span>
          <span v-else class="tag">review · every {{ fmtWait(card.interval) }}</span>
        </p>
        <div class="card" :class="{ revealed, correct, wrong: revealed && !correct }">
          <img class="face" :src="base + 'portraits/' + current.portrait" :alt="current.name" />
          <div class="side">
            <span class="who">{{ current.positionName }} · {{ current.country }}</span>
            <form v-if="!revealed" class="answer" @submit.prevent="check">
              <span class="hash">#</span>
              <input
                ref="inputEl" v-model="answer" type="number" inputmode="numeric" min="1" max="99"
                placeholder="??" autocomplete="off" @keydown.enter.prevent="check" />
              <button type="submit" class="show" :title="answer ? 'Check' : 'Show answer'">{{ answer ? 'Check' : 'Show' }}</button>
            </form>
            <div v-else class="result">
              <span class="big">#{{ current.number }}</span>
              <span class="verdict">
                {{ correct ? 'Correct!' : answer ? `Not #${answer}` : 'Take a look' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="revealed" class="grades">
          <button
            v-for="r in RATINGS" :key="r.key" class="grade" :class="r.key"
            @click="grade(r.key)">
            <b>{{ r.label }}</b><span>{{ fmtWait(waits[r.key]) }}</span>
          </button>
        </div>
        <p class="hint">
          <template v-if="!revealed">Type the number and press Enter — or just Show if you're blank.</template>
          <template v-else>Rate how hard it was: keys 1–4, or Enter for {{ correct ? 'Good' : 'Again' }}.</template>
          <span class="progress">{{ done }} done · {{ queue.length }} left</span>
        </p>
      </template>

      <div v-else class="finished">
        <h3 v-if="done">Session complete 🎉</h3>
        <h3 v-else>Nothing due</h3>
        <p v-if="done">{{ sessionCorrect }} of {{ done }} right the first time. Cards come back as they fall due.</p>
        <p v-else-if="stats.unseen">
          Today's {{ NEW_PER_DAY }} new cards are in. Come back tomorrow for more, or add extra now.
        </p>
        <p v-else>Every number is scheduled. Check back when cards fall due.</p>
        <div class="finish-actions">
          <button v-if="stats.unseen" class="more" @click="() => { queue = unseenPlayers(deck, players).slice(0, NEW_PER_DAY); finished = false; next() }">
            <Icon name="dice" :size="16" /> {{ NEW_PER_DAY }} more new cards
          </button>
          <button class="more" @click="start"><Icon name="stats" :size="16" /> Refresh queue</button>
        </div>
      </div>

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
.face {
  width: 120px;
  height: 120px;
  flex: none;
  border-radius: 10px;
  object-fit: cover;
  object-position: top;
  background: radial-gradient(circle at 50% 30%, #4b6390, #1b2540 75%);
}
.side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.who { font-size: 13px; color: var(--brown); font-weight: 600; }
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

.finished { text-align: center; padding: 8px 0; }
.finished h3 { font-family: 'Lilita One', cursive; color: var(--brown-dark); margin: 0 0 6px; }
.finished p { margin: 0 0 12px; font-size: 14px; color: var(--brown); }
.finish-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  padding: 9px 14px;
  border-radius: 8px;
  border: 2px solid var(--tan);
  background: var(--parchment-dark);
  color: var(--brown-dark);
}
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
