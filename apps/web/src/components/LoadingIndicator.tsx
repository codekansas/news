type LoadingIndicatorProps = {
  compact?: boolean;
  inline?: boolean;
  label?: string;
  showLabel?: boolean;
};

export const LoadingIndicator = ({
  compact = false,
  inline = false,
  label = 'Loading...',
  showLabel = true,
}: LoadingIndicatorProps) => {
  const Element = inline ? 'span' : 'div';

  return (
    <Element
      aria-busy="true"
      aria-live="polite"
      className={[
        'loading-indicator',
        inline ? 'loading-indicator-inline' : 'loading-indicator-block',
        compact ? 'loading-indicator-compact' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true" className="loading-spinner" />
      {showLabel ? <span>{label}</span> : null}
    </Element>
  );
};
