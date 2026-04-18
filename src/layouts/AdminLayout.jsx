import { AppLayout } from '../components/AppLayout'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { PushBanner } from '../components/PushBanner'
import { RemindersBootstrap } from '../components/RemindersBootstrap'
import { useCars } from '../hooks/useCars'
import { useAuth } from '../context/AuthContext'

export function AdminLayout() {
  const { isAdmin } = useAuth()
  const { cars, loading, error, refresh } = useCars({ enabled: isAdmin })

  return (
    <>
      <RemindersBootstrap cars={cars} />
      <PushBanner />
      <AppLayout showNav={isAdmin} outletContext={{ cars, loading, error, refresh }} />
      {isAdmin ? <MobileBottomNav /> : null}
    </>
  )
}
