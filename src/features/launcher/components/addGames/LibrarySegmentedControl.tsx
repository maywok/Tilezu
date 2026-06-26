import type { CSSProperties, ReactNode } from 'react'

export type LibrarySegmentOption<T extends string> = {
  value: T
  label: ReactNode
}

type LibrarySegmentedControlProps<T extends string> = {
  options: Array<LibrarySegmentOption<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function LibrarySegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: LibrarySegmentedControlProps<T>) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value))

  const style = {
    '--segment-count': options.length,
    '--segment-index': activeIndex,
  } as CSSProperties

  return (
    <div
      className={['tm-library-segmented', className].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={ariaLabel}
      style={style}
    >
      <span className="tm-library-segmented-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? 'tm-library-segmented-btn is-active' : 'tm-library-segmented-btn'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
