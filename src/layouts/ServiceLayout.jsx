import { AppLayout } from '../components/AppLayout'
import { PushBanner } from '../components/PushBanner'

export function ServiceLayout() {
  return (
    <>
      <PushBanner />
      <AppLayout showNav={false} outletContext={null} notifCars={[]} useOwnerSidebar={false} />
    </>
  )
}
