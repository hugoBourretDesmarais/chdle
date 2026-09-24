<script setup>
const emit = defineEmits(['close'])
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal panel">
      <button class="modal-close" @click="emit('close')">×</button>
      <h2>How to play</h2>
      <p>Guess today's <i>Montréal Canadiens</i> player from the 2026-27 roster. Each guess reveals the player's properties and how they compare to the hidden player.</p>
      <ul class="colors">
        <li><span class="swatch exact"></span><b>Green</b> — exact match</li>
        <li><span class="swatch partial"></span><b>Yellow</b> — partial match (some overlap)</li>
        <li><span class="swatch wrong"></span><b>Red</b> — no match</li>
      </ul>
      <p>On <b>Number</b>, <b>Age</b>, <b>Height</b>, <b>Draft</b>, <b>Cap hit</b> and <b>With CH since</b>, an arrow shows whether the hidden player's value is <b>▲ higher/later</b> or <b>▼ lower/earlier</b> than your guess.</p>

      <h3>Properties</h3>
      <table class="props">
        <tbody>
          <tr><td>Position</td><td>C, LW, RW, D or G. Yellow when both are forwards but not the same one</td></tr>
          <tr><td>Shoots</td><td>L or R — the catching hand for a goalie</td></tr>
          <tr><td>Country</td><td>Nationality, as listed on NHL.com</td></tr>
          <tr><td>Number</td><td>Sweater number at camp. Prospects without one show —</td></tr>
          <tr><td>Age</td><td>Age today</td></tr>
          <tr><td>Height</td><td>In feet and inches; the arrow points to taller or shorter</td></tr>
          <tr><td>Draft</td><td>Round and the club that picked the player. Yellow when only the round or only the club matches; the arrow follows the round. Undrafted players only match each other</td></tr>
          <tr><td>Cap hit</td><td>2026-27 salary-cap hit, with arrows. An unsigned restricted free agent shows RFA and only matches another one</td></tr>
          <tr><td>With CH since</td><td>First regular season with the Canadiens. A newcomer or prospect counts as 2026-27</td></tr>
        </tbody>
      </table>

      <p>Tap a guessed player's portrait — or the winner's — to open their full card.</p>

      <h3>Clues</h3>
      <p>Stuck? After 5 guesses you unlock the <b>Birthplace</b> clue, after 8 the <b>Last Season</b> clue (the player's most recent stat line) and after 10 the <b>Draft</b> clue (year, round, overall pick and club).</p>
      <h3>Modes</h3>
      <table class="props">
        <tbody>
          <tr><td>🏒 Classic</td><td>One player per day, shared by everyone. Resets at your local midnight.</td></tr>
          <tr><td>🎲 Practice</td><td>Unlimited random players — hit <b>New player</b> any time to reroll.</td></tr>
          <tr><td>🛡️ Logo quiz</td><td>Name the NHL team from its logo, all 32 clubs. Every miss unlocks a hint (conference, division, founding year, first letter). Solving keeps your streak going; showing the answer ends it.</td></tr>
          <tr><td>🃏 Flashcards</td><td>Spaced repetition, Anki-style, with two decks: <b>Numbers</b> (type a Canadien's sweater number) and <b>Logos</b> (name the team). Rate each card Again, Hard, Good or Easy: a miss comes back within a couple of cards, and every Good pushes it further down the pile, so you can keep going as long as you like. New cards join once nothing is waiting, the most experienced players and the Atlantic Division first; progress is saved on this device.</td></tr>
          <tr><td>📋 Roster</td><td>Browse the whole 2026-27 camp roster and search by name, position, country or draft. Tap a card for full details, or untick it to keep it out of practice mode.</td></tr>
        </tbody>
      </table>

      <h3>🏆 Leaderboard</h3>
      <p>
        Pick a pseudonym and a password to join — no email required. Sign in with the same two on
        any device and your ranked record follows you. The same account works on
        <a href="https://hugobourretdesmarais.github.io/onepiecedle/">OnePieceDle</a> and
        <a href="https://hugobourretdesmarais.github.io/avatardle/">AvatarDle</a>, and signing in
        on one signs you in on the others. There's no password reset yet, so don't reuse
        an important password. Every classic win is ranked, and the board shows the roster
        each player last won under. Your local 📊 stats stay on this device and are separate from
        your ranked record.
      </p>

      <h3>Roster</h3>
      <p>
        Open <b>Settings</b> to play with NHL veterans only — players with at least one NHL game —
        instead of the full camp roster with its prospects.
      </p>

      <p class="note">Roster, bios, headshots and team logos come from NHL.com and reflect the 2026-27 training camp roster. Fan project.</p>
    </div>
  </div>
</template>

<style scoped>
p, li { font-size: 15px; }
h3 {
  font-family: 'Lilita One', cursive;
  color: var(--brown-dark);
  margin-bottom: 4px;
}
.colors {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.props {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.props td {
  border-top: 1px solid var(--tan);
  padding: 5px 8px 5px 0;
  vertical-align: top;
}
.props td:first-child {
  font-weight: 700;
  white-space: nowrap;
  color: var(--brown-dark);
}
.note { font-style: italic; color: var(--brown); }
</style>
