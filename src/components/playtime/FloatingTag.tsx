import React, { memo } from 'react'

type FloatingTagProps = {
  label: string
  value: string
  depth?: number
  className?: string
}

type FloatingTagStyle = React.CSSProperties & {
  '--tag-depth': string
}

const FloatingTagBase: React.FC<FloatingTagProps> = ({ label, value, depth = 1, className }) => {
  const classes = ['playtime-floating-tag']

  if (className) {
    classes.push(className)
  }

  const style: FloatingTagStyle = {
    '--tag-depth': depth.toString(),
  }

  return (
    <span className={classes.join(' ')} style={style}>
      <span className="playtime-floating-tag-label">{label}</span>
      <span className="playtime-floating-tag-value">{value}</span>
    </span>
  )
}

export const FloatingTag = memo(FloatingTagBase)
FloatingTag.displayName = 'FloatingTag'
