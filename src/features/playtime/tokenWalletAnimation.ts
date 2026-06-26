export const TOKEN_WALLET_DEPOSIT_EVENT = 'tile-manager:token-wallet-deposit'

export type TokenWalletDepositDetail = {
  tokenCount: number
  originRect: DOMRectReadOnly
}

export function emitTokenWalletDeposit(detail: TokenWalletDepositDetail): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<TokenWalletDepositDetail>(TOKEN_WALLET_DEPOSIT_EVENT, { detail }))
}

export function subscribeToTokenWalletDeposit(listener: (detail: TokenWalletDepositDetail) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<TokenWalletDepositDetail>
    if (!customEvent.detail) {
      return
    }

    listener(customEvent.detail)
  }

  window.addEventListener(TOKEN_WALLET_DEPOSIT_EVENT, handler as EventListener)
  return () => {
    window.removeEventListener(TOKEN_WALLET_DEPOSIT_EVENT, handler as EventListener)
  }
}