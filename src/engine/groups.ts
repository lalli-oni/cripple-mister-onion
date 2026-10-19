/**
 * Recognising and ranking the groupings a player can display at showdown.
 *
 * Card values follow Blackjack: Aces are 1 or 11, picture cards are 10,
 * everything else is its face value. Under the Null Eights modifier an
 * eight may also count as 0. When eights are wild, an eight can stand in
 * for any card at all.
 */
import { ACE, EIGHT, isPicture, suitPair, type Card } from './cards';

export const Tier = {
  Bagel: 1,
  Onion2: 2,
  BrokenFlush: 3,
  Onion3: 4,
  Flush: 5,
  Onion4: 6,
  BrokenRoyal: 7,
  Onion5: 8,
  Royal: 9,
  Onion6: 10,
  WildRoyal: 11,
  Onion7: 12,
  DoubleOnion: 13,
  TripleOnion: 14,
  LesserOnion: 15,
  GreatOnion: 16,
} as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

export const TIER_NAMES: Record<Tier, string> = {
  [Tier.Bagel]: 'Bagel',
  [Tier.Onion2]: 'Two-card Onion',
  [Tier.BrokenFlush]: 'Broken Flush',
  [Tier.Onion3]: 'Three-card Onion',
  [Tier.Flush]: 'Flush',
  [Tier.Onion4]: 'Four-card Onion',
  [Tier.BrokenRoyal]: 'Broken Royal',
  [Tier.Onion5]: 'Five-card Onion',
  [Tier.Royal]: 'Royal',
  [Tier.Onion6]: 'Six-card Onion',
  [Tier.WildRoyal]: 'Wild Royal',
  [Tier.Onion7]: 'Seven-card Onion',
  [Tier.DoubleOnion]: 'Double Onion',
  [Tier.TripleOnion]: 'Triple Onion',
  [Tier.LesserOnion]: 'Lesser Onion',
  [Tier.GreatOnion]: 'Great Onion',
};

const ONION_TIERS: Record<number, Tier> = {
  2: Tier.Onion2,
  3: Tier.Onion3,
  4: Tier.Onion4,
  5: Tier.Onion5,
  6: Tier.Onion6,
  7: Tier.Onion7,
};

const MULTI_ONION_TIERS: Record<number, Tier> = {
  2: Tier.DoubleOnion,
  3: Tier.TripleOnion,
  4: Tier.LesserOnion,
  5: Tier.GreatOnion,
};

export interface RuleOptions {
  /** Eights are wild this hand (follows a hand in which Null Eights were used). */
  eightsWild: boolean;
  /** Eights may count as zero (only when they are not wild). */
  nullEights: boolean;
}

export interface Declaration {
  cards: Card[];
  label: string;
  /** Ordinary ranking; ignored for running flushes. */
  tier: Tier | 0;
  /** Tie-break within a tier: higher is better. */
  sub: number;
  /** Eights counted as zero to make this grouping. */
  nullEights: number;
  /** A 9- or 10-card running flush, which can only cripple. */
  crippler?: 9 | 10;
  /** Eight eights (eights wild): a Lesser Onion that falls to a Great-Onion crippler. */
  crippleAsGreat?: boolean;
}

function isWild(card: Card, opts: RuleOptions): boolean {
  return opts.eightsWild && card.rank === EIGHT;
}

/** Possible [value, nullEightsUsed] for one card. */
function valueOptions(card: Card, opts: RuleOptions): Array<[number, number]> {
  if (isWild(card, opts)) return Array.from({ length: 11 }, (_, i) => [i + 1, 0]);
  if (card.rank === ACE) return [[1, 0], [11, 0]];
  if (isPicture(card)) return [[10, 0]];
  if (card.rank === EIGHT && opts.nullEights && !opts.eightsWild) return [[8, 0], [0, 1]];
  return [[card.rank, 0]];
}

/** Every reachable total up to 21, mapped to the fewest null eights needed. */
export function reachableTotals(cards: Card[], opts: RuleOptions): Map<number, number> {
  let totals = new Map<number, number>([[0, 0]]);
  for (const card of cards) {
    const next = new Map<number, number>();
    for (const [sum, nulls] of totals) {
      for (const [value, isNull] of valueOptions(card, opts)) {
        const s = sum + value;
        if (s > 21) continue;
        const n = nulls + isNull;
        if (!next.has(s) || next.get(s)! > n) next.set(s, n);
      }
    }
    totals = next;
  }
  return totals;
}

function pairSpread(cards: Card[], opts: RuleOptions) {
  const counts = [0, 0, 0, 0];
  let natural = 0;
  for (const c of cards) {
    if (isWild(c, opts)) continue;
    counts[suitPair(c)]++;
    natural++;
  }
  // How many natural cards sit outside the most common suit-pair.
  return natural - Math.max(...counts);
}

function runningFlushLength(cards: Card[], opts: RuleOptions): 9 | 10 | null {
  const n = cards.length;
  if (n !== 9 && n !== 10) return null;
  if (pairSpread(cards, opts) !== 0) return null;
  const ranks = cards.filter((c) => !isWild(c, opts)).map((c) => c.rank);
  if (new Set(ranks).size !== ranks.length) return null;
  // Aces may run low (A-2-3) or high (Q-K-A): rank line is 1..14.
  for (let start = 1; start + n - 1 <= 14; start++) {
    const end = start + n - 1;
    const fits = ranks.every((r) =>
      r === ACE ? start === 1 || end === 14 : r >= start && r <= end,
    );
    if (fits) return n as 9 | 10;
  }
  return null;
}

function better(a: Declaration | null, b: Declaration): Declaration {
  if (!a) return b;
  return compareDeclarations(b, a) > 0 ? b : a;
}

/**
 * The strongest ordinary grouping these exact cards form, or null.
 * Running flushes are returned separately (see `crippler`) because they
 * are worthless except as a crippling play.
 */
export function classifyGroup(cards: Card[], opts: RuleOptions): Declaration | null {
  const n = cards.length;
  if (n < 2) return null;

  const rf = runningFlushLength(cards, opts);
  if (rf) {
    return { cards, tier: 0, sub: rf, nullEights: 0, crippler: rf, label: `${rf === 9 ? 'Nine' : 'Ten'}-card Running Flush` };
  }

  let best: Declaration | null = null;
  const make = (tier: Tier, sub = 0, nullEights = 0, extra: Partial<Declaration> = {}): Declaration => ({
    cards,
    tier,
    sub,
    nullEights,
    label: TIER_NAMES[tier],
    ...extra,
  });

  const natural = cards.filter((c) => !isWild(c, opts));
  const wilds = n - natural.length;

  // Eight eights with eights wild: a Lesser Onion that beats other Lesser Onions.
  if (n === 8 && opts.eightsWild && wilds === 8) {
    best = better(best, make(Tier.LesserOnion, 1, 0, { crippleAsGreat: true, label: 'Lesser Onion (eight eights)' }));
  }

  // Double/Triple/Lesser/Great Onion: k Aces paired with k picture cards.
  if (n % 2 === 0 && MULTI_ONION_TIERS[n / 2]) {
    const k = n / 2;
    const aces = natural.filter((c) => c.rank === ACE).length;
    const pics = natural.filter(isPicture).length;
    if (aces + pics === natural.length && aces <= k && pics <= k) {
      best = better(best, make(MULTI_ONION_TIERS[k]));
    }
  }

  if (n === 3) {
    const ranks = natural.map((c) => c.rank);
    if (opts.eightsWild && cards.every((c) => c.rank === EIGHT)) best = better(best, make(Tier.WildRoyal));
    if (ranks.every((r) => r === 7)) best = better(best, make(Tier.Royal));
    if (new Set(ranks).size === ranks.length && ranks.every((r) => r >= 6 && r <= 8)) {
      best = better(best, make(Tier.BrokenRoyal));
    }
  }

  const totals = reachableTotals(cards, opts);

  if (n <= 7 && totals.has(21)) {
    const nulls = totals.get(21)!;
    best = better(best, make(ONION_TIERS[n], -nulls, nulls));
  }

  if (n === 2 && totals.has(20)) best = better(best, make(Tier.Bagel, 0, totals.get(20)!));

  if (n >= 3) {
    const spread = pairSpread(cards, opts);
    if (spread <= 1) {
      for (let t = 21; t >= 16; t--) {
        if (!totals.has(t)) continue;
        best = better(best, make(spread === 0 ? Tier.Flush : Tier.BrokenFlush, t, totals.get(t)!));
        break;
      }
    }
  }

  return best;
}

/** Positive if a outranks b, negative if b outranks a, 0 if neither does. */
export function compareDeclarations(a: Declaration, b: Declaration): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.sub - b.sub;
}

/** Can `challenger` be displayed on top of `current` (null = first to show)? */
export function beats(challenger: Declaration, current: Declaration | null): boolean {
  if (challenger.crippler) {
    if (!current) return false;
    if (current.tier === Tier.GreatOnion || current.crippleAsGreat) return true;
    return current.tier === Tier.LesserOnion && challenger.crippler === 10;
  }
  if (!current) return true;
  if (current.crippler) return false;
  return compareDeclarations(challenger, current) > 0;
}

export function isCripple(challenger: Declaration): boolean {
  return Boolean(challenger.crippler);
}

/** All subsets of `hand` with at least two cards. */
function* subsets(hand: Card[]): Generator<Card[]> {
  const n = hand.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    if ((mask & (mask - 1)) === 0) continue; // single card
    const group: Card[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) group.push(hand[i]);
    yield group;
  }
}

/** The strongest grouping in `hand` that may be shown over `current`; cripples win outright. */
export function bestDeclaration(hand: Card[], opts: RuleOptions, current: Declaration | null = null): Declaration | null {
  let best: Declaration | null = null;
  for (const group of subsets(hand)) {
    const d = classifyGroup(group, opts);
    if (!d || !beats(d, current)) continue;
    if (d.crippler) return d;
    // Prefer the stronger grouping; on a tie, the one that uses fewer cards.
    if (!best || compareDeclarations(d, best) > 0 || (compareDeclarations(d, best) === 0 && d.cards.length < best.cards.length)) {
      best = d;
    }
  }
  return best;
}
