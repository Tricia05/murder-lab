/**
 * One item card, rendered as a mini playing card:
 * picture (emoji) on top, name underneath, category color as the frame.
 */
export default function CardChip({ card, selected, tag, onClick, disabled }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      className={`card-chip card-${card.category} ${selected ? 'card-selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={`${card.name} (${card.category})`}
    >
      {tag && <span className="card-tag">{tag}</span>}
      <span className="card-icon">{card.icon}</span>
      <span className="card-name">{card.name}</span>
    </Tag>
  );
}
