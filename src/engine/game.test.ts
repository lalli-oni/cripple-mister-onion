import { seededRandom } from './cards';
import { chooseAction } from './ai';
import { applyAction, currentPlayer, newGame, type GameState } from './game';

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
