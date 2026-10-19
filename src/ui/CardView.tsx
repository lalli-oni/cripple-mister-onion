import { rankLabel, suitOf, type Card, type SuitId } from '../engine/cards';

/** Simple glyphs for the Spanish suits; the French ones use their usual characters. */
function SuitGlyph({ suit }: { suit: SuitId }) {
  switch (suit) {
    case 'spades':
      return <span aria-hidden>♠</span>;
    case 'clubs':
      return <span aria-hidden>♣</span>;
    case 'hearts':
      return <span aria-hidden>♥</span>;
    case 'diamonds':
      return <span aria-hidden>♦</span>;
    case 'swords':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="glyph">
          <path d="M12 2l2 3v11h-4V5z M7 16h10v2H7z M11 18h2v4h-2z" fill="currentColor" />
        </svg>
      );
    case 'staves':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="glyph">
          <path d="M11 2h2v20h-2z M8 5c2 0 3 1 3 3H9C9 7 8.5 6.5 8 6.5z M16 9c-2 0-3 1-3 3h2c0-1 .5-1.5 1-1.5z" fill="currentColor" />
        </svg>
      );
    case 'cups':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="glyph">
          <path d="M5 3h14c0 6-3 9-6 9.5V18h4v3H7v-3h4v-5.5C8 12 5 9 5 3z" fill="currentColor" />
        </svg>
      );
    case 'coins':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="glyph">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        </svg>
      );
  }
}

interface Props {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  dim?: boolean;
  wild?: boolean;
  small?: boolean;
  onClick?: () => void;
}

export function CardView({ card, faceDown, selected, dim, wild, small, onClick }: Props) {
  const classes = ['card', small && 'small', wild && 'wild', selected && 'selected', dim && 'dim', onClick && 'clickable'].filter(Boolean).join(' ');
  if (!card || faceDown) {
    return <div className={`${classes} back`} aria-label="Face-down card" />;
  }
  const suit = suitOf(card);
  const label = `${rankLabel(card.rank)} of ${suit.name}${wild ? ' (wild)' : ''}`;
  const content = (
    <>
      <span className="rank">{rankLabel(card.rank)}</span>
      <span className="suit">
        <SuitGlyph suit={card.suit} />
      </span>
      {wild && <span className="wild-tag">wild</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`${classes} pair-${suit.pair}`} aria-pressed={selected} aria-label={label} title={label} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <div className={`${classes} pair-${suit.pair}`} aria-label={label} title={label}>
      {content}
    </div>
  );
}
