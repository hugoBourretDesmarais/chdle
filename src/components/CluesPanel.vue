<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { draftSentence, lastSeasonSentence } from '../game/compare.js'

const props = defineProps({
  answer: { type: Object, required: true },
  tries: { type: Number, required: true },
  won: { type: Boolean, required: true },
})

const BIRTH_AT = 5
const DRAFT_AT = 8
const SEASON_AT = 10

const showBirth = ref(false)
const showDraft = ref(false)
const showSeason = ref(false)
watch(() => props.answer, () => {
  showBirth.value = false
  showDraft.value = false
  showSeason.value = false
})

const birthUnlocked = computed(() => props.won || props.tries >= BIRTH_AT)
const draftUnlocked = computed(() => props.won || props.tries >= DRAFT_AT)
const seasonUnlocked = computed(() => props.won || props.tries >= SEASON_AT)
const birthLeft = computed(() => Math.max(0, BIRTH_AT - props.tries))
const draftLeft = computed(() => Math.max(0, DRAFT_AT - props.tries))
const seasonLeft = computed(() => Math.max(0, SEASON_AT - props.tries))

const draftText = computed(() => draftSentence(props.answer.draft))
const seasonText = computed(() => lastSeasonSentence(props.answer))
</script>

<template>
  <div class="clues">
    <div class="clue">
      <button class="clue-btn" :disabled="!birthUnlocked" @click="showBirth = !showBirth">
        <Icon class="clue-ico" name="pin" :size="30" />
        <span class="clue-label">Birthplace Clue</span>
        <span v-if="!birthUnlocked" class="clue-lock">in {{ birthLeft }} {{ birthLeft === 1 ? 'try' : 'tries' }}</span>
      </button>
      <p v-if="showBirth && birthUnlocked" class="clue-value">{{ answer.birthplace }}</p>
    </div>
    <div class="clue">
      <button class="clue-btn" :disabled="!draftUnlocked" @click="showDraft = !showDraft">
        <Icon class="clue-ico" name="draft" :size="30" />
        <span class="clue-label">Draft Clue</span>
        <span v-if="!draftUnlocked" class="clue-lock">in {{ draftLeft }} {{ draftLeft === 1 ? 'try' : 'tries' }}</span>
      </button>
      <p v-if="showDraft && draftUnlocked" class="clue-value">{{ draftText }}</p>
    </div>
    <div class="clue">
      <button class="clue-btn" :disabled="!seasonUnlocked" @click="showSeason = !showSeason">
        <Icon class="clue-ico" name="stats" :size="30" />
        <span class="clue-label">Last Season Clue</span>
        <span v-if="!seasonUnlocked" class="clue-lock">in {{ seasonLeft }} {{ seasonLeft === 1 ? 'try' : 'tries' }}</span>
      </button>
      <p v-if="showSeason && seasonUnlocked" class="clue-value">{{ seasonText }}</p>
    </div>
  </div>
</template>

<style scoped>
.clues {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.clue {
  flex: 1;
  min-width: 160px;
  max-width: 220px;
}
.clue-btn {
  width: 100%;
  min-height: 108px;
  border: 2px solid var(--tan);
  border-radius: 8px;
  background: var(--parchment);
  color: var(--brown);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
}
.clue-btn:not(:disabled):hover {
  background: var(--parchment-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, .18);
}
.clue-value { animation: clue-in .25s ease both; }
@keyframes clue-in {
  from { transform: translateY(-4px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.clue-btn:disabled { opacity: .6; cursor: default; }
.clue-ico { color: var(--brown); }
.clue-label {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 13px;
  letter-spacing: .5px;
}
.clue-lock { font-size: 12px; font-style: italic; }
.clue-value {
  margin: 8px 0 0;
  font-weight: 700;
  color: var(--brown-dark);
}
</style>
