import { BigNumber } from 'ethers'

import { AIRDROP_TAGS } from '@/config/constants'
import type { Vesting } from '@/hooks/useSafeTokenAllocation'

const LINEAR_CURVE = 0
const EXPONENTIAL_CURVE = 1

/*
 * This buffer is needed as the block timestamp is slightly behind the real timestamp.
 * Even when using the latest block timestamp the gas estimation of created txs sometimes fails.
 * Experiments showed that 30 seconds is a solid value.
 */
export const DESYNC_BUFFER = 30

export const calculateVestedAmount = (vestingClaim: Vesting): string => {
  const durationInSeconds = vestingClaim.durationWeeks * 7 * 24 * 60 * 60
  const timeStampInSeconds = Math.floor(new Date().getTime() / 1000) - DESYNC_BUFFER

  // Vesting did not start yet!
  if (timeStampInSeconds < vestingClaim.startDate) {
    return '0'
  }

  const vestedSeconds = timeStampInSeconds - vestingClaim.startDate

  if (vestedSeconds >= durationInSeconds) {
    return vestingClaim.amount.toString()
  }

  if (vestingClaim.curve === LINEAR_CURVE) {
    return BigNumber.from(vestingClaim.amount)
      .mul(BigNumber.from(vestedSeconds))
      .div(BigNumber.from(durationInSeconds))
      .toString()
  }

  if (vestingClaim.curve === EXPONENTIAL_CURVE) {
    return BigNumber.from(vestingClaim.amount)
      .mul(BigNumber.from(vestedSeconds).pow(2))
      .div(BigNumber.from(durationInSeconds).pow(2))
      .toString()
  }

  throw new Error('Invalid curve type')
}

export const getVestingTypes = (vestingData: Vesting[]) => {
  const userVesting = vestingData?.find((vesting) => vesting.tag === AIRDROP_TAGS.USER) ?? null
  const sep5Vesting = vestingData?.find((vesting) => vesting.tag === AIRDROP_TAGS.SEP5) ?? null
  const ecosystemVesting = vestingData?.find((vesting) => vesting.tag === AIRDROP_TAGS.ECOSYSTEM) ?? null
  const investorVesting = vestingData?.find((vesting) => vesting.tag === AIRDROP_TAGS.INVESTOR) ?? null
  const sapBoostedVesting = vestingData?.find((vesting) => vesting.tag === AIRDROP_TAGS.SAP_BOOSTED) ?? null
  const sapUnboostedVesting = vestingData?.find((vesting) => vesting.tag === AIRDROP_TAGS.SAP_UNBOOSTED) ?? null

  return {
    userVesting,
    sep5Vesting,
    ecosystemVesting,
    investorVesting,
    sapBoostedVesting,
    sapUnboostedVesting,
  }
}
