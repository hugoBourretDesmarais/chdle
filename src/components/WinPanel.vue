<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  answer: { type: Object, required: true },
  tries: { type: Number, required: true },
  mode: { type: String, required: true },
  countdown: { type: String, required: true },
  guesses: { type: Array, required: true },
  dailyNumber: { type: Number, required: true },
})
const emit = defineEmits(['practice', 'replay', 'open'])

const base = import.meta.env.BASE_URL
const copied = ref(false)

const EMOJI = { exact: '🟩', partial: '🟧', wrong: '🟥', neutral: '⬛' }
const order = ['position', 'shoots', 'country', 'number', 'age', 'height', 'draft', 'salary', 'since']

const shareText = computed(() => {
  const rows = [...props.guesses].reverse()
    .map(g => order.map(k => EMOJI[g.cells[k].result] || '⬛').join(''))
  return `I found the CHdle player #${props.dailyNumber} in ${props.tries} ${props.tries === 1 ? 'try' : 'tries'}!\n\n${rows.join('\n')}`
})

async function share() {
  try {
    await navigator.clipboard.writeText(shareText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch { /* clipboard unavailable */ }
}
</script>

<template>
  <section class="panel win">
    <h2>GOAL! 🚨</h2>
    <button class="win-open" type="button" :title="`Open ${answer.name}'s card`" @click="emit('open', answer)">
      <img class="win-portrait" :src="base + 'portraits/' + answer.portrait" :alt="answer.name" />
      <span class="win-hint">Player card</span>
    </button>
    <p class="win-name">{{ answer.name }}</p>
    <p class="win-codename">{{ answer.number != null ? `#${answer.number} · ` : '' }}{{ answer.positionName }}</p>
    <p class="win-tries">
      Found in <b>{{ tries }}</b> {{ tries === 1 ? 'try' : 'tries' }}
    </p>
    <template v-if="mode === 'daily'">
      <p class="win-next">Next character in <b class="countdown">{{ countdown }}</b></p>
      <div class="win-actions">
        <button class="win-btn" @click="share"><Icon name='share' :size='16' /> {{ copied ? 'Copied!' : 'Share' }}</button>
        <button class="win-btn" @click="emit('practice')">Practice mode</button>
      </div>
    </template>
    <template v-else>
      <div class="win-actions">
        <button class="win-btn" @click="emit('replay')">Play again</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.win {
  width: min(440px, 100%);
  padding: 20px;
  text-align: center;
  animation: pop .35s ease;
}
@keyframes portrait-pop {
  from { transform: scale(.5) rotate(-8deg); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@keyframes pop {
  0% { transform: scale(.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
h2 {
  font-family: 'Lilita One', cursive;
  color: var(--green);
  margin: 0 0 10px;
  font-size: 30px;
}
.win-open {
  position: relative;
  display: inline-block;
  padding: 0;
  border: none;
  background: none;
  border-radius: 10px;
  overflow: hidden;
  line-height: 0;
}
.win-open:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0, 0, 0, .25); }
.win-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 0 5px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .9);
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, .7));
}
.win-portrait {
  display: block;
  animation: portrait-pop .45s cubic-bezier(.2, .9, .3, 1.5) both .05s;
  width: 110px;
  height: 110px;
  object-fit: cover;
  object-position: top;
  border-radius: 10px;
  border: 3px solid var(--green);
  background: radial-gradient(circle at 50% 30%, #4b6390, #1b2540 75%);
}
.win-name {
  font-family: 'Lilita One', cursive;
  font-size: 24px;
  color: var(--brown-dark);
  margin: 8px 0 2px;
}
.win-codename {
  margin: 0 0 4px;
  font-weight: 700;
  color: var(--brown);
}
.win-tries { margin: 0 0 6px; }
.win-next { margin: 0; color: var(--brown); }
.countdown { font-variant-numeric: tabular-nums; }
.win-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 14px;
}
.win-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 2px solid var(--tan);
  background: var(--parchment-dark);
  color: var(--brown-dark);
  font-weight: 700;
  border-radius: 8px;
  padding: 9px 14px;
}
.win-btn:hover { filter: brightness(.96); }
</style>
