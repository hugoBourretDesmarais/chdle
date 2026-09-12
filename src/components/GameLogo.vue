<script setup>
import { onMounted, ref, watch } from 'vue'
import { fontsReady } from '../game/textfit.js'
// Drawn as SVG rather than styled HTML: the wordmark needs three stacked
// strokes, a per-letter gradient, a gloss sweep and a grain wash, which
// text-shadow stacking can't express cleanly.
const WORD = 'DLE'
const LETTERS = [...WORD]
const base = import.meta.env.BASE_URL

// The CH mark is 437x299; drawn 176 wide it stands 120 tall, a touch over the
// 83-unit cap height so it reads as the subject. The word starts just past it.
const CH_W = 176
const CH_H = CH_W * 298.85 / 437.31
const TX = CH_W + 18
// Browsers disagree on how wide Lilita One renders (and Safari mangles
// textLength), so the size is measured once the font is in and scaled down to
// fit rather than pinned.
const MAX_W = 430
const BASE_SIZE = 118
const probe = ref(null)
const size = ref(BASE_SIZE)
// Splitting the word into one tspan per letter loses the kerning the stroked
// copies keep, so each fill letter is pinned to where the unsplit run puts it.
const xs = ref(null)
// Where the word ends, so the small crest can trail it.
const endX = ref(TX + 400)

function fit() {
  const el = probe.value
  const w = el?.getComputedTextLength?.()
  if (!w) return
  size.value = Math.min(BASE_SIZE, Math.floor(BASE_SIZE * MAX_W / w * 100) / 100)
  const k = size.value / BASE_SIZE
  const x0 = el.getStartPositionOfChar(0).x
  xs.value = LETTERS.map((_, i) => TX + (el.getStartPositionOfChar(i).x - x0) * k)
  endX.value = TX + w * k
}
onMounted(() => {
  fit()
  document.fonts?.ready.then(fit)
})
watch(fontsReady, fit)

// Bleu, blanc, rouge — the letters cycle through the sweater.
const CYCLE = ['url(#gBlue)', 'url(#gWhite)', 'url(#gRed)']
const fillFor = i => CYCLE[i % CYCLE.length]
</script>

<template>
  <h1 class="logo" aria-label="CHdle">
    <svg class="word" viewBox="0 0 784 150" aria-hidden="true" :style="{ '--t-size': size + 'px' }">
      <text ref="probe" class="probe" x="0" y="-500">{{ WORD }}</text>
      <defs>
        <radialGradient id="crestDisc" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stop-color="#d9364a" />
          <stop offset="60%" stop-color="#a71c2b" />
          <stop offset="100%" stop-color="#6e0f1c" />
        </radialGradient>
        <linearGradient id="ringG" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#c9d4e4" />
        </linearGradient>
        <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff8f98" />
          <stop offset="38%" stop-color="#d42a3c" />
          <stop offset="78%" stop-color="#961523" />
          <stop offset="100%" stop-color="#560a14" />
        </linearGradient>
        <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9db6ff" />
          <stop offset="38%" stop-color="#3a52b5" />
          <stop offset="78%" stop-color="#1c2a6b" />
          <stop offset="100%" stop-color="#0c1440" />
        </linearGradient>
        <linearGradient id="gWhite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="38%" stop-color="#e6edf7" />
          <stop offset="78%" stop-color="#b3c2d8" />
          <stop offset="100%" stop-color="#7c8ea9" />
        </linearGradient>
        <radialGradient id="crestSheen" cx="35%" cy="28%" r="80%">
          <stop offset="0%" stop-color="#fff" stop-opacity=".3" />
          <stop offset="60%" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <clipPath id="crestClip"><circle cx="50" cy="50" r="43" /></clipPath>

        <!-- generated wear map, tiled across the wordmark -->
        <pattern id="wear" patternUnits="userSpaceOnUse" width="260" height="260">
          <image :href="base + 'textures/wear.png'" width="260" height="260"
            preserveAspectRatio="xMidYMid slice" />
        </pattern>

        <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0d1330" stop-opacity="0" />
          <stop offset="66%" stop-color="#0d1330" stop-opacity="0" />
          <stop offset="100%" stop-color="#0d1330" stop-opacity=".42" />
        </linearGradient>
        <linearGradient id="topLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity=".55" />
          <stop offset="16%" stop-color="#fff" stop-opacity=".10" />
          <stop offset="26%" stop-color="#fff" stop-opacity="0" />
        </linearGradient>

        <filter id="cast" x="-15%" y="-30%" width="130%" height="170%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#000" flood-opacity=".5" />
          <feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#000" flood-opacity=".4" />
        </filter>

        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0" />
          <stop offset=".42" stop-color="#fff" stop-opacity=".35" />
          <stop offset=".5" stop-color="#fff" stop-opacity=".9" />
          <stop offset=".58" stop-color="#fff" stop-opacity=".35" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>

        <mask id="wordMask">
          <text class="t" :x="TX" y="112" fill="#fff">{{ WORD }}</text>
        </mask>
        <mask id="shineMask">
          <text class="t" :x="TX" y="112" fill="#fff">{{ WORD }}</text>
        </mask>
      </defs>

      <!-- the club's CH mark, from Wikimedia Commons (public domain) -->
      <g class="mark" filter="url(#cast)">
        <image :href="base + 'logo/ch.svg'" x="0" :y="112 - CH_H + 6" :width="CH_W" :height="CH_H" />
      </g>

      <!-- a small drawn crest trails the word -->
      <g class="tail" :transform="`translate(${endX + 10} 44) scale(0.56)`" filter="url(#cast)">
          <circle cx="50" cy="50" r="50" fill="#0c1424" />
          <circle cx="50" cy="50" r="48" fill="url(#ringG)" />
          <circle cx="50" cy="50" r="43" fill="url(#crestDisc)" />

          <!-- the sweater's blue band, edged in white -->
          <g clip-path="url(#crestClip)">
            <rect x="0" y="39" width="100" height="22" fill="#1c2a6b" />
            <rect x="0" y="39" width="100" height="2.2" fill="#fdfaf0" />
            <rect x="0" y="58.8" width="100" height="2.2" fill="#fdfaf0" />
          </g>

          <!-- crossed sticks and a puck -->
          <g fill="none" stroke="#fdfaf0" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M31 18l31 46c2.6 3.8 6.4 5.4 11.4 4.6l7.6-1.4" />
            <path d="M69 18L38 64c-2.6 3.8-6.4 5.4-11.4 4.6L19 67.2" />
          </g>
          <g fill="none" stroke="#7d1020" stroke-width="1.6" stroke-linecap="round" opacity=".55">
            <path d="M31 18l31 46M69 18L38 64" />
          </g>
          <ellipse cx="50" cy="80.5" rx="10" ry="4.2" fill="#0c1424" />
          <ellipse cx="50" cy="78.5" rx="10" ry="4.2" fill="#2a3344" />
          <ellipse cx="50" cy="78.5" rx="6" ry="2.2" fill="#fff" opacity=".12" />

          <circle cx="50" cy="50" r="43" fill="url(#crestSheen)" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#0c1424" stroke-width="1.5" opacity=".5" />
      </g>

      <g class="letters">
        <g filter="url(#cast)">
          <text class="t" :x="TX" y="112"
            fill="none" stroke="#0c1424" stroke-width="23" stroke-linejoin="round">{{ WORD }}</text>
          <text class="t" :x="TX" y="112"
            fill="none" stroke="#f4f7fb" stroke-width="13" stroke-linejoin="round">{{ WORD }}</text>
          <text class="t" :x="TX" y="112">
            <tspan v-for="(ch, i) in LETTERS" :key="i" :x="xs?.[i]" :fill="fillFor(i)">{{ ch }}</tspan>
          </text>
        </g>

        <g mask="url(#wordMask)">
          <g class="grain">
            <rect x="-260" y="-260" width="1304" height="670" fill="url(#wear)" opacity=".55" />
          </g>
          <rect width="784" height="150" fill="url(#depth)" />
          <rect width="784" height="150" fill="url(#topLight)" />
        </g>
      </g>

      <g mask="url(#shineMask)">
        <g class="shine">
          <rect x="-90" y="-40" width="180" height="230" fill="url(#shine)" transform="skewX(-20)" />
        </g>
      </g>
    </svg>

    <span class="sr">CHdle</span>
  </h1>
</template>

<style scoped>
.logo {
  position: relative;
  margin: 4px 0 0;
  width: min(600px, calc(100% - 14px));
  max-width: 100%;
  user-select: none;
}

.word {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.mark, .letters {
  transform-box: fill-box;
  transform-origin: center;
}
.mark {
  animation: mark-in .6s cubic-bezier(.2, .9, .3, 1.5) both, float 6s ease-in-out 1.1s infinite;
}
.tail {
  animation: tail-in .5s cubic-bezier(.2, .9, .3, 1.5) both .25s;
}
@keyframes tail-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.letters {
  animation: word-in .55s cubic-bezier(.2, .85, .3, 1.35) both .1s, float 6s ease-in-out 1.1s infinite;
}
.grain {
  animation: drift 32s linear infinite;
}
.shine {
  animation: sweep 7s ease-in 1.8s infinite;
}
.probe {
  font-family: 'Lilita One', cursive;
  font-size: 118px;
  letter-spacing: 1px;
  visibility: hidden;
}
.t {
  font-family: 'Lilita One', cursive;
  font-size: var(--t-size, 118px);
  letter-spacing: 1px;
  paint-order: stroke fill;
}

.sr {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@keyframes mark-in {
  from { transform: scale(.35) rotate(-45deg); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@keyframes word-in {
  from { transform: translateY(-14px) scale(.94); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@keyframes sway {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes drift {
  from { transform: translate(0, 0); }
  to { transform: translate(260px, 260px); }
}
@keyframes sweep {
  0% { transform: translateX(-160px); }
  22%, 100% { transform: translateX(900px); }
}

@media (prefers-reduced-motion: reduce) {
  .mark, .letters, .grain, .tail { animation: none; }
  .shine { display: none; }
}
</style>
