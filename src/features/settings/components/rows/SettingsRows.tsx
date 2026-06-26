import type { ReactNode } from 'react'

import styles from '../../Settings.module.css'

type SettingsRowProps = {
  title: string
  description?: string
  control: ReactNode
}

export function SettingsRow({ title, description, control }: SettingsRowProps) {
  return (
    <div className={styles.settingsRow}>
      <div className={styles.settingsRowCopy}>
        <span className={styles.settingsRowTitle}>{title}</span>
        {description ? <span className={styles.settingsRowDescription}>{description}</span> : null}
      </div>
      <div className={styles.settingsRowControl}>{control}</div>
    </div>
  )
}

export function SettingsRowStack({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className={styles.settingsRowStack}>
      <div className={styles.settingsRowCopy}>
        <span className={styles.settingsRowTitle}>{title}</span>
        {description ? <span className={styles.settingsRowDescription}>{description}</span> : null}
      </div>
      <div className={styles.settingsRowControlWide}>{children}</div>
    </div>
  )
}

export function SettingsToggleControl({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      data-controller-focusable=""
      onChange={(event) => onChange(event.target.checked)}
      aria-label={ariaLabel}
    />
  )
}

export function SettingsSliderControl({
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  onChange,
  onSliderSound,
}: {
  value: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange: (value: number) => void
  onSliderSound?: (value: number) => void
}) {
  return (
    <div className={styles.settingsSliderWrap}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-controller-focusable=""
        aria-valuetext={`${value}%`}
        onInput={(event) => {
          const next = Number(event.currentTarget.value)
          if (Number.isFinite(next)) {
            onSliderSound?.(next)
          }
        }}
                onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) {
            onChange(next)
          }
        }}
      />
      <span className={styles.settingsSliderValue}>{value}%</span>
    </div>
  )
}

export function SettingsSelectControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      className={styles.settingsSelect}
      data-controller-focusable=""
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function SettingsChipRow({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className={styles.settingsChipRow}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-controller-focusable=""
          className={value === option.value ? `${styles.settingsChip} ${styles.isSelected}` : styles.settingsChip}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
