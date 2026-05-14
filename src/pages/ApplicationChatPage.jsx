import { Navigate, useParams } from 'react-router-dom'
import { CHATS_INBOX_HREF } from '../lib/chatPaths'

export function ApplicationChatPage() {
  const { applicationId } = useParams()
  if (!applicationId) return <Navigate to={CHATS_INBOX_HREF} replace />
  return <Navigate to={`/chats/application/${applicationId}`} replace />
}
