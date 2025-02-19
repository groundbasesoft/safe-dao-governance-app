import { BigNumber } from 'ethers'

import { getVestingTypes } from '@/utils/vesting'
import { getAirdropInterface } from '@/services/contracts/Airdrop'
import { MAX_UINT128, splitAirdropAmounts } from '@/utils/airdrop'
import type { Vesting } from '@/hooks/useSafeTokenAllocation'
import { BaseTransaction } from '@/hooks/useTxSender'

const airdropInterface = getAirdropInterface()

const createRedeemTx = ({
  vestingClaim,
  airdropAddress,
}: {
  vestingClaim: Vesting
  airdropAddress: string
}): BaseTransaction => {
  const redeemData = airdropInterface.encodeFunctionData('redeem', [
    vestingClaim.curve,
    vestingClaim.durationWeeks,
    vestingClaim.startDate,
    vestingClaim.amount.toString(),
    vestingClaim.proof,
  ])

  return {
    to: airdropAddress,
    value: '0',
    data: redeemData,
  }
}

const createClaimTx = ({
  vestingClaim,
  amount,
  safeAddress,
  airdropAddress,
  isTokenPaused,
}: {
  vestingClaim: Vesting
  amount: string
  safeAddress: string
  airdropAddress: string
  isTokenPaused: boolean
}): BaseTransaction => {
  let claimData

  if (isTokenPaused) {
    claimData = airdropInterface.encodeFunctionData('claimVestedTokensViaModule', [
      vestingClaim.vestingId,
      safeAddress,
      amount,
    ])
  } else {
    claimData = airdropInterface.encodeFunctionData('claimVestedTokens', [vestingClaim.vestingId, safeAddress, amount])
  }

  return {
    to: airdropAddress,
    value: '0',
    data: claimData,
  }
}

const createAirdropTxs = ({
  vestingClaim,
  amount,
  safeAddress,
  airdropAddress,
  isTokenPaused,
}: {
  vestingClaim: Vesting
  amount: string
  safeAddress: string
  airdropAddress: string
  isTokenPaused: boolean
}): BaseTransaction[] => {
  const txs: BaseTransaction[] = []

  // Add redeem function if claiming for the first time
  if (!vestingClaim.isRedeemed) {
    const redeemTx = createRedeemTx({
      vestingClaim,
      airdropAddress,
    })

    txs.push(redeemTx)
  }

  const hasStarted = Math.floor(Date.now() / 1000) >= vestingClaim.startDate

  // Add claim function
  if (hasStarted) {
    const claimTx = createClaimTx({
      vestingClaim,
      amount,
      safeAddress,
      airdropAddress,
      isTokenPaused,
    })

    txs.push(claimTx)
  }

  return txs
}

export const createClaimTxs = ({
  vestingData,
  safeAddress,
  isMax,
  amount,
  userClaimable,
  sep5Claimable,
  investorClaimable,
  isTokenPaused,
}: {
  vestingData: Vesting[]
  safeAddress: string
  isMax: boolean
  amount: string
  userClaimable: string
  sep5Claimable: string
  investorClaimable: string
  isTokenPaused: boolean
}): BaseTransaction[] => {
  const txs: BaseTransaction[] = []

  // Create tx for userAirdrop
  const [sep5Amount, userAmount, investorAmount, ecosystemAmount] = splitAirdropAmounts({
    isMax,
    amount,
    userAirdropClaimable: userClaimable,
    sep5AirdropClaimable: sep5Claimable,
    investorClaimable,
  })

  const { userVesting, sep5Vesting, ecosystemVesting, investorVesting } = getVestingTypes(vestingData)

  // We must claim from SEP5 first in case the selected amount is below that of the pre-SEP5 allocation
  if (sep5Vesting && BigNumber.from(sep5Amount).gt(0)) {
    txs.push(
      ...createAirdropTxs({
        vestingClaim: sep5Vesting,
        amount: sep5Amount,
        safeAddress,
        airdropAddress: sep5Vesting.contract,
        isTokenPaused,
      }),
    )
  }

  if (userVesting && BigNumber.from(userAmount).gt(0)) {
    txs.push(
      ...createAirdropTxs({
        vestingClaim: userVesting,
        amount: userAmount,
        safeAddress,
        airdropAddress: userVesting.contract,
        isTokenPaused,
      }),
    )
  }

  if (ecosystemVesting && BigNumber.from(ecosystemAmount).gt(0)) {
    txs.push(
      ...createAirdropTxs({
        vestingClaim: ecosystemVesting,
        amount: ecosystemAmount,
        safeAddress,
        airdropAddress: ecosystemVesting.contract,
        isTokenPaused,
      }),
    )
  }

  if (investorVesting && BigNumber.from(investorAmount).gt(0)) {
    // Investors use the VestingPool contract and can not claim if paused
    if (!isTokenPaused) {
      txs.push(
        ...createAirdropTxs({
          vestingClaim: investorVesting,
          amount: investorAmount,
          safeAddress,
          airdropAddress: investorVesting.contract,
          isTokenPaused,
        }),
      )
    }
  }

  return txs
}

export const createSAPRedeemTxs = ({
  vestingData,
  sapBoostedClaimable,
  sapUnboostedClaimable,
}: {
  vestingData: Vesting[]
  sapBoostedClaimable: string
  sapUnboostedClaimable: string
}) => {
  const txs: BaseTransaction[] = []

  const { sapBoostedVesting, sapUnboostedVesting } = getVestingTypes(vestingData)

  if (sapBoostedVesting && BigNumber.from(sapBoostedClaimable).gt(0) && !sapBoostedVesting.isRedeemed) {
    const redeemTx = createRedeemTx({
      vestingClaim: sapBoostedVesting,
      airdropAddress: sapBoostedVesting.contract,
    })

    txs.push(redeemTx)
  }

  if (sapUnboostedVesting && BigNumber.from(sapUnboostedClaimable).gt(0) && !sapUnboostedVesting.isRedeemed) {
    const redeemTx = createRedeemTx({
      vestingClaim: sapUnboostedVesting,
      airdropAddress: sapUnboostedVesting.contract,
    })

    txs.push(redeemTx)
  }

  return txs
}

export const createSAPClaimTxs = ({
  vestingData,
  sapBoostedClaimable,
  sapUnboostedClaimable,
  safeAddress,
}: {
  vestingData: Vesting[]
  sapBoostedClaimable: string
  sapUnboostedClaimable: string
  safeAddress: string
}): BaseTransaction[] => {
  const txs: BaseTransaction[] = []

  const { sapBoostedVesting, sapUnboostedVesting } = getVestingTypes(vestingData)

  if (sapBoostedVesting && BigNumber.from(sapBoostedClaimable).gt(0)) {
    txs.push(
      ...createAirdropTxs({
        vestingClaim: sapBoostedVesting,
        amount: MAX_UINT128.toString(),
        safeAddress,
        airdropAddress: sapBoostedVesting.contract,
        isTokenPaused: false,
      }),
    )
  }

  if (sapUnboostedVesting && BigNumber.from(sapUnboostedClaimable).gt(0)) {
    txs.push(
      ...createAirdropTxs({
        vestingClaim: sapUnboostedVesting,
        amount: MAX_UINT128.toString(),
        safeAddress,
        airdropAddress: sapUnboostedVesting.contract,
        isTokenPaused: false,
      }),
    )
  }

  return txs
}
