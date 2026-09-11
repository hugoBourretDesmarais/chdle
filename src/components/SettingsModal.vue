<script setup>
import { computed, ref } from 'vue'
import { SCOPES, inScope } from '../game/compare.js'

const props = defineProps({
  players: { type: Array, required: true },
  scope: { type: String, default: null },
})
const emit = defineEmits(['close', 'update:scope'])

const pending = ref(props.scope ?? '')

const pendingCount = computed(() => props.players.filter(p => inScope(p, pending.value || null)).length)
const changed = computed(() => (pending.value || null) !== (props.scope ?? null))

function apply() {
  emit('update:scope', pending.value || null)
  emit('close')
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal panel">
      <button class="modal-close" @click="emit('close')">×</button>
      <h2>Settings</h2>

      <h3>Roster</h3>
      <p>
        The full camp roster includes prospects who have yet to play an NHL game. Narrow it if you
        only follow the big club — as the answer, in the guess suggestions and in the roster view.
      </p>

      <label class="arc-field">
        Play with
        <select v-model="pending">
          <option value="">Full 2026-27 camp roster</option>
          <option v-for="s in SCOPES" :key="s.key" :value="s.key">{{ s.label }} ({{ s.hint }})</option>
        </select>
      </label>

      <p class="pool">
        <b>{{ pendingCount }}</b> of {{ players.length }} players would be in play.
      </p>

      <p class="note">
        Players using the same roster share the same daily player. Changing this starts today's
        player over.
      </p>

      <button class="apply" :disabled="!changed" @click="apply">
        {{ changed ? 'Apply' : 'No changes' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
p { font-size: 15px; }
h3 {
  font-family: 'Lilita One', cursive;
  color: var(--brown-dark);
  margin-bottom: 4px;
}
.arc-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 700;
  color: var(--brown-dark);
  font-size: 14px;
  margin: 14px 0 8px;
}
.arc-field select {
  font-family: inherit;
  font-size: 16px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 2px solid var(--tan);
  background: #fff;
  color: var(--ink);
  font-weight: 600;
}
.pool { margin: 6px 0 14px; color: var(--brown); }
.note { font-style: italic; color: var(--brown); font-size: 14px; }
.apply {
  width: 100%;
  border: 2px solid var(--tan);
  background: var(--parchment-dark);
  color: var(--brown-dark);
  font-weight: 700;
  font-size: 16px;
  border-radius: 8px;
  padding: 11px;
  margin-top: 4px;
}
.apply:disabled { opacity: .55; cursor: default; }
.apply:not(:disabled):hover { filter: brightness(.96); }
</style>
