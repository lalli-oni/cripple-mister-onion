/**
 * The round-by-round game as a pure state machine: `applyAction` takes a
 * state and returns the next one. The UI and the AI both drive it the same
 * way, so the rules live in exactly one place.
 *
 * A round:
 *   1. Everyone antes the Stake.
 *   2. First deal: five cards each, face down.
 *   3. Discard: Elder to Younger, then the Dealer, may swap up to four.
 *   4. First betting round.
 *   5. Second deal: five more each, face up (the Dealer's face down).
 *   6. Second betting round.
 *   7. Showdown: from the Elder, each player must display a grouping that
 *      beats the one on the table, or throw in. A crippling play ends the
 *      round at once.
 */
import { makeDeck, shuffle, type Card } from './cards';
import { beats, classifyGroup, type Declaration, type RuleOptions } from './groups';

export interface Settings {
  stake: number;
  startingChips: number;
  /** Optional modifier: eights may count as zero; doing so makes eights wild next hand. */
  nullEights: boolean;
  /** Raises allowed per betting round, to keep hands moving. */
  maxRaises: number;
}

export const DEFAULT_SETTINGS: Settings = {
  stake: 2,
  startingChips: 100,
  nullEights: true,
  maxRaises: 3,
};

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  chips: number;
  hand: Card[];
  /** Ids of cards the other players can see. */
  faceUp: string[];
  folded: boolean;
  /** Chips put in during the current betting round. */
  roundBet: number;
  /** Total chips put in this hand. */
  committed: number;
  /** Out of the game (no chips left at the start of a hand). */
  out: boolean;
}

export type Phase = 'discard' | 'bet1' | 'bet2' | 'showdown' | 'handOver' | 'gameOver';

export interface ShowdownEntry {
  playerId: number;
  declaration: Declaration | null; // null = threw in
}

export interface GameState {
  settings: Settings;
  players: Player[];
  deck: Card[];
  discards: Card[];
  dealer: number;
  phase: Phase;
  /** Index into `players` of whose turn it is. */
  turn: number;
  pot: number;
  currentBet: number;
  raisesThisRound: number;
  /** Players still to act in this betting round. */
  toAct: number[];
  /** Players still to discard / declare, in order. */
  queue: number[];
  eightsWild: boolean;
  /** Set when someone counts an eight as zero; eights are wild next hand. */
  nullEightUsed: boolean;
  showdown: ShowdownEntry[];
  winnerIds: number[];
  crippled: boolean;
  handNumber: number;
  log: string[];
}

export type Action =
  | { type: 'discard'; cardIds: string[] }
  | { type: 'fold' }
  | { type: 'call' }
  | { type: 'raise' }
  | { type: 'declare'; cardIds: string[] }
  | { type: 'throwIn' }
  | { type: 'nextHand' };

export function ruleOptions(state: GameState): RuleOptions {
  return { eightsWild: state.eightsWild, nullEights: state.settings.nullEights && !state.eightsWild };
}

const AI_NAMES = ['Rincewind', 'Granny Weatherwax', 'Nobby Nobbs', 'Cohen the Barbarian', 'Mustrum Ridcully'];

export function newGame(opponents: number, settings: Settings = DEFAULT_SETTINGS, random: () => number = Math.random): GameState {
  const players: Player[] = [
    blankPlayer(0, 'You', true, settings.startingChips),
    ...AI_NAMES.slice(0, opponents).map((name, i) => blankPlayer(i + 1, name, false, settings.startingChips)),
  ];
  const state: GameState = {
    settings,
    players,
    deck: [],
    discards: [],
    dealer: Math.floor(random() * players.length),
    phase: 'handOver',
    turn: 0,
    pot: 0,
    currentBet: 0,
    raisesThisRound: 0,
    toAct: [],
    queue: [],
    eightsWild: false,
    nullEightUsed: false,
    showdown: [],
    winnerIds: [],
    crippled: false,
    handNumber: 0,
    log: [],
  };
  return startHand(state, random, false);
}

function blankPlayer(id: number, name: string, isHuman: boolean, chips: number): Player {
  return { id, name, isHuman, chips, hand: [], faceUp: [], folded: false, roundBet: 0, committed: 0, out: false };
}

/** Seats in play order starting with the Elder (left of the Dealer) and ending with the Dealer. */
export function seatOrder(state: GameState, ids: number[] = activeIds(state)): number[] {
  const n = state.players.length;
  const order: number[] = [];
  for (let k = 1; k <= n; k++) {
    const idx = (state.dealer + k) % n;
    if (ids.includes(idx)) order.push(idx);
  }
  return order;
}

function activeIds(state: GameState): number[] {
  return state.players.filter((p) => !p.out && !p.folded).map((p) => p.id);
}

function clone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: p.hand.slice(), faceUp: p.faceUp.slice() })),
    deck: state.deck.slice(),
    discards: state.discards.slice(),
    toAct: state.toAct.slice(),
    queue: state.queue.slice(),
    showdown: state.showdown.slice(),
    winnerIds: state.winnerIds.slice(),
    log: state.log.slice(),
  };
}

/** "Rincewind calls" but "You call". */
function does(p: Player, verb: string): string {
  // Drop the third-person "s" from the first word for the human player.
  return `${p.name} ${p.isHuman ? verb.replace(/[sS](?=\s|$)/, '') : verb}`;
}

function say(state: GameState, line: string) {
  state.log.push(line);
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

function draw(state: GameState): Card {
  if (state.deck.length === 0) {
    // Reshuffle the discard pot if the pack runs dry (only possible with many players).
    state.deck = shuffle(state.discards);
    state.discards = [];
  }
  return state.deck.pop()!;
}

function startHand(prev: GameState, random: () => number = Math.random, rotate = true): GameState {
  const state = clone(prev);
  const carry = state.winnerIds.length === 0 ? state.pot : 0;
  for (const p of state.players) {
    p.hand = [];
    p.faceUp = [];
    p.folded = false;
    p.roundBet = 0;
    p.committed = 0;
    if (p.chips <= 0) p.out = true;
  }
  const alive = state.players.filter((p) => !p.out);
  if (alive.length < 2 || state.players[0].out) {
    state.phase = 'gameOver';
    return state;
  }
  if (rotate) {
    do state.dealer = (state.dealer + 1) % state.players.length;
    while (state.players[state.dealer].out);
  }
  state.handNumber++;
  state.eightsWild = state.nullEightUsed;
  state.nullEightUsed = false;
  state.deck = shuffle(makeDeck(), random);
  state.discards = [];
  state.pot = carry;
  state.showdown = [];
  state.winnerIds = [];
  state.crippled = false;
  state.currentBet = 0;
  state.raisesThisRound = 0;

  say(state, `— Hand ${state.handNumber}. ${state.players[state.dealer].name} deals.${state.eightsWild ? ' Eights are wild!' : ''}${carry ? ` ${carry} chips carried over.` : ''}`);

  for (const p of alive) {
    const ante = Math.min(state.settings.stake, p.chips);
    p.chips -= ante;
    p.committed += ante;
    state.pot += ante;
  }

  const order = seatOrder(state);
  // First deal: five each, face down.
  for (let i = 0; i < 5; i++) for (const id of order) state.players[id].hand.push(draw(state));

  state.phase = 'discard';
  state.queue = order;
  state.turn = order[0];
  return state;
}

/** Whose move it is, or null when the hand is over. */
export function currentPlayer(state: GameState): Player | null {
  if (state.phase === 'handOver' || state.phase === 'gameOver') return null;
  return state.players[state.turn];
}

export function callAmount(state: GameState, player: Player): number {
  return Math.min(state.currentBet - player.roundBet, player.chips);
}

export function canRaise(state: GameState, player: Player): boolean {
  return state.raisesThisRound < state.settings.maxRaises && player.chips > state.currentBet - player.roundBet;
}

/** The grouping currently on the table at showdown. */
export function tableDeclaration(state: GameState): ShowdownEntry | null {
  for (let i = state.showdown.length - 1; i >= 0; i--) {
    if (state.showdown[i].declaration) return state.showdown[i];
  }
  return null;
}

export function applyAction(prev: GameState, action: Action, random: () => number = Math.random): GameState {
  if (action.type === 'nextHand') {
    if (prev.phase !== 'handOver') return prev;
    return startHand(prev, random);
  }
  const player = currentPlayer(prev);
  if (!player) return prev;
  const state = clone(prev);
  const me = state.players[player.id];

  switch (state.phase) {
    case 'discard': {
      if (action.type !== 'discard') return prev;
      const ids = action.cardIds.slice(0, 4).filter((id) => me.hand.some((c) => c.id === id));
      for (const id of ids) {
        const i = me.hand.findIndex((c) => c.id === id);
        state.discards.push(...me.hand.splice(i, 1));
      }
      for (let i = 0; i < ids.length; i++) me.hand.push(draw(state));
      say(state, `${ids.length ? `${does(me, 'swaps')} ${ids.length}` : does(me, 'stands pat')}.`);
      state.queue.shift();
      if (state.queue.length) state.turn = state.queue[0];
      else beginBetting(state, 'bet1');
      return state;
    }
    case 'bet1':
    case 'bet2': {
      if (action.type === 'fold') {
        me.folded = true;
        say(state, `${does(me, 'folds')}.`);
      } else if (action.type === 'call') {
        const amt = callAmount(state, me);
        put(state, me, amt);
        say(state, amt ? `${does(me, 'calls')} ${amt}.` : `${does(me, 'checks')}.`);
      } else if (action.type === 'raise') {
        if (!canRaise(state, me)) return prev;
        const target = state.currentBet + state.settings.stake;
        const amt = Math.min(target - me.roundBet, me.chips);
        put(state, me, amt);
        state.currentBet = Math.max(state.currentBet, me.roundBet);
        state.raisesThisRound++;
        say(state, `${does(me, 'raises')} to ${state.currentBet}.`);
        // Everyone else still in must answer the raise.
        state.toAct = seatOrder(state).filter((id) => id !== me.id);
        rotateFrom(state, me.id);
      } else return prev;
      if (action.type !== 'raise') state.toAct = state.toAct.filter((id) => id !== me.id);
      advanceBetting(state);
      return state;
    }
    case 'showdown': {
      const onTable = tableDeclaration(state);
      if (action.type === 'throwIn') {
        state.showdown.push({ playerId: me.id, declaration: null });
        say(state, `${does(me, 'throws')} in.`);
      } else if (action.type === 'declare') {
        const cards = action.cardIds.map((id) => me.hand.find((c) => c.id === id)).filter((c): c is Card => !!c);
        const decl = classifyGroup(cards, ruleOptions(state));
        if (!decl || !beats(decl, onTable?.declaration ?? null)) return prev;
        state.showdown.push({ playerId: me.id, declaration: decl });
        for (const c of cards) if (!me.faceUp.includes(c.id)) me.faceUp.push(c.id);
        if (decl.nullEights > 0) state.nullEightUsed = true;
        if (decl.crippler) {
          const victim = state.players[onTable!.playerId];
          say(state, `${does(me, 'CRIPPLES')} ${victim.name}'s ${onTable!.declaration!.label} with a ${decl.label}!`);
          state.crippled = true;
          finishHand(state, [me.id]);
          return state;
        }
        say(state, `${does(me, 'shows')} a ${decl.label}${decl.nullEights ? ` (${decl.nullEights} null eight${decl.nullEights > 1 ? 's' : ''})` : ''}.`);
      } else return prev;
      state.queue.shift();
      if (state.queue.length) state.turn = state.queue[0];
      else {
        const top = tableDeclaration(state);
        finishHand(state, top ? [top.playerId] : []);
      }
      return state;
    }
  }
  return prev;
}

function put(state: GameState, p: Player, amt: number) {
  p.chips -= amt;
  p.roundBet += amt;
  p.committed += amt;
  state.pot += amt;
}

function rotateFrom(state: GameState, fromId: number) {
  // Keep `toAct` in seat order starting after `fromId`.
  const n = state.players.length;
  state.toAct.sort((a, b) => ((a - fromId + n) % n) - ((b - fromId + n) % n));
}

function beginBetting(state: GameState, phase: 'bet1' | 'bet2') {
  state.phase = phase;
  state.currentBet = 0;
  state.raisesThisRound = 0;
  for (const p of state.players) p.roundBet = 0;
  // Players with no chips left are all-in and skip betting.
  state.toAct = seatOrder(state).filter((id) => state.players[id].chips > 0);
  say(state, phase === 'bet1' ? 'First round of betting.' : 'Second round of betting.');
  advanceBetting(state);
}

function advanceBetting(state: GameState) {
  const live = seatOrder(state);
  if (live.length === 1) {
    say(state, `Everyone else folded.`);
    finishHand(state, live);
    return;
  }
  // Drop anyone who is all-in.
  state.toAct = state.toAct.filter((id) => state.players[id].chips > 0 && !state.players[id].folded);
  if (state.toAct.length) {
    state.turn = state.toAct[0];
    return;
  }
  if (state.phase === 'bet1') {
    secondDeal(state);
    beginBetting(state, 'bet2');
  } else {
    beginShowdown(state);
  }
}

function secondDeal(state: GameState) {
  const order = seatOrder(state);
  for (let i = 0; i < 5; i++) {
    for (const id of order) {
      const p = state.players[id];
      const card = draw(state);
      p.hand.push(card);
      if (id !== state.dealer) p.faceUp.push(card.id);
    }
  }
  say(state, 'Second deal: five more each, face up (the Dealer\'s face down).');
}

function beginShowdown(state: GameState) {
  state.phase = 'showdown';
  state.queue = seatOrder(state);
  state.turn = state.queue[0];
  say(state, 'Showdown! Each player must beat the grouping on the table or throw in.');
}

function finishHand(state: GameState, winners: number[]) {
  state.phase = 'handOver';
  state.winnerIds = winners;
  state.queue = [];
  state.toAct = [];
  if (winners.length) {
    const share = Math.floor(state.pot / winners.length);
    for (const id of winners) state.players[id].chips += share;
    const names = winners.map((id) => state.players[id].name).join(' & ');
    say(state, `${names} ${names === 'You' ? 'win' : 'wins'} ${state.pot} chips.`);
    state.pot = 0;
  } else {
    say(state, 'Nobody could show a grouping. The pot carries over.');
  }
  if (state.nullEightUsed) say(state, 'A null eight was played: eights are wild next hand.');
  const alive = state.players.filter((p) => p.chips > 0);
  if (alive.length < 2 || state.players[0].chips <= 0) state.phase = 'gameOver';
}
