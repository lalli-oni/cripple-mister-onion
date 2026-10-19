import { seededRandom, type Card } from './cards';
import { chooseAction } from './ai';
import { applyAction, currentPlayer, newGame, tableDeclaration, type GameState } from './game';

function autoplay(state: GameState, random: () => number, maxSteps = 2000): GameState {
  for (let i = 0; i < maxSteps && state.phase !== 'gameOver'; i++) {
    if (state.phase === 'handOver') {
      if (state.handNumber >= 15) return state;
      state = applyAction(state, { type: 'nextHand' }, random);
      continue;
    }
    const before = state;
    state = applyAction(state, chooseAction(state, random), random);
    expect(state).not.toBe(before); // every AI move must be legal
  }
  return state;
}

describe('a full game', () => {
  it.each([1, 2, 4])('runs hands to completion with %i opponents and conserves chips', (opponents) => {
    const random = seededRandom(opponents * 7919);
    let state = newGame(opponents, undefined, random);
    // Let the AI play the human seat too.
    state = autoplay(state, random);
    const total = state.players.reduce((s, p) => s + p.chips, 0) + state.pot;
    expect(total).toBe(100 * (opponents + 1));
    expect(state.handNumber).toBeGreaterThan(1);
  });

  it('deals ten cards each by showdown', () => {
    const random = seededRandom(42);
    let state = newGame(3, undefined, random);
    while (state.phase !== 'showdown' && state.phase !== 'handOver') {
      state = applyAction(state, currentPlayer(state)!.isHuman ? { type: 'call' } : chooseAction(state, random), random);
      if (state.phase === 'discard' && currentPlayer(state)?.isHuman) state = applyAction(state, { type: 'discard', cardIds: [] }, random);
    }
    if (state.phase === 'showdown') {
      for (const p of state.players.filter((p) => !p.folded)) expect(p.hand).toHaveLength(10);
    }
  });
});

describe('showdown', () => {
  it('ends the hand at once when a Great Onion is crippled', () => {
    const random = seededRandom(1);
    let state = newGame(2, undefined, random);
    // Rig a showdown: seat order is Elder, next, Dealer.
    const [first, second, third] = [1, 2, 0].map((k) => (state.dealer + k) % 3);
    const card = (rank: number, suit: Card['suit']): Card => ({ id: `${rank}-${suit}`, rank, suit });
    state = {
      ...state,
      phase: 'showdown',
      queue: [first, second, third],
      turn: first,
      pot: 30,
      players: state.players.map((p) => {
        if (p.id === first) {
          const suits = ['spades', 'clubs', 'hearts', 'diamonds', 'swords'] as const;
          return { ...p, hand: [...suits.map((s) => card(1, s)), ...suits.map((s) => card(13, s))] };
        }
        if (p.id === second) return { ...p, hand: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((r) => card(r, 'cups')) };
        return { ...p, hand: [2, 3, 4, 5, 6, 7, 9, 10, 11, 12].map((r) => card(r, 'coins')) };
      }),
    };
    const chipsBefore = state.players[second].chips;
    state = applyAction(state, chooseAction(state, random), random);
    expect(tableDeclaration(state)?.declaration?.label).toBe('Great Onion');
    state = applyAction(state, chooseAction(state, random), random);
    expect(state.crippled).toBe(true);
    expect(state.phase).toBe('handOver');
    expect(state.winnerIds).toEqual([second]);
    expect(state.players[second].chips).toBe(chipsBefore + 30);
  });
});
