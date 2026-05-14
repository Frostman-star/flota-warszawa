import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, Handshake, MessageCircleMore, UserCircle, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

const SEGMENT_IDS = /** @type {const} */ (['services', 'fleets', 'drivers', 'partners'])

/** @param {string | null | undefined} s */
function normalizeSegment(s) {
  const v = String(s || '').toLowerCase()
  return SEGMENT_IDS.includes(v) ? v : 'drivers'
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} segment
 */
function rowMatchesSegment(row, segment) {
  const role = String(row.peer_role || '').toLowerCase()
  const isApplication = row.thread_type === 'application'

  if (segment === 'drivers') return isApplication || role === 'driver'
  if (segment === 'services') return role === 'service'
  if (segment === 'fleets') return role === 'owner' || role === 'admin'
  if (segment === 'partners') {
    if (isApplication) return false
    if (role === 'driver' || role === 'service' || role === 'owner' || role === 'admin') return false
    return true
  }
  return false
}

/** @param {Record<string, unknown>[]} rows */
function segmentCounts(rows) {
  const out = { services: 0, fleets: 0, drivers: 0, partners: 0 }
  for (const row of rows) {
    for (const seg of SEGMENT_IDS) {
      if (rowMatchesSegment(row, seg)) out[seg] += 1
    }
  }
  return out
}

export function ChatsInboxPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const segment = normalizeSegment(searchParams.get('segment'))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    const { data, error: e1 } = await supabase.rpc('chat_inbox')
    setLoading(false)
    if (e1) {
      setError(e1.message)
      setRows([])
      return
    }
    setRows(Array.isArray(data) ? data : [])
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!searchParams.has('segment')) {
      setSearchParams({ segment: 'drivers' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const onFocus = () => void load()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  const counts = useMemo(() => segmentCounts(rows), [rows])
  const filtered = useMemo(() => rows.filter((row) => rowMatchesSegment(row, segment)), [rows, segment])

  const navItems = useMemo(
    () => [
      { id: 'services', label: t('chats.segment.services'), Icon: Wrench, count: counts.services },
      { id: 'fleets', label: t('chats.segment.fleets'), Icon: Car, count: counts.fleets },
      { id: 'drivers', label: t('chats.segment.drivers'), Icon: UserCircle, count: counts.drivers },
      { id: 'partners', label: t('chats.segment.partners'), Icon: Handshake, count: counts.partners },
    ],
    [counts, t]
  )

  function sidebarNavCls({ isActive }) {
    const base = 'chats-sidebar__link'
    return isActive ? `${base} chats-sidebar__link--active` : base
  }

  return (
    <div className="page-simple chats-page">
      <header className="chats-page__head">
        <div className="chats-page__title-row">
          <span className="chats-page__title-icon" aria-hidden>
            <MessageCircleMore size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h1 className="chats-page__title">{t('chats.title')}</h1>
            <p className="muted small chats-page__lead">{t('chats.lead')}</p>
          </div>
        </div>
      </header>

      <div className="chats-shell">
        <aside className="chats-sidebar card" aria-label={t('chats.sidebarAria')}>
          <p className="chats-sidebar__caption muted tiny">{t('chats.sidebarCaption')}</p>
          <nav className="chats-sidebar__nav" aria-label={t('chats.segmentNavAria')}>
            {navItems.map(({ id, label, Icon, count }) => (
              <NavLink
                key={id}
                to={{ pathname: '/chats', search: `?segment=${id}` }}
                className={sidebarNavCls}
                aria-current={segment === id ? 'page' : undefined}
              >
                <span className="chats-sidebar__link-icon" aria-hidden>
                  <Icon size={16} strokeWidth={2.1} />
                </span>
                <span className="chats-sidebar__link-label">{label}</span>
                <span className="chats-sidebar__count muted tiny" aria-label={t('chats.threadCount', { count })}>
                  {count}
                </span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="chats-main card" aria-labelledby="chats-main-heading">
          <h2 id="chats-main-heading" className="chats-main__heading">
            {t(`chats.segment.${segment}`)}
          </h2>
          <p className="muted small chats-main__sub">{t(`chats.segmentLead.${segment}`)}</p>

          {loading ? <LoadingSpinner /> : null}
          {error ? <p className="form-error">{error}</p> : null}

          {!loading && !error && rows.length === 0 ? (
            <div className="chats-empty chats-empty--global card pad-lg">
              <p className="muted">{t('chats.empty')}</p>
              <p className="muted small">{t('chats.emptyHint')}</p>
            </div>
          ) : null}

          {!loading && !error && rows.length > 0 && filtered.length === 0 ? (
            <div className="chats-empty card pad-lg">
              <p className="muted">{t(`chats.segmentEmpty.${segment}`)}</p>
              <p className="muted small">{t('chats.segmentEmptyHint')}</p>
            </div>
          ) : null}

          {!loading && !error && filtered.length > 0 ? (
            <ul className="chats-thread-list">
              {filtered.map((row) => (
                <li key={row.thread_id} className="chats-thread-row">
                  <div className="chats-thread-row__top">
                    <strong className="chats-thread-row__name">{row.peer_full_name || t('chats.unknownPeer')}</strong>
                    {Number(row.unread_count || 0) > 0 ? (
                      <span className="status-pill status-pill--pending">{t('chats.unread', { count: Number(row.unread_count) })}</span>
                    ) : null}
                  </div>
                  <p className="muted small chats-thread-row__preview">{row.last_message_body || t('chats.noMessages')}</p>
                  <p className="muted tiny">{row.last_message_at ? new Date(row.last_message_at).toLocaleString() : ''}</p>
                  <div className="chats-thread-row__actions">
                    <Link className="btn ghost small" to={`/chats/${row.thread_id}`}>
                      {t('chats.open')}
                    </Link>
                    {row.thread_type === 'application' && row.application_id ? (
                      <Link className="btn ghost small" to={`/chats/application/${row.application_id}`}>
                        {t('chats.openApplicationThread')}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}
