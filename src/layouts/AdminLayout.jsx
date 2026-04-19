import { AppLayout } from '../components/AppLayout'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { PushBanner } from '../components/PushBanner'
import { RemindersBootstrap } from '../components/RemindersBootstrap'
import { useCars } from '../hooks/useCars'
import { useAuth } from '../context/AuthContext'

export function AdminLayout() {
  const { isAdmin, user } = useAuth()
  const { cars, loading, error, refresh } = useCars({ enabled: isAdmin && Boolean(user?.id), ownerId: user?.id ?? null })

  return (
    <>
      <RemindersBootstrap cars={cars} />
      <PushBanner />
      <AppLayout showNav={isAdmin} outletContext={{ cars, loading, error, refresh }} notifCars={cars} />
      {isAdmin ? <MobileBottomNav /> : null}
    </>
  )
}
