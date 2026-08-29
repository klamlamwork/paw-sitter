function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M10 1.8 12.5 7l5.5.8-4 3.9.9 5.5L10 14.8 5.1 17.2l.9-5.5-4-3.9L7.5 7 10 1.8z" />
    </svg>
  );
}

export default function SitterRatingBadge({ avg, className = "" }) {
  const value = Number(avg);
  if (!Number.isFinite(value) || value <= 0) return null;
  return (
    <span className={"inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#c45c26] " + className}>
      <StarIcon />
      {value.toFixed(1)}
    </span>
  );
}
