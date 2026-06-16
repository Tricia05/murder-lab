/**
 * One card, rendered as a mini playing card: picture (emoji) on top, name
 * underneath. The deck drives the color — blue for MEANS (weapon/method),
 * red for CLUE (evidence) — matching Deception's two card decks.
 */
export default function CardChip({ card, selected, tag, onClick, disabled }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      className={`card-chip card-${card.deck} ${selected ? 'card-selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={`${card.name} (${card.deck === 'means' ? 'Means' : 'Clue'})`}
    >
      {tag && <span className="card-tag">{tag}</span>}
      <span className="card-icon">{card.icon}</span>
      <span className="card-name">{card.name}</span>
    </Tag>
  );
}
