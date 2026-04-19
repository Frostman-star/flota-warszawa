import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/AppLayout'
import { DriverMobileBottomNav } from '../components/DriverMobileBottomNav'
import { useAuth } from '../context/AuthContext'
import { useCars } from '../hooks/useCars'

export function DriverLayout() {
  const { t } = useTranslation()
  const { isDriver, isAdmin, user } = useAuth()
  const location = useLocation()
  const isMarketplace = location.pathname === '/marketplace'

  const { cars } = useCars({ enabled: isAdmin && Boolean(user?.id), ownerId: user?.id ?? null })

  const showAdminTopExtras = isAdmin && !isMarketplace
  const extraTopLinkTo = isDriver ? '/profil' : isAdmin && !isMarketplace ? '/ustawienia' : null
  const extraTopLinkLabel = isDriver ? t('nav.profile') : t('app.settings')

  return (
    <>
      <AppLayout
        showNav={showAdminTopExtras}
        outletContext={null}
        notifCars={isAdmin ? cars : []}
        extraTopLinkTo={extraTopLinkTo}
        extraTopLinkLabel={extraTopLinkLabel}
      />
      {isDriver ? <DriverMobileBottomNav /> : null}
    </>
  )
}
