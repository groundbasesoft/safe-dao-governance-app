import { useEffect } from 'react'

import { ExternalStore } from '@/services/ExternalStore'
import { useWallet } from '@/hooks/useWallet'
import { didRevert } from '@/utils/transactions'
import { useWeb3 } from '@/hooks/useWeb3'
import { DEFAULT_CHAIN_ID } from '@/config/constants'

// Note: only EOA transactions can be pending

type TransactionHash = string
const delegateTxsStore = new ExternalStore<{
  [chainId: string]: { [providerAddress: string]: TransactionHash | undefined }
}>({
  [DEFAULT_CHAIN_ID]: {},
})

export const setPendingDelegation = (providerAddress: string, txHash: TransactionHash) => {
  delegateTxsStore.setStore((delegations) => ({
    [DEFAULT_CHAIN_ID]: {
      ...delegations?.[DEFAULT_CHAIN_ID],
      [providerAddress]: txHash,
    },
  }))
}

const removePendingDelegation = (providerAddress: string) => {
  delegateTxsStore.setStore((prev = {}) => {
    prev[DEFAULT_CHAIN_ID][providerAddress] = undefined
    return prev
  })
}

export const usePendingDelegations = () => {
  const web3 = useWeb3()
  const delegations = delegateTxsStore.useStore()
  const wallet = useWallet()

  useEffect(() => {
    if (!wallet?.chainId || !wallet?.address || !web3) {
      return
    }

    const txHash = delegations?.[wallet.chainId]?.[wallet.address]

    if (!txHash) {
      return
    }

    const TIMEOUT_MINUTES = 6.5

    // Return receipt after 1 additional block was mined/validated or until timeout
    // https://docs.ethers.io/v5/single-page/#/v5/api/providers/provider/-%23-Provider-waitForTransaction
    web3
      .waitForTransaction(txHash, 1, TIMEOUT_MINUTES * 60_000)
      .then((receipt) => {
        if (didRevert(receipt)) {
          console.error('Delegation reverted', receipt)
        }
      })
      .catch((err) => {
        console.error('Delegation failed', err)
      })
      .finally(() => {
        removePendingDelegation(wallet.address)
      })

    return () => {
      web3.off(txHash)
    }
  }, [delegations, wallet?.address, wallet?.chainId, web3])
}

export const useIsDelegationPending = (): boolean => {
  const delegations = delegateTxsStore.useStore()
  const wallet = useWallet()

  return wallet ? !!delegations?.[wallet.chainId]?.[wallet.address] : false
}
