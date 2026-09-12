<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import rawPlayers from './data/players.json'
import { COLUMNS, compareGuess, decorate, inScope, scopeLabel } from './game/compare.js'
import {
  dailyIndex, dailyNumber, loadDailyState, loadScope, loadExcluded, localDateString,
  loadAccount, msUntilMidnight, randomIndex, recordGuess, recordPracticeStart, recordWin,
  saveAccount, saveScope, saveDailyState, saveExcluded, currentStreak,
  loadPromptedDay, savePromptedDay,
} from './game/state.js'
import GuessInput from './components/GuessInput.vue'
import GuessRow from './components/GuessRow.vue'
import WinPanel from './components/WinPanel.vue'
import HelpModal from './components/HelpModal.vue'
import StatsModal from './components/StatsModal.vue'
import CluesPanel from './components/CluesPanel.vue'
import { apiEnabled, fetchCount, reportSolve, submitResult } from './game/api.js'
import GalleryPanel from './components/GalleryPanel.vue'
import LeaderboardModal from './components/LeaderboardModal.vue'
import WinPrompt from './components/WinPrompt.vue'
import Confetti from './components/Confetti.vue'
import ArtBackground from './components/ArtBackground.vue'
import GameLogo from './components/GameLogo.vue'
import StreakFlame from './components/StreakFlame.vue'
import Icon from './components/Icon.vue'
import PlayerModal from './components/PlayerModal.vue'
import SettingsModal from './components/SettingsModal.vue'

const players = rawPlayers.map(decorate)

const mode = ref('daily') // 'daily' | 'practice' | 'gallery'
const showHelp = ref(false)
const showStats = ref(false)
const showSettings = ref(false)
const galleryPick = ref(null)
const showBoard = ref(false)
const showWinPrompt = ref(false)
const account = ref(loadAccount())
const streak = ref(currentStreak())
const scope = ref(loadScope())
const excluded = ref(loadExcluded())
const solveCount = ref(null)

// The winning row flips one tile at a time; hold the result back until the
// last one has landed so the reveal isn't spoiled by the panel appearing.
const TILE_STAGGER_MS = 280
const TILE_FLIP_MS = 500
const REVEAL_MS = COLUMNS.length * TILE_STAGGER_MS + TILE_FLIP_MS
const revealing = ref(false)
const celebrating = ref(false)
let revealTimer = null

function finishReveal() {
  if (!revealing.value) return
  clearTimeout(revealTimer)
  revealing.value = false
  celebrating.value = true
  setTimeout(() => (celebrating.value = false), 3000)
  maybePromptSignIn()
}

function startCelebration() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    revealing.value = false
    celebrating.value = false
    maybePromptSignIn()
    return
  }
  revealing.value = true
  celebrating.value = false
  clearTimeout(revealTimer)
  // A backgrounded tab pauses CSS animations, so animationend can't be the
  // only trigger — the row's 'revealed' event just gets there first when the
  // tab is actually painting.
  revealTimer = setTimeout(finishReveal, REVEAL_MS)
}

async function refreshCount() {
  if (!apiEnabled) return
  const r = await fetchCount(localDateString(), scope.value)
  if (r) solveCount.value = r.count
}

const scopeName = computed(() => scopeLabel(scope.value))

// Everything the player can meet — answers, suggestions, roster — comes from here.
const pool = computed(() => players.filter(p => inScope(p, scope.value)))

const byName = computed(() => new Map(pool.value.map(p => [p.name, p])))

// Exclusions only narrow practice; the daily stays shared between players.
const practicePool = computed(() => pool.value.filter(p => !excluded.value.has(p.name)))

function toggleExcluded(p) {
  const next = new Set(excluded.value)
  if (next.has(p.name)) next.delete(p.name)
  else next.add(p.name)
  excluded.value = next
  saveExcluded(next)
}

function setAllExcluded({ chars, included }) {
  const next = new Set(excluded.value)
  for (const p of chars) {
    if (included) next.delete(p.name)
    else next.add(p.name)
  }
  excluded.value = next
  saveExcluded(next)
}

const daily = reactive({
  number: dailyNumber(),
  answer: null,
  guesses: [], // {char, cells}
  won: false,
  triesAtWin: 0,
})
const practice = reactive({ answer: null, guesses: [], won: false, counted: false })

const yesterdayAnswer = computed(
  () => pool.value[dailyIndex(pool.value.length, localDateString(-1))])

const game = computed(() => (mode.value === 'practice' ? practice : daily))
const guessedNames = computed(() => new Set(game.value.guesses.map(g => g.char.name)))

// The daily can only be won once, and the win is reported as it lands, so
// signing in afterwards would otherwise leave that day unranked forever.
const pendingWin = computed(() => (daily.won && daily.answer
  ? {
    day: localDateString(),
    arcLimit: scope.value,
    guesses: daily.triesAtWin || daily.guesses.length,
    name: daily.answer.name,
  }
  : null))

function recordDailyWin(acct) {
  const w = pendingWin.value
  if (!acct || !w) return null
  return submitResult(acct, w.day, w.arcLimit, w.guesses, w.name)
}

function maybePromptSignIn() {
  if (!apiEnabled || account.value || mode.value !== 'daily' || !daily.won) return
  const today = localDateString()
  if (loadPromptedDay() === today) return
  savePromptedDay(today)
  setTimeout(() => { showWinPrompt.value = true }, 900)
}

function restoreDaily() {
  revealing.value = false
  celebrating.value = false
  daily.answer = pool.value[dailyIndex(pool.value.length)]
  daily.guesses = []
  daily.won = false
  const s = loadDailyState(scope.value)
  for (const name of s.guesses) {
    const char = byName.value.get(name)
    if (char) daily.guesses.unshift({ char, cells: compareGuess(char, daily.answer), animate: false })
  }
  daily.won = s.won
  daily.triesAtWin = s.guesses.length
}

function persistDaily() {
  saveDailyState({
    date: localDateString(),
    scope: scope.value,
    guesses: [...daily.guesses].reverse().map(g => g.char.name),
    won: daily.won,
  })
}

function setAccount(next) {
  account.value = next
  saveAccount(next)
}

function onPromptAccount(next) {
  setAccount(next)
  showWinPrompt.value = false
}

function applyScope(next) {
  scope.value = next
  saveScope(next)
  restoreDaily()
  newPractice()
  galleryPick.value = null
  solveCount.value = null
  refreshCount()
}

function submitGuess(char) {
  const g = game.value
  if (g.won || guessedNames.value.has(char.name)) return
  const isDaily = mode.value === 'daily'
  const statMode = isDaily ? 'classic' : 'practice'

  if (!isDaily && !practice.counted) {
    practice.counted = true
    recordPracticeStart()
  }
  const cells = compareGuess(char, g.answer)
  g.guesses.unshift({ char, cells, animate: true })
  recordGuess(statMode, char.name)

  if (char.name === g.answer.name) {
    g.won = true
    startCelebration()
    if (isDaily) daily.triesAtWin = daily.guesses.length
    recordWin(statMode, g.guesses.length)
    if (isDaily) {
      streak.value = currentStreak()
      reportSolve(localDateString(), scope.value, char.name).then(r => {
        if (r) solveCount.value = r.count
      })
      recordDailyWin(account.value)
    }
  }
  if (isDaily) persistDaily()
}

function randomStarter() {
  const src = mode.value === 'practice' && practicePool.value.length
    ? practicePool.value
    : pool.value
  const candidates = src.filter(p => !guessedNames.value.has(p.name))
  if (!candidates.length) return
  submitGuess(candidates[randomIndex(candidates.length)])
}

function newPractice() {
  revealing.value = false
  celebrating.value = false
  clearTimeout(revealTimer)
  const src = practicePool.value.length ? practicePool.value : pool.value
  practice.answer = src[randomIndex(src.length)]
  practice.guesses = []
  practice.won = false
  practice.counted = false
}

const countdown = ref('')
let timer = null
function tick() {
  const ms = msUntilMidnight()
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  countdown.value = `${h}:${m}:${s}`
}

onMounted(() => {
  restoreDaily()
  newPractice()
  refreshCount()
  // Retries a win the server never got; /result ignores a day it already has.
  recordDailyWin(account.value)
  tick()
  timer = setInterval(tick, 1000)
  if (!localStorage.getItem('chdle:visited')) {
    showHelp.value = true
    localStorage.setItem('chdle:visited', '1')
  }
})
onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(revealTimer)
})

// The rink shot is the everyday backdrop; ?bg=1..3 previews the others.
const bgSeed = computed(() => {
  const forced = Number(new URLSearchParams(location.search).get('bg'))
  return Number.isInteger(forced) ? forced : 0
})

const base = import.meta.env.BASE_URL
</script>

<template>
  <div class="page">
    <ArtBackground :seed="bgSeed" />
    <header class="header">
      <GameLogo />

      <div class="modes">
        <button class="mode-btn" :class="{ active: mode === 'daily' }" title="Classic (daily)"
          @click="mode = 'daily'">
          <span class="mode-ico">🏒</span>
          <span v-if="daily.won" class="mode-check">✔</span>
        </button>
        <button class="mode-btn" :class="{ active: mode === 'practice' }" title="Practice (unlimited)"
          @click="mode = 'practice'">
          <span class="mode-ico">🎲</span>
          <span v-if="practice.won" class="mode-check">✔</span>
        </button>
        <button class="mode-btn" :class="{ active: mode === 'gallery' }" title="Roster"
          @click="mode = 'gallery'">
          <span class="mode-ico">📋</span>
        </button>
      </div>

      <div class="toolbar panel">
        <button class="tool" title="Statistics" @click="showStats = true"><Icon name="chart" :size="23" /></button>
        <StreakFlame class="tool" :count="streak" />
        <span class="tool daily-num" :title="`Daily player #${daily.number}`">#{{ daily.number }}</span>
        <button
          class="tool" :class="{ 'tool-on': scope }"
          :title="scope ? `Roster: ${scopeName}` : 'Settings'"
          @click="showSettings = true"><Icon name="whistle" :size="23" /></button>
        <button
          class="tool" :class="{ 'tool-on': account }"
          :title="account ? `Leaderboard — playing as ${account.name}` : 'Leaderboard'"
          @click="showBoard = true"><Icon name="trophy" :size="23" /></button>
        <button class="tool" title="How to play" @click="showHelp = true"><Icon name="help" :size="23" /></button>
      </div>

      <p v-if="scope" class="arc-banner">
        <Icon name="whistle" :size="15" /> <b>{{ scopeName }}</b> — {{ pool.length }} of {{ players.length }} players
        <button class="arc-clear" @click="applyScope(null)">clear</button>
      </p>
    </header>

    <main class="game">
      <template v-if="mode === 'gallery'">
        <section class="panel intro">
          <h2>2026-27 ROSTER</h2>
          <p class="gallery-hint">
            {{ scope ? `The ${pool.length} ${scopeName.toLowerCase()}` : `All ${players.length} players at Canadiens camp for 2026-27` }}.
            Search by name, position, country, number or draft — then tap a card for the full details.
          </p>
        </section>
        <GalleryPanel
          :characters="pool" :excluded="excluded" :scope-label="scopeName"
          @open="galleryPick = $event" @toggle="toggleExcluded" @set-all="setAllExcluded" />
      </template>

      <template v-else>
        <section class="panel intro">
          <h2 v-if="mode === 'daily'">GUESS TODAY'S CANADIEN!</h2>
          <h2 v-else>PRACTICE MODE — GUESS THE PLAYER!</h2>
          <CluesPanel :answer="game.answer" :tries="game.guesses.length" :won="game.won" />
          <button v-if="mode === 'practice'" class="reset-btn" @click="newPractice">
            <Icon name="dice" :size="18" />
            New player
          </button>
          <p v-if="mode === 'daily' && solveCount !== null" class="solve-count">
            <b>{{ solveCount.toLocaleString() }}</b>
            {{ solveCount === 1 ? 'person' : 'people' }} already found out!
          </p>
          <p v-if="mode === 'practice' && excluded.size" class="practice-pool">
            Drawing from <b>{{ practicePool.length }}</b> of {{ pool.length }} players
            <template v-if="!practicePool.length">— none selected, using all</template>
            <span class="pool-hint">· change this in the roster</span>
          </p>
        </section>

        <WinPanel
          v-if="game.won && !revealing" :answer="game.answer" :tries="game.guesses.length" :mode="mode"
          :countdown="countdown" :guesses="game.guesses" :daily-number="daily.number"
          @practice="mode = 'practice'"
          @replay="newPractice" />

        <GuessInput
          v-if="!game.won" :characters="pool" :guessed="guessedNames"
          @guess="submitGuess" />

        <button
          v-if="!game.won && !game.guesses.length"
          class="starter-btn" @click="randomStarter">
          🎯 Random starting player
        </button>

        <section v-if="game.guesses.length" class="grid-wrap">
          <div class="grid">
            <div class="grid-head">
              <div v-for="col in COLUMNS" :key="col.key" class="head-cell">{{ col.label }}</div>
            </div>
            <GuessRow
            v-for="g in game.guesses" :key="g.char.name" :guess="g" :base="base"
            @revealed="finishReveal" />
          </div>
        </section>

        <p class="yesterday" v-if="mode === 'daily' && daily.number > 1">
          Yesterday's player #{{ daily.number - 1 }} was <b>{{ yesterdayAnswer.name }}</b>
        </p>
      </template>

      <footer class="footer">
        <a href="https://hugobourretdesmarais.github.io/">🏠 Home</a>
        · also play <a href="https://hugobourretdesmarais.github.io/onepiecedle/">OnePieceDle</a>
        and <a href="https://hugobourretdesmarais.github.io/avatardle/">AvatarDle</a>
        <br />
        Roster and headshots from <a href="https://www.nhl.com/canadiens/" target="_blank" rel="noreferrer">NHL.com</a>
        · Fan project, not affiliated with the Montréal Canadiens or the NHL
      </footer>
    </main>

    <Confetti v-if="celebrating" />
    <HelpModal v-if="showHelp" @close="showHelp = false" />
    <StatsModal v-if="showStats" :characters="players" @close="showStats = false" />
    <PlayerModal v-if="galleryPick" :player="galleryPick" @close="galleryPick = null" />
    <WinPrompt
      v-if="showWinPrompt && daily.answer" :answer="daily.answer.name"
      :tries="daily.triesAtWin || daily.guesses.length" :pending-win="pendingWin"
      @account="onPromptAccount" @close="showWinPrompt = false" />
    <LeaderboardModal
      v-if="showBoard" :account="account" :day="localDateString()" :pending-win="pendingWin"
      @account="setAccount" @close="showBoard = false" />
    <SettingsModal
      v-if="showSettings" :players="players" :scope="scope"
      @update:scope="applyScope" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.page {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
}

@keyframes banner-in {
  from { transform: translateY(-6px); opacity: 0; }
  to { transform: none; opacity: 1; }
}

.modes { display: flex; gap: 16px; }
.mode-btn {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid #0c1424;
  background: radial-gradient(circle at 35% 30%, #34507f, #111c33 70%);
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: grayscale(.7) brightness(.85);
  transition: transform .12s, filter .12s;
}
.mode-btn.active {
  filter: none;
  transform: scale(1.09);
  border-color: #d5dfef;
  box-shadow: 0 0 0 3px rgba(175, 30, 45, .45), 0 6px 16px rgba(0, 0, 0, .35);
}
.mode-btn:hover { filter: none; transform: translateY(-2px) scale(1.05); }
.mode-btn:active { transform: translateY(0) scale(.98); }
.mode-ico { pointer-events: none; }
.mode-check {
  position: absolute;
  bottom: -6px;
  right: -6px;
  background: var(--green);
  color: #fff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
}
.tool {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  font-size: 20px;
  padding: 5px 8px;
  border-radius: 10px;
  color: var(--brown-dark);
}
button.tool:hover { background: rgba(36, 74, 124, .12); }
.daily-num {
  font-weight: 700;
  font-size: 15px;
  color: var(--brown-dark);
  background: var(--parchment-dark);
  border-radius: 12px;
  padding: 4px 10px;
}

.game {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 18px;
  gap: 16px;
}

.intro {
  width: min(560px, 100%);
  padding: 18px 22px;
  text-align: center;
}
.intro h2 {
  font-family: 'Lilita One', cursive;
  color: var(--brown-dark);
  letter-spacing: 1px;
  font-size: 22px;
  margin: 0 0 14px;
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  border: 2px solid var(--tan);
  background: var(--parchment-dark);
  color: var(--brown-dark);
  font-weight: 700;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 15px;
}
.reset-btn:hover { filter: brightness(.96); }

.gallery-hint {
  margin: 0;
  font-size: 14px;
  color: var(--brown);
}

.practice-pool {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--brown);
}

.solve-count {
  margin: 14px 0 0;
  font-size: 15px;
  color: var(--brown-dark);
}
.solve-count b { color: var(--habs-red); font-size: 17px; }

.starter-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--tan);
  background: var(--parchment);
  color: var(--brown-dark);
  font-weight: 700;
  font-size: 14px;
  border-radius: 8px;
  padding: 9px 16px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}
.starter-btn:hover { background: var(--parchment-dark); }
.pool-hint { opacity: .8; }

.tool-on {
  background: var(--parchment-dark);
  border-radius: 12px;
}

.arc-banner {
  margin: 0;
  animation: banner-in .3s ease both;
  padding: 6px 12px;
  border-radius: 14px;
  background: rgba(175, 30, 45, .85);
  border: 1px solid rgba(255, 190, 200, .6);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  text-align: center;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.arc-clear {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.6);
  color: #fff;
  border-radius: 10px;
  font-size: 11px;
  padding: 2px 8px;
}
.arc-clear:hover { background: rgba(255, 255, 255, 0.15); }

.grid-wrap {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 6px;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: var(--tile-gap);
  width: max-content;
  margin: 0 auto;
}
.grid-head {
  display: flex;
  gap: var(--tile-gap);
  background: rgba(10, 16, 30, .88);
  border-radius: 8px;
  padding: 5px var(--tile-gap);
  margin: 0 calc(var(--tile-gap) * -1) 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .35);
}
.head-cell {
  width: var(--tile-size);
  font-weight: 700;
  font-size: clamp(9px, calc(var(--tile-size) * 0.16), 13px);
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .8);
  text-align: center;
  padding-bottom: 1px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  line-height: 1.15;
}

/* Ten labels across a phone need a smaller face and permission to break. */
@media (max-width: 760px) {
  .head-cell { font-size: 7.5px; overflow-wrap: anywhere; letter-spacing: 0; }
}

.yesterday {
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .9);
  font-size: 15px;
  margin: 4px 0 0;
  background: rgba(12, 18, 34, .68);
  padding: 6px 14px;
  border-radius: 14px;
}

.footer {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 3px rgba(0, 0, 0, .9);
  background: rgba(12, 18, 34, .6);
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 12px;
  text-align: center;
  margin-top: 26px;
}
.footer a { color: #ffd3d8; }
</style>
