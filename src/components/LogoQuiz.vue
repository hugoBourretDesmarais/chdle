<script setup>
import { computed, onMounted, ref } from 'vue'
import GuessInput from './GuessInput.vue'
import Icon from './Icon.vue'
import { randomIndex } from '../game/state.js'

const props = defineProps({
  teams: { type: Array, required: true },
})

const KEY = 'chdle:logos'
const base = import.meta.env.BASE_URL
const answer = ref(null)
const guesses = ref([]) // wrong teams, newest first
const solved = ref(false)
const gaveUp = ref(false)
const streak = ref(0)
const best = ref(0)
const played = ref(0)
const solvedCount = ref(0)
let lastIdx = -1

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) ?? {}
    best.value = s.best ?? 0
    played.value = s.played ?? 0
    solvedCount.value = s.solved ?? 0
  } catch { /* fresh */ }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify({ best: best.value, played: played.value, solved: solvedCount.value }))
}

const guessed = computed(() => new Set(guesses.value.map(t => t.name)))
const over = computed(() => solved.value || gaveUp.value)

// Hints arrive one wrong guess at a time so a stumped player still gets there.
const hints = computed(() => {
  const n = guesses.value.length
  const a = answer.value
  const out = []
  if (!a) return out
  if (n >= 1) out.push(`${a.conference} Conference`)
  if (n >= 2) out.push(`${a.division} Division`)
  if (n >= 3) out.push(`Founded ${a.founded}`)
  if (n >= 4) out.push(`Starts with "${a.common[0]}"`)
  return out
})

function next() {
  lastIdx = randomIndex(props.teams.length, lastIdx)
  answer.value = props.teams[lastIdx]
  guesses.value = []
  solved.value = false
  gaveUp.value = false
}

function guess(t) {
  if (over.value) return
  if (t.name === answer.value.name) {
    solved.value = true
    streak.value += 1
    best.value = Math.max(best.value, streak.value)
    played.value += 1
    solvedCount.value += 1
    save()
    return
  }
  guesses.value.unshift(t)
}

function reveal() {
  if (over.value) return
  gaveUp.value = true
  streak.value = 0
  played.value += 1
  save()
}

onMounted(() => { load(); next() })
</script>

<template>
  <section class="quiz">
    <div class="panel board">
      <div class="scores">
        <div class="stat"><b>{{ streak }}</b><span>Streak</span></div>
        <div class="stat"><b>{{ best }}</b><span>Best</span></div>
        <div class="stat"><b>{{ solvedCount }}/{{ played }}</b><span>Solved</span></div>
      </div>

      <div v-if="answer" class="logo-wrap" :class="{ solved, gaveUp }">
        <img class="logo" :src="base + 'logos/' + answer.logo" :alt="over ? answer.name : 'Mystery team logo'" />
      </div>

      <template v-if="answer && over">
        <h3 class="reveal">{{ solved ? '🚨 ' : '' }}{{ answer.name }}</h3>
        <p class="meta">
          {{ answer.division }} Division · {{ answer.conference }} Conference · est. {{ answer.founded }}
          <template v-if="solved"> · solved in {{ guesses.length + 1 }} {{ guesses.length ? 'guesses' : 'guess' }}</template>
        </p>
        <button class="next" @click="next"><Icon name="dice" :size="18" /> Next logo</button>
      </template>

      <template v-else-if="answer">
        <GuessInput
          :characters="teams" :guessed="guessed" :show-images="false" placeholder="Type a team name..."
          @guess="guess" />
        <ul v-if="hints.length" class="hints">
          <li v-for="h in hints" :key="h">💡 {{ h }}</li>
        </ul>
        <ul v-if="guesses.length" class="wrong">
          <li v-for="t in guesses" :key="t.abbrev">
            <img :src="base + 'logos/' + t.logo" :alt="t.name" /> {{ t.name }}
          </li>
        </ul>
        <button class="giveup" @click="reveal">Show answer (ends streak)</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.quiz { width: 100%; display: flex; justify-content: center; }
.board {
  width: min(560px, 100%);
  padding: 16px 20px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.scores {
  width: 100%;
  display: flex;
  justify-content: space-around;
  border-bottom: 1px solid var(--tan);
  padding-bottom: 10px;
}
.stat { display: flex; flex-direction: column; align-items: center; }
.stat b { font-size: 22px; color: var(--brown-dark); line-height: 1.1; }
.stat span { font-size: 10.5px; text-transform: uppercase; color: var(--brown); letter-spacing: .3px; }

.logo-wrap {
  width: 220px;
  height: 220px;
  border-radius: 16px;
  background: #fff;
  border: 3px solid var(--tan);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  transition: border-color .2s, box-shadow .2s;
}
.logo-wrap.solved { border-color: var(--green); box-shadow: 0 0 0 4px rgba(71, 159, 75, .25); }
.logo-wrap.gaveUp { border-color: var(--red); }
.logo { width: 100%; height: 100%; object-fit: contain; animation: drop .35s cubic-bezier(.2, .9, .3, 1.3) both; }
@keyframes drop { from { transform: scale(.7); opacity: 0; } to { transform: none; opacity: 1; } }

.reveal { font-family: 'Lilita One', cursive; color: var(--habs-red); font-size: 26px; margin: 0; text-align: center; }
.meta { margin: -6px 0 0; font-size: 13.5px; color: var(--brown); text-align: center; }
.next, .giveup {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--tan);
  background: var(--parchment-dark);
  color: var(--brown-dark);
  font-weight: 700;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 15px;
}
.giveup { font-size: 12.5px; padding: 6px 12px; background: none; }
.hints { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.hints li {
  font-size: 13px;
  font-weight: 600;
  color: var(--brown-dark);
  background: var(--parchment-dark);
  border-radius: 10px;
  padding: 4px 10px;
}
.wrong { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; }
.wrong li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: var(--brown-dark);
  background: rgba(178, 60, 57, .12);
  border: 1px solid rgba(178, 60, 57, .4);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 14px;
  text-decoration: line-through;
}
.wrong img { width: 28px; height: 28px; object-fit: contain; }
</style>
