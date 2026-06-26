import React, { memo } from 'react'

type GlassCardProps = {
  className?: string
  interactive?: boolean
  children: React.ReactNode
}

const GlassCardBase: React.FC<GlassCardProps> = ({ className, interactive = false, children }) => {
  const classes = ['playtime-glass-card']

  if (interactive) {
    classes.push('is-interactive')
  }

  if (className) {
    classes.push(className)
  }

  return (
    <article className={classes.join(' ')}>
      <span className="playtime-glass-sheen" aria-hidden="true" />
      <div className="playtime-glass-card-content">{children}</div>
    </article>
  )
}

export const GlassCard = memo(GlassCardBase)
GlassCard.displayName = 'GlassCard'
