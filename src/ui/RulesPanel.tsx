import { TIER_NAMES, Tier } from '../engine/groups';

const EXAMPLES: Partial<Record<Tier, string>> = {
  [Tier.Bagel]: 'two cards making 20, e.g. K + Q',
  [Tier.Onion2]: 'A + a picture card',
  [Tier.BrokenFlush]: '3+ cards totalling 16–21, all but one in the same suit-pair',
  [Tier.Onion3]: 'three cards making exactly 21',
  [Tier.Flush]: '3+ cards totalling 16–21, all in one suit-pair',
  [Tier.Onion4]: 'four cards making 21',
  [Tier.BrokenRoyal]: '6, 7, 8 of any suits',
  [Tier.Onion5]: 'five cards making 21',
  [Tier.Royal]: '7, 7, 7',
  [Tier.Onion6]: 'six cards making 21',
  [Tier.WildRoyal]: '8, 8, 8 when eights are wild',
  [Tier.Onion7]: 'seven cards making 21 (there is no eight-card Onion)',
  [Tier.DoubleOnion]: 'two Aces + two picture cards',
  [Tier.TripleOnion]: 'three Aces + three picture cards',
  [Tier.LesserOnion]: 'four Aces + four picture cards',
  [Tier.GreatOnion]: 'five Aces + five picture cards',
};

export function RulesPanel({ onClose }: { onClose: () => void }) {
  const tiers = (Object.values(Tier) as Tier[]).sort((a, b) => b - a);
  return (
    <aside className="rules" aria-label="Rules">
      <div className="rules-head">
        <h2>How to play</h2>
        <button type="button" className="ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <p>
        <strong>Cards.</strong> Two packs shuffled together: Spades, Clubs, Hearts, Diamonds and Swords, Staves, Cups, Coins. Suits
        come in pairs (Spades &amp; Swords, Clubs &amp; Staves, Hearts &amp; Cups, Diamonds &amp; Coins), shown by colour. Aces count
        1 or 11, picture cards 10, the rest face value.
      </p>
      <p>
        <strong>A hand.</strong> Everyone antes. Five cards each, face down; swap up to four. Bet. Five more each, face up (the
        Dealer's face down). Bet again.
      </p>
      <p>
        <strong>Showdown.</strong> Starting left of the Dealer, each player shows one grouping from their ten cards that beats
        the one on the table, or throws in. The last grouping standing takes the pot.
      </p>
      <p>
        <strong>Crippling.</strong> A nine-card running flush (consecutive ranks in one suit-pair) is useless on its own, but
        played on a Great Onion it <em>cripples</em> it and wins at once. A ten-card running flush can cripple a Lesser Onion
        too.
      </p>
      <p>
        <strong>Null Eights</strong> (optional). An eight may count as 0. If anyone does, eights are wild for the next hand.
        Between equal Onions, the one with fewer null eights wins.
      </p>
      <h3>Groupings, best first</h3>
      <ol className="tiers">
        {tiers.map((t) => (
          <li key={t}>
            <strong>{TIER_NAMES[t]}</strong> <span className="muted">{EXAMPLES[t]}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
