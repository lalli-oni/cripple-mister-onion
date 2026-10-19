import { useEffect, useMemo, useRef, useState } from 'react';
import { EIGHT, type Card } from '../engine/cards';
import { beats, bestDeclaration, classifyGroup } from '../engine/groups';
import {
  DEFAULT_SETTINGS,
  applyAction,
  callAmount,
  canRaise,
  currentPlayer,
  newGame,
  ruleOptions,
  tableDeclaration,
  type GameState,
  type Player,
} from '../engine/game';
import { chooseAction } from '../engine/ai';
import { CardView } from './CardView';
import { RulesPanel } from './RulesPanel';

const AI_DELAY_MS = 750;

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span aria-hidden>🧅</span> Cripple Mr Onion
        </h1>
        <div className="topbar-actions">
          <button type="button" className="ghost" onClick={() => setShowRules((v) => !v)}>
            {showRules ? 'Hide rules' : 'Rules'}
          </button>
          {game && (
            <button type="button" className="ghost" onClick={() => setGame(null)}>
              New game
            </button>
          )}
        </div>
      </header>
      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
      {game ? <Table game={game} setGame={setGame} /> : <Setup onStart={setGame} />}
    </div>
  );
}

function Setup({ onStart }: { onStart: (g: GameState) => void }) {
  const [opponents, setOpponents] = useState(3);
  const [nullEights, setNullEights] = useState(true);
  return (
    <main className="setup">
      <p className="lede">
        The card game from Terry Pratchett's Discworld, as reconstructed by Andrew Millard and Terence Tao. Build groups
        that add up to 21, bet on them, and watch out for anyone holding a running flush.
      </p>
      <label className="field">
        <span>Opponents</span>
        <select value={opponents} onChange={(e) => setOpponents(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="field check">
        <input type="checkbox" checked={nullEights} onChange={(e) => setNullEights(e.target.checked)} />
        <span>Null Eights (an eight may count as 0; doing so makes eights wild next hand)</span>
      </label>
      <button type="button" className="primary" onClick={() => onStart(newGame(opponents, { ...DEFAULT_SETTINGS, nullEights }))}>
        Deal me in
      </button>
    </main>
  );
}

function sortCards(cards: Card[], bySuit: boolean): Card[] {
  return cards.slice().sort((a, b) => {
    if (bySuit) {
      const pa = pairIndex(a), pb = pairIndex(b);
      if (pa !== pb) return pa - pb;
    }
    return rankOrder(a) - rankOrder(b) || a.suit.localeCompare(b.suit);
  });
}
const pairIndex = (c: Card) => ['spades', 'swords', 'clubs', 'staves', 'hearts', 'cups', 'diamonds', 'coins'].indexOf(c.suit) >> 1;
const rankOrder = (c: Card) => (c.rank === 1 ? 14 : c.rank);

function Table({ game, setGame }: { game: GameState; setGame: (g: GameState) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [bySuit, setBySuit] = useState(true);
  const actor = currentPlayer(game);
  const you = game.players[0];
  const opts = ruleOptions(game);
  const onTable = tableDeclaration(game);
  const myTurn = actor?.isHuman ?? false;

  // Computer players take their turns on a short delay so you can follow along.
  useEffect(() => {
    if (!actor || actor.isHuman) return;
    const t = setTimeout(() => setGame(applyAction(game, chooseAction(game))), AI_DELAY_MS);
    return () => clearTimeout(t);
  }, [game, actor, setGame]);

  // Clear selection whenever the phase or turn changes.
  useEffect(() => setSelected([]), [game.phase, game.turn, game.handNumber]);

  const selectedCards = you.hand.filter((c) => selected.includes(c.id));
  const selectedDecl = useMemo(() => classifyGroup(selectedCards, opts), [selectedCards, opts]);
  const myBest = useMemo(() => bestDeclaration(you.hand, opts), [you.hand, opts]);
  const myBestResponse = useMemo(
    () => (game.phase === 'showdown' ? bestDeclaration(you.hand, opts, onTable?.declaration ?? null) : null),
    [game.phase, you.hand, opts, onTable],
  );

  const toggle = (id: string) => {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (game.phase === 'discard' && s.length >= 4) return s;
      return [...s, id];
    });
  };
  const act = (a: Parameters<typeof applyAction>[1]) => setGame(applyAction(game, a));

  const canSelect = myTurn && (game.phase === 'discard' || game.phase === 'showdown');
  const handOver = game.phase === 'handOver' || game.phase === 'gameOver';
  const opponents = game.players.slice(1);

  return (
    <main className="table">
      <section className="opponents" aria-label="Opponents">
        {opponents.map((p) => (
          <Seat key={p.id} game={game} player={p} active={actor?.id === p.id} reveal={handOver && !p.folded} />
        ))}
      </section>

      <section className="centre" aria-live="polite">
        <div className="pot">
          <span className="pot-label">Pot</span>
          <span className="pot-value">{game.pot}</span>
        </div>
        <div className="phase">
          <PhaseLine game={game} />
          {game.eightsWild && <span className="badge warn">Eights are wild</span>}
        </div>
        {onTable && game.phase === 'showdown' && (
          <div className="on-table">
            <span className="muted">On the table:</span> <strong>{game.players[onTable.playerId].name}</strong>'s{' '}
            {onTable.declaration!.label}
            <div className="mini-cards">
              {onTable.declaration!.cards.map((c) => (
                <CardView key={c.id} card={c} small wild={opts.eightsWild && c.rank === EIGHT} />
              ))}
            </div>
          </div>
        )}
        {handOver && <HandSummary game={game} />}
      </section>

      <section className={`you ${myTurn ? 'active' : ''}`} aria-label="Your hand">
        <div className="you-head">
          <h2>
            You {game.dealer === 0 && <span className="badge">Dealer</span>}
            {you.folded && <span className="badge muted">Folded</span>}
          </h2>
          <span className="chips">{you.chips} chips</span>
          <button type="button" className="ghost small" onClick={() => setBySuit((v) => !v)}>
            Sort by {bySuit ? 'rank' : 'suit'}
          </button>
        </div>
        <div className="hand">
          {sortCards(you.hand, bySuit).map((c) => (
            <CardView
              key={c.id}
              card={c}
              selected={selected.includes(c.id)}
              wild={opts.eightsWild && c.rank === EIGHT}
              dim={you.folded}
              onClick={canSelect ? () => toggle(c.id) : undefined}
            />
          ))}
        </div>
        {!handOver && myBest && !you.folded && (
          <p className="hint">
            Best grouping in your hand: <strong>{myBest.label}</strong>
          </p>
        )}

        <div className="actions">
          {game.phase === 'gameOver' ? (
            <GameOver game={game} />
          ) : game.phase === 'handOver' ? (
            <button type="button" className="primary" onClick={() => act({ type: 'nextHand' })}>
              Next hand
            </button>
          ) : !myTurn ? (
            <span className="muted">Waiting for {actor?.name}…</span>
          ) : game.phase === 'discard' ? (
            <>
              <span className="prompt">Pick up to 4 cards to swap.</span>
              <button type="button" className="primary" onClick={() => act({ type: 'discard', cardIds: selected })}>
                {selected.length ? `Swap ${selected.length}` : 'Keep all'}
              </button>
            </>
          ) : game.phase === 'bet1' || game.phase === 'bet2' ? (
            <BetControls game={game} you={you} act={act} />
          ) : (
            <>
              <span className="prompt">
                {selectedCards.length === 0
                  ? onTable
                    ? 'Pick cards that beat the table, or throw in.'
                    : 'You show first. Pick a grouping.'
                  : selectedDecl
                    ? beats(selectedDecl, onTable?.declaration ?? null)
                      ? `${selectedDecl.label}: that will do.`
                      : selectedDecl.crippler
                        ? `${selectedDecl.label}: only good for crippling a Great (or, with ten cards, Lesser) Onion.`
                        : `${selectedDecl.label} doesn't beat the table.`
                    : 'Those cards don’t make a grouping.'}
              </span>
              <button
                type="button"
                className="ghost"
                disabled={!myBestResponse}
                onClick={() => myBestResponse && setSelected(myBestResponse.cards.map((c) => c.id))}
              >
                Pick my best
              </button>
              <button
                type="button"
                className="primary"
                disabled={!selectedDecl || !beats(selectedDecl, onTable?.declaration ?? null)}
                onClick={() => act({ type: 'declare', cardIds: selected })}
              >
                Show
              </button>
              <button type="button" className="danger" onClick={() => act({ type: 'throwIn' })}>
                Throw in
              </button>
            </>
          )}
        </div>
      </section>

      <Log lines={game.log} />
    </main>
  );
}

function BetControls({ game, you, act }: { game: GameState; you: Player; act: (a: Parameters<typeof applyAction>[1]) => void }) {
  const cost = callAmount(game, you);
  return (
    <>
      <span className="prompt">{game.phase === 'bet1' ? 'First betting round.' : 'Second betting round.'}</span>
      <button type="button" className="primary" onClick={() => act({ type: 'call' })}>
        {cost ? `Call ${cost}` : 'Check'}
      </button>
      <button type="button" className="ghost" disabled={!canRaise(game, you)} onClick={() => act({ type: 'raise' })}>
        Raise to {game.currentBet + game.settings.stake}
      </button>
      <button type="button" className="danger" onClick={() => act({ type: 'fold' })}>
        Fold
      </button>
    </>
  );
}

function Seat({ game, player, active, reveal }: { game: GameState; player: Player; active: boolean; reveal: boolean }) {
  const opts = ruleOptions(game);
  const shown = game.showdown.find((s) => s.playerId === player.id);
  return (
    <div className={`seat ${active ? 'active' : ''} ${player.folded || player.out ? 'folded' : ''}`}>
      <div className="seat-head">
        <strong>{player.name}</strong>
        {game.dealer === player.id && <span className="badge">Dealer</span>}
        {player.out && <span className="badge muted">Out</span>}
        {player.folded && <span className="badge muted">Folded</span>}
        {game.winnerIds.includes(player.id) && <span className="badge win">Winner</span>}
      </div>
      <div className="chips">{player.chips} chips</div>
      <div className="mini-cards">
        {player.hand.map((c) => (
          <CardView key={c.id} card={c} small faceDown={!reveal && !player.faceUp.includes(c.id)} wild={opts.eightsWild && c.rank === EIGHT} />
        ))}
      </div>
      {shown && <div className="seat-shown">{shown.declaration ? shown.declaration.label : 'Threw in'}</div>}
    </div>
  );
}

function PhaseLine({ game }: { game: GameState }) {
  const text: Record<GameState['phase'], string> = {
    discard: 'Discards',
    bet1: 'First betting round',
    bet2: 'Second betting round',
    showdown: 'Showdown',
    handOver: 'Hand over',
    gameOver: 'Game over',
  };
  return (
    <span className="phase-name">
      Hand {game.handNumber} · {text[game.phase]}
    </span>
  );
}

function HandSummary({ game }: { game: GameState }) {
  const winners = game.winnerIds.map((id) => game.players[id].name);
  const top = tableDeclaration(game);
  return (
    <div className="summary">
      {game.crippled && <div className="crippled">CRIPPLED!</div>}
      {winners.length ? (
        <p>
          <strong>{winners.join(' & ')}</strong> {winners[0] === 'You' ? 'win' : 'wins'} the hand
          {top?.declaration ? ` with a ${top.declaration.label}` : ''}.
        </p>
      ) : (
        <p>Nobody could show a grouping. The pot carries over.</p>
      )}
    </div>
  );
}

function GameOver({ game }: { game: GameState }) {
  const you = game.players[0];
  return <span className="prompt">{you.chips > 0 ? 'Everyone else is skint. You win the game!' : 'You are out of chips. Better luck next time.'}</span>;
}

function Log({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);
  return (
    <section className="log" aria-label="Game log">
      <h2>Log</h2>
      <ol ref={ref}>
        {lines.map((l, i) => (
          <li key={i} className={l.startsWith('—') ? 'hand-start' : ''}>
            {l}
          </li>
        ))}
      </ol>
    </section>
  );
}
