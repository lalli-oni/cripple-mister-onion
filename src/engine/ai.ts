/**
 * Simple computer opponents. They play honestly: they only look at their
 * own cards plus whatever is face up on the table.
 */
import { ACE, isPicture, type Card } from './cards';
import { Tier, bestDeclaration, classifyGroup, type RuleOptions } from './groups';
import { callAmount, canRaise, currentPlayer, ruleOptions, tableDeclaration, type Action, type GameState } from './game';

/** 0..1 rough confidence in a hand. */
export function handStrength(hand: Card[], opts: RuleOptions): number {
  const best = bestDeclaration(hand, opts);
  if (!best) return 0;
  // Five-card hands top out lower, so scale by what's reachable.
  const ceiling = hand.length <= 5 ? Tier.DoubleOnion : Tier.GreatOnion;
  return Math.min(1, best.tier / ceiling);
}

function keepScore(card: Card, opts: RuleOptions): number {
  if (opts.eightsWild && card.rank === 8) return 10;
  if (card.rank === ACE) return 6;
  if (isPicture(card)) return 5;
  if (card.rank === 10) return 3;
  if (card.rank >= 6 && card.rank <= 8) return 2;
  return 1;
}

export function chooseDiscards(hand: Card[], opts: RuleOptions): string[] {
  const best = bestDeclaration(hand, opts);
  const keep = new Set(best && best.tier >= Tier.Onion2 ? best.cards.map((c) => c.id) : []);
  return hand
    .filter((c) => !keep.has(c.id))
    .map((c) => ({ c, s: keepScore(c, opts) }))
    .filter(({ s }) => s <= 3)
    .sort((a, b) => a.s - b.s)
    .slice(0, 4)
    .map(({ c }) => c.id);
}

export function chooseAction(state: GameState, random: () => number = Math.random): Action {
  const me = currentPlayer(state);
  if (!me) return { type: 'nextHand' };
  const opts = ruleOptions(state);

  if (state.phase === 'discard') return { type: 'discard', cardIds: chooseDiscards(me.hand, opts) };

  if (state.phase === 'showdown') {
    const onTable = tableDeclaration(state)?.declaration ?? null;
    const d = bestDeclaration(me.hand, opts, onTable);
    return d ? { type: 'declare', cardIds: d.cards.map((c) => c.id) } : { type: 'throwIn' };
  }

  // Betting.
  const strength = handStrength(me.hand, opts) + (random() - 0.5) * 0.15;
  const cost = callAmount(state, me);
  const pressure = cost / Math.max(1, me.chips + cost);
  if (strength > 0.7 && canRaise(state, me) && random() < 0.7) return { type: 'raise' };
  if (strength > 0.45 && canRaise(state, me) && random() < 0.25) return { type: 'raise' };
  if (cost === 0) return { type: 'call' };
  if (strength > 0.3 || pressure < 0.05 || (strength > 0.15 && pressure < 0.15)) return { type: 'call' };
  return { type: 'fold' };
}

/** Label for whatever these cards form, for the UI. */
export function describe(cards: Card[], opts: RuleOptions): string | null {
  return classifyGroup(cards, opts)?.label ?? null;
}
