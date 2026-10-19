import type { Card, SuitId } from './cards';
import { Tier, beats, bestDeclaration, classifyGroup, type RuleOptions } from './groups';

const plain: RuleOptions = { eightsWild: false, nullEights: false };
const nulls: RuleOptions = { eightsWild: false, nullEights: true };
const wild: RuleOptions = { eightsWild: true, nullEights: false };

let n = 0;
/** c('A', 'spades'), c(10, 'cups') ... */
function c(rank: number | 'A' | 'J' | 'Q' | 'K', suit: SuitId = 'spades'): Card {
  const r = typeof rank === 'number' ? rank : { A: 1, J: 11, Q: 12, K: 13 }[rank];
  return { id: `${r}-${suit}-${n++}`, rank: r, suit };
}

const tierOf = (cards: Card[], opts = plain) => classifyGroup(cards, opts)?.tier ?? null;

describe('classifyGroup', () => {
  it('scores Ace + picture as a two-card Onion and two pictures as a Bagel', () => {
    expect(tierOf([c('A'), c('K', 'cups')])).toBe(Tier.Onion2);
    expect(tierOf([c('Q'), c('J', 'coins')])).toBe(Tier.Bagel);
  });

  it('counts Onions by number of cards, up to seven', () => {
    expect(tierOf([c(7), c(7, 'cups'), c(7, 'hearts')])).toBe(Tier.Royal); // 777 outranks a 3-card Onion
    expect(tierOf([c(5), c(6, 'cups'), c(10, 'hearts')])).toBe(Tier.Onion3);
    expect(tierOf([c(2), c(3, 'cups'), c(4, 'hearts'), c(5, 'clubs'), c(7, 'coins')])).toBe(Tier.Onion5);
    expect(tierOf([c('A'), c(2, 'cups'), c(3, 'hearts'), c(4, 'clubs'), c(5, 'coins'), c(6, 'staves')])).toBe(Tier.Onion6);
  });

  it('recognises flushes by suit-pair', () => {
    // Spades and Swords are the same pair; 9+8 = 17.
    expect(tierOf([c(9, 'spades'), c(5, 'swords'), c(3, 'spades')])).toBe(Tier.Flush);
    expect(tierOf([c(9, 'spades'), c(5, 'swords'), c(3, 'hearts')])).toBe(Tier.BrokenFlush);
    expect(tierOf([c(9, 'spades'), c(5, 'cups'), c(3, 'clubs')])).toBeNull();
  });

  it('recognises Royals', () => {
    expect(tierOf([c(6), c(7, 'cups'), c(8, 'hearts')])).toBe(Tier.BrokenRoyal);
    expect(tierOf([c(8), c(8, 'cups'), c(8, 'hearts')], wild)).toBe(Tier.WildRoyal);
  });

  it('builds Double to Great Onions from Aces and picture cards', () => {
    expect(tierOf([c('A'), c('K'), c('A', 'cups'), c('Q', 'cups')])).toBe(Tier.DoubleOnion);
    const great = [c('A'), c('A', 'cups'), c('A', 'coins'), c('A', 'staves'), c('A', 'hearts'), c('K'), c('K', 'cups'), c('J'), c('Q'), c('Q', 'coins')];
    expect(tierOf(great)).toBe(Tier.GreatOnion);
  });

  it('lets an eight count as zero under Null Eights', () => {
    const hand = [c('A'), c('K', 'clubs'), c(8, 'cups')];
    expect(tierOf(hand, plain)).toBeNull();
    const d = classifyGroup(hand, nulls)!;
    expect(d.tier).toBe(Tier.Onion3);
    expect(d.nullEights).toBe(1);
  });

  it('treats eights as anything when wild', () => {
    expect(tierOf([c(8), c('K')], wild)).toBe(Tier.Onion2);
    expect(tierOf([c(8), c('K'), c('A', 'cups'), c(8, 'hearts')], wild)).toBe(Tier.DoubleOnion);
  });

  it('spots running flushes as cripplers only', () => {
    const run = [2, 3, 4, 5, 6, 7, 9, 10, 11].map((r, i) => c(r, i % 2 ? 'spades' : 'swords'));
    expect(classifyGroup(run, plain)).toBeNull(); // gap at 8
    const run9 = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r, i) => c(r, i % 2 ? 'spades' : 'swords'));
    expect(classifyGroup(run9, plain)?.crippler).toBe(9);
    const aceHigh = [5, 6, 7, 8, 9, 10, 11, 12, 13, 1].map((r) => c(r, 'hearts'));
    expect(classifyGroup(aceHigh, plain)?.crippler).toBe(10);
  });
});

describe('beats', () => {
  const great = classifyGroup([c('A'), c('A'), c('A'), c('A'), c('A'), c('K'), c('K'), c('K'), c('K'), c('K')], plain)!;
  const lesser = classifyGroup([c('A'), c('A'), c('A'), c('A'), c('K'), c('K'), c('K'), c('K')], plain)!;
  const run9 = classifyGroup([2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => c(r, 'cups')), plain)!;
  const run10 = classifyGroup([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => c(r, 'cups')), plain)!;
  const bagel = classifyGroup([c('K'), c('Q')], plain)!;

  it('needs a strictly better grouping', () => {
    expect(beats(bagel, null)).toBe(true);
    expect(beats(bagel, bagel)).toBe(false);
    expect(beats(great, lesser)).toBe(true);
  });

  it('only lets running flushes cripple the big Onions', () => {
    expect(beats(run9, null)).toBe(false);
    expect(beats(run9, bagel)).toBe(false);
    expect(beats(run9, great)).toBe(true);
    expect(beats(run9, lesser)).toBe(false);
    expect(beats(run10, lesser)).toBe(true);
  });

  it('prefers the Onion with fewer null eights', () => {
    const clean = classifyGroup([c('A'), c(9, 'clubs'), c('A', 'cups')], nulls)!; // 11+9+1
    const dirty = classifyGroup([c('A'), c('K', 'clubs'), c(8, 'cups')], nulls)!;
    expect(clean.tier).toBe(dirty.tier);
    expect(beats(clean, dirty)).toBe(true);
    expect(beats(dirty, clean)).toBe(false);
  });
});

describe('bestDeclaration', () => {
  it('finds the strongest grouping hidden in ten cards', () => {
    const hand = [c('A'), c('K'), c('A', 'cups'), c('Q', 'cups'), c(2), c(3), c(4, 'coins'), c(9), c(5, 'hearts'), c(6, 'clubs')];
    expect(bestDeclaration(hand, plain)?.tier).toBe(Tier.DoubleOnion);
  });
});
