/**
 * The eight-suit deck: a French-suited pack shuffled together with a
 * Spanish-suited one. Suits are paired across the two packs (Spades with
 * Swords, and so on); flushes care about the pair, not the exact suit.
 */

export const SUITS = [
  { id: 'spades', name: 'Spades', pair: 0 },
  { id: 'clubs', name: 'Clubs', pair: 1 },
  { id: 'hearts', name: 'Hearts', pair: 2 },
  { id: 'diamonds', name: 'Diamonds', pair: 3 },
  { id: 'swords', name: 'Swords', pair: 0 },
  { id: 'staves', name: 'Staves', pair: 1 },
  { id: 'cups', name: 'Cups', pair: 2 },
  { id: 'coins', name: 'Coins', pair: 3 },
] as const;

export type SuitId = (typeof SUITS)[number]['id'];

export const PAIR_NAMES = ['Spades & Swords', 'Clubs & Staves', 'Hearts & Cups', 'Diamonds & Coins'] as const;

export interface Card {
  /** Unique within a deck, e.g. "Q-cups". */
  id: string;
  /** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. */
  rank: number;
  suit: SuitId;
}

export const ACE = 1;
export const EIGHT = 8;

const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}

export function suitOf(card: Card) {
  return SUITS.find((s) => s.id === card.suit)!;
}

export function suitPair(card: Card): number {
  return suitOf(card).pair;
}

export function isPicture(card: Card): boolean {
  return card.rank >= 11;
}

export function cardName(card: Card): string {
  return `${rankLabel(card.rank)} of ${suitOf(card).name}`;
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${rankLabel(rank)}-${suit.id}`, rank, suit: suit.id });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle; `random` is injectable so tests can be deterministic. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Small seeded PRNG (mulberry32) for reproducible deals. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
