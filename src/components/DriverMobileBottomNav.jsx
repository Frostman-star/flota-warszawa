import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, LayoutGrid, MessageCircleMore, Sparkles, UserRound, WalletCards } from 'lucide-react'
import { CHATS_INBOX_HREF } from '../lib/chatPaths'

export function DriverMobileBottomNav() {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  const item = (to, Icon, label, opts = {}) => {
    const pathOnly = String(to).split('?')[0]
    const active = opts.exact ? pathname === pathOnly : pathname === pathOnly || pathname.startsWith(`${pathOnly}/`)
    return (
      <Link to={to} className={`mob-nav-item${active ? ' active' : ''}`}>
        <span className="mob-nav-item-icon" aria-hidden><Icon size={18} strokeWidth={2.1} /></span>
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <nav className="mob-nav mob-nav--driver" aria-label={t('panel.quick')}>
      {item('/marketplace', Sparkles, t('nav.marketplace'), { exact: true })}
      {item('/obrane', Heart, t('favorites.title'), { exact: true })}
      {item('/zarobki', WalletCards, t('nav.finance'), { exact: true })}
      {item(CHATS_INBOX_HREF, MessageCircleMore, t('nav.chats'), { exact: false })}
      {item('/profil', UserRound, t('nav.profile'), { exact: true })}
      {item('/moje-wnioski', LayoutGrid, t('nav.myApplications'))}
    </nav>
  )
}
