import { Typography, Button, Chip, Stack, SvgIcon, Box, CircularProgress, Grid } from '@mui/material'
import { hexValue } from 'ethers/lib/utils'
import { ReactElement, useState } from 'react'

import { useOnboard } from '@/hooks/useOnboard'

import { useChainId } from '@/hooks/useChainId'
import { getConnectedWallet, useWallet } from '@/hooks/useWallet'
import { useRouter } from 'next/router'
import { AppRoutes } from '@/config/routes'
import Barcode from '@/public/images/barcode.svg'

import css from './styles.module.css'
import SafePass from '@/public/images/safe-pass.svg'
import { useIsSafeApp } from '@/hooks/useIsSafeApp'
import Asterix from '@/public/images/asterix.svg'
import { localItem } from '@/services/storage/local'
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect'
import { isSafe } from '@/utils/wallet'
import { trackSafeAppEvent } from '@/utils/analytics'
import { NAVIGATION_EVENTS } from '@/analytics/navigation'

const Step = ({ index, title, active }: { index: number; title: string; active: boolean }) => {
  return (
    <Stack direction="row" gap={2}>
      <Chip
        size="small"
        sx={{ width: '24px', height: '24px' }}
        label={index + 1}
        color={active ? 'primary' : undefined}
      />
      <Typography>{title}</Typography>
    </Stack>
  )
}

// Check if new or returning user
const ALREADY_VISITED = 'alreadyVisited'
const alreadyVisitedStorage = localItem<boolean>(ALREADY_VISITED)

/**
 * This page handles wallet connection and initial data loading.
 */
export const SplashScreen = (): ReactElement => {
  const onboard = useOnboard()
  const chainId = useChainId()
  const router = useRouter()
  const isSafeApp = useIsSafeApp()

  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string>()

  const wallet = useWallet()

  const isDisconnected = !isSafeApp && !wallet

  const onConnect = async () => {
    if (!onboard) {
      return
    }
    setError(undefined)
    setIsConnecting(true)
    try {
      const wallets = await onboard.connectWallet()
      const wallet = getConnectedWallet(wallets)

      // Here we check non-hardware wallets. Hardware wallets will always be on the correct
      // chain as onboard is only ever initialised with the current chain config
      const isWrongChain = wallet && wallet.chainId !== chainId
      if (isWrongChain) {
        await onboard.setChain({ wallet: wallet.label, chainId: hexValue(parseInt(chainId)) })
      }

      // When using the standalone app, only allow Safe accounts to be connected
      if (wallet && !isSafeApp && !(await isSafe(wallet))) {
        await onboard.disconnectWallet({ label: wallet.label })
        setError('Connected wallet must be a Safe')
        return
      }
      onContinue()
    } catch (error) {
      setError('Wallet connection failed.')
      return
    } finally {
      setIsConnecting(false)
    }
  }

  const onContinue = async () => {
    trackSafeAppEvent(NAVIGATION_EVENTS.OPEN_LOCKING.action, 'opening')
    alreadyVisitedStorage.set(true)
    const nextPage = router.query.next === AppRoutes.governance ? AppRoutes.governance : AppRoutes.activity
    router.push(nextPage)
  }

  useIsomorphicLayoutEffect(() => {
    const hasAlreadyVisited = alreadyVisitedStorage.get()
    if (isSafeApp && hasAlreadyVisited) {
      // We are a returning user and already connected
      // We only skip this step for the Safe App as we have to connect a wallet in the standalone version
      onContinue()
    }
  }, [isSafeApp])

  return (
    <Box display="flex" width="100%">
      <Grid container direction="row" className={css.milesReceipt}>
        <Grid item xs={12} md={8}>
          <Stack className={css.leftReceipt} justifyContent="space-between">
            <SvgIcon
              component={Asterix}
              inheritViewBox
              sx={{ color: 'transparent', position: 'absolute', top: 0, right: 0, height: '208px', width: '208px' }}
            />
            <SvgIcon component={SafePass} inheritViewBox sx={{ width: '175px', height: 'auto' }} />
            <Stack spacing={3} p={3}>
              <Typography variant="h2" fontSize="44px" lineHeight="120%" fontWeight="bold">
                Interact with Safe and get rewards
              </Typography>
              <Typography>Get your pass now! Lock your tokens and be active on Safe to get rewarded.</Typography>
              <Box>
                {isDisconnected ? (
                  <Button variant="contained" color="primary" onClick={onConnect} disabled={isConnecting}>
                    {isConnecting ? (
                      <Box display="flex" alignItems="center" flexDirection="row" gap={1}>
                        <Typography>Connecting</Typography>
                        <CircularProgress size={12} />
                      </Box>
                    ) : (
                      'Connect wallet'
                    )}
                  </Button>
                ) : (
                  <Button variant="contained" color="primary" onClick={onContinue}>
                    Continue
                  </Button>
                )}
                {error && (
                  <Typography mt={1} color="error.main">
                    {error}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack className={css.rightReceipt} gap={3} justifyContent="center">
            <Typography variant="caption" textTransform="uppercase" letterSpacing="1px" mt={12}>
              How it works
            </Typography>
            <Stack gap={3}>
              <Step index={0} title="Lock SAFE to boost your miles!" active={true} />
              <Step index={1} title="Earn miles for activity" active={false} />
              <Step index={2} title="Get rewards for earned miles" active={false} />
            </Stack>
            <Barcode className={css.barcode} />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}