/// <reference lib="webworker" />

import {
  computeCatalogModelSnapshot,
  type CatalogModelComputeInput,
  type CatalogModelSnapshot,
} from '../utils/catalogModelCompute'

type CatalogWorkerRequestMessage = {
  requestId: number
  input: CatalogModelComputeInput
}

type CatalogWorkerResponseMessage = {
  requestId: number
  snapshot: CatalogModelSnapshot
}

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<CatalogWorkerRequestMessage>) => {
  const { requestId, input } = event.data
  const snapshot = computeCatalogModelSnapshot(input)

  const response: CatalogWorkerResponseMessage = {
    requestId,
    snapshot,
  }

  workerScope.postMessage(response)
}

export {}
