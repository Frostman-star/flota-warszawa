import { Navigate, Route, Routes } from 'react-router-dom'
import { DocumentHead } from './components/DocumentHead'
import { AdminLayout } from './layouts/AdminLayout'
import { CarPageShell } from './layouts/CarPageShell'
import { DriverLayout } from './layouts/DriverLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AddCarWizard } from './pages/AddCarWizard'
import { AlertsPage } from './pages/AlertsPage'
import { CarDetail } from './pages/CarDetail'
import { DriverMyApplications } from './pages/DriverMyApplications'
import { DriverProfile } from './pages/DriverProfile'
import { Fleet } from './pages/Fleet'
import { Marketplace } from './pages/Marketplace'
import { OwnerApplications } from './pages/OwnerApplications'
import { PanelHome } from './pages/PanelHome'
import { HomeRedirect } from './pages/HomeRedirect'
import { Login } from './pages/Login'
import { NoCar } from './pages/NoCar'
import { Settings } from './pages/Settings'
import { Statistics } from './pages/Statistics'
import { Services } from './pages/Services'
import { ResetPassword } from './pages/ResetPassword'
import { AuthCallback } from './pages/AuthCallback'
import { RoleSelection } from './pages/RoleSelection'
import { PublicFleetProfile } from './pages/PublicFleetProfile'

export default function App() {
  return (
    <>
      <DocumentHead />
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/wybierz-role"
        element={
          <ProtectedRoute>
            <RoleSelection />
          </ProtectedRoute>
        }
      />
      <Route path="/flota/:ownerId" element={<PublicFleetProfile />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/brak-pojazdu"
        element={
          <ProtectedRoute>
            <NoCar />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <DriverLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/profil" element={<DriverProfile />} />
        <Route path="/moje-wnioski" element={<DriverMyApplications />} />
      </Route>
      <Route
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/panel" element={<PanelHome />} />
        <Route path="/dodaj" element={<AddCarWizard />} />
        <Route path="/flota" element={<Fleet />} />
        <Route path="/alerty" element={<AlertsPage />} />
        <Route path="/statystyki" element={<Statistics />} />
        <Route path="/serwisy" element={<Services />} />
        <Route path="/ustawienia" element={<Settings />} />
        <Route path="/wnioski" element={<OwnerApplications />} />
        <Route path="/pojazd/:id" element={<CarPageShell nestInAdminLayout />}>
          <Route index element={<CarDetail />} />
        </Route>
      </Route>
      <Route
        path="/samochod/:id"
        element={
          <ProtectedRoute>
            <CarPageShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<CarDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
