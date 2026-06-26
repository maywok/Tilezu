export type SignatureRungoReactionType = 'launch-game' | 'claim-token' | 'new-unlock' | 'return-launcher'

export type SignatureRungoReactionDetail = {
  type: SignatureRungoReactionType
  at: number
  source?: string
}

const SIGNATURE_RUNGO_REACTION_EVENT = 'tm-signature-rungo-reaction'

function isSignatureRungoReactionType(value: unknown): value is SignatureRungoReactionType {
  return value === 'launch-game'
    || value === 'claim-token'
    || value === 'new-unlock'
    || value === 'return-launcher'
}

export function emitSignatureRungoReaction(type: SignatureRungoReactionType, source?: string) {
  if (typeof window === 'undefined') {
    return
  }

  const detail: SignatureRungoReactionDetail = {
    type,
    at: Date.now(),
    source,
  }

  window.dispatchEvent(new CustomEvent<SignatureRungoReactionDetail>(SIGNATURE_RUNGO_REACTION_EVENT, { detail }))
}

export function subscribeToSignatureRungoReaction(
  callback: (detail: SignatureRungoReactionDetail) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {
      // no-op in non-browser environments
    }
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<SignatureRungoReactionDetail | undefined>
    const detail = customEvent.detail
    if (!detail || !isSignatureRungoReactionType(detail.type)) {
      return
    }

    callback({
      type: detail.type,
      at: Number.isFinite(detail.at) ? detail.at : Date.now(),
      source: typeof detail.source === 'string' ? detail.source : undefined,
    })
  }

  window.addEventListener(SIGNATURE_RUNGO_REACTION_EVENT, handleEvent as EventListener)
  return () => {
    window.removeEventListener(SIGNATURE_RUNGO_REACTION_EVENT, handleEvent as EventListener)
  }
}
