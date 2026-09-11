<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import {
  draftSentence, formatHeight, formatHeightMetric, formatSeason, formatWeight, lastSeasonSentence,
} from '../game/compare.js'

const props = defineProps({
  player: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const base = import.meta.env.BASE_URL
const p = computed(() => props.player)

const summary = computed(() => {
  const x = p.value
  const role = x.position === 'G' ? `Goalie, catches ${x.shoots === 'L' ? 'left' : 'right'}`
    : `${x.positionName}, shoots ${x.shoots === 'L' ? 'left' : 'right'}`
  const draft = x.draft
    ? `Drafted ${x.draft.overall}${ord(x.draft.overall)} overall by ${x.draft.teamName} in ${x.draft.year}.`
    : 'Never drafted.'
  const tenure = x.nhlGames
    ? `With the Canadiens since ${formatSeason(x.sinceSeason)}, ${x.nhlGames} NHL games so far${x.otherTeams.length ? ` (also ${x.otherTeams.join(', ')})` : ''}.`
    : 'Yet to play an NHL game.'
  return `${role}. Born in ${x.birthplace}. ${draft} ${tenure}`
})

function ord(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

const nhlUrl = computed(() => `https://www.nhl.com/player/${p.value.id}`)

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal panel char-modal">
      <button class="modal-close" @click="emit('close')">×</button>

      <div class="char-head">
        <img class="char-portrait" :src="base + 'portraits/' + p.portrait" :alt="p.name" />
        <div class="char-id">
          <h2>{{ p.name }}</h2>
          <p class="aliases">{{ p.number != null ? `#${p.number} · ` : '' }}{{ p.positionName }}</p>
        </div>
      </div>

      <div class="description"><p>{{ summary }}</p></div>

      <table class="details">
        <tbody>
          <tr><td>Position</td><td>{{ p.positionName }} ({{ p.position }})</td></tr>
          <tr><td>{{ p.position === 'G' ? 'Catches' : 'Shoots' }}</td><td>{{ p.shoots === 'L' ? 'Left' : 'Right' }}</td></tr>
          <tr><td>Number</td><td>{{ p.number != null ? `#${p.number}` : 'Not assigned' }}</td></tr>
          <tr><td>Born</td><td>{{ p.birthDate }} ({{ p.age }}) · {{ p.birthplace }}</td></tr>
          <tr><td>Height</td><td>{{ formatHeight(p.heightIn) }} · {{ formatHeightMetric(p.heightIn) }}</td></tr>
          <tr><td>Weight</td><td>{{ formatWeight(p.weightLb) }}</td></tr>
          <tr><td>Draft</td><td>{{ draftSentence(p.draft) }}</td></tr>
          <tr><td>With CH since</td><td>{{ formatSeason(p.sinceSeason) }}</td></tr>
          <tr><td>NHL games</td><td>{{ p.nhlGames }}</td></tr>
          <tr><td>Last season</td><td>{{ lastSeasonSentence(p) }}</td></tr>
        </tbody>
      </table>

      <a class="wiki-link" :href="nhlUrl" target="_blank" rel="noreferrer">
        Player page on NHL.com ↗
      </a>
    </div>
  </div>
</template>

<style scoped>
.char-modal { max-width: 480px; }

.char-head {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}
.char-portrait {
  width: 108px;
  height: 108px;
  flex: none;
  object-fit: cover;
  object-position: top;
  border-radius: 10px;
  border: 3px solid var(--tan);
  background: radial-gradient(circle at 50% 30%, #4b6390, #1b2540 75%);
}
.char-id { min-width: 0; }
.char-id h2 {
  text-align: left;
  margin: 0 0 4px;
  font-size: 24px;
  line-height: 1.1;
}
.aliases {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--brown);
}

.description { margin: 0 0 12px; }
.description p {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ink);
}

.details {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}
.details td {
  border-top: 1px solid var(--tan);
  padding: 7px 8px 7px 0;
  vertical-align: top;
}
.details td:first-child {
  font-weight: 700;
  white-space: nowrap;
  color: var(--brown-dark);
  width: 38%;
}

.wiki-link {
  display: inline-block;
  margin-top: 16px;
  font-weight: 700;
  color: var(--brown-dark);
}

@media (max-width: 480px) {
  .char-head { flex-direction: column; text-align: center; gap: 10px; }
  .char-id h2 { text-align: center; }
}
</style>
