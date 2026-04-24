import { Navigate, useParams } from 'react-router-dom'

export function ApplicationChatPage() {
  const { applicationId } = useParams()
  if (!applicationId) return <Navigate to="/chats" replace />
  return <Navigate to={`/chats/application/${applicationId}`} replace />
}
