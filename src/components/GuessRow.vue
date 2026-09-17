<script setup>
import { fitMetrics, fontsReady } from '../game/textfit.js'
import { COLUMNS } from '../game/compare.js'

const props = defineProps({
  guess: { type: Object, required: true },
  base: { type: String, required: true },
})
const emit = defineEmits(['revealed', 'open'])

const order = COLUMNS.map(c => c.key)

function cellClass(key) {
  const c = props.guess.cells[key]
  return [c.result, { animate: props.guess.animate }]
}

// Size each label so its longest word fits the tile on one line, and so the
// stacked words still fit the tile's height.
function fitStyle(text) {
  void fontsReady.value // re-evaluate once the webfont's real metrics land
  const { widest, lines } = fitMetrics(text)
  return {
    '--fit-w': widest.toFixed(3),
    '--fit-l': (lines * 1.15).toFixed(3),
  }
}
</script>

<template>
  <div class="row">
    <div
      v-for="(key, i) in order" :key="key"
      class="tile" :class="cellClass(key)" :style="{ '--d': i * 0.28 + 's' }"
      @animationend="i === order.length - 1 && emit('revealed')">
      <template v-if="key === 'portrait'">
        <button class="open" type="button" :title="`Open ${guess.char.name}'s card`" @click="emit('open', guess.char)">
          <img
            class="portrait" :src="base + 'portraits/' + guess.char.portrait"
            :alt="guess.char.name" />
          <span class="name">{{ guess.char.name }}</span>
        </button>
      </template>
      <template v-else>
        <span v-if="guess.cells[key].arrow === 'up'" class="arrow" aria-hidden="true">▲</span>
        <span v-if="guess.cells[key].arrow === 'down'" class="arrow" aria-hidden="true">▼</span>
        <span v-if="guess.cells[key].sub" class="stack">
          <span class="txt" :style="fitStyle(guess.cells[key].text)">{{ guess.cells[key].text }}</span>
          <span class="sub" :title="guess.cells[key].sub">{{ guess.cells[key].sub }}</span>
        </span>
        <span v-else class="txt" :style="fitStyle(guess.cells[key].text)">{{ guess.cells[key].text }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  gap: var(--tile-gap);
}

.tile {
  position: relative;
  width: var(--tile-size);
  height: var(--tile-size);
  border-radius: 8px;
  border: var(--tile-border) solid rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #fff;
  font-weight: 700;
  overflow: hidden;
  padding: var(--tile-pad);
}
.tile.exact { background: var(--green); }
.tile.partial { background: var(--yellow); }
.tile.wrong { background: var(--red); }
.tile.neutral { background: #1b2540; padding: 0; }

.tile.animate {
  animation: flip .5s ease both;
  animation-delay: var(--d);
}
@keyframes flip {
  0% { transform: rotateY(90deg); opacity: .2; }
  100% { transform: rotateY(0); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .tile.animate { animation: none; }
}

.open {
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}
.open:hover .portrait { transform: scale(1.06); }
.open:focus-visible { outline: 3px solid #ff98a4; outline-offset: -3px; }
.portrait {
  display: block;
  transition: transform .15s;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  background: radial-gradient(circle at 50% 30%, #4b6390, #1b2540 75%);
}

.name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 3px 3px;
  font-size: clamp(8px, calc(var(--tile-size) * 0.15), 12px);
  line-height: 1.1;
  text-align: center;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .9);
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, .78));
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.txt {
  position: relative;
  z-index: 1;
  line-height: 1.1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  overflow-wrap: break-word;
  font-size: max(6px, min(
    calc(var(--tile-size) * 0.26),
    calc((var(--tile-size) - var(--tile-inset)) / var(--fit-w, 3)),
    calc((var(--tile-size) - var(--tile-inset)) / var(--fit-l, 1.15))
  ));
}

.stack {
  position: relative;
  z-index: 1;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.sub {
  margin-top: 1px;
  font-size: max(6px, calc(var(--tile-size) * 0.13));
  font-weight: 600;
  line-height: 1.05;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .sub { display: none; }
}

.arrow {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--tile-size) * 0.92);
  line-height: 1;
  color: rgba(0, 0, 0, 0.55);
  z-index: 0;
}
</style>
