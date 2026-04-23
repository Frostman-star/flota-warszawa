import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  Bell,
  Calculator,
  Car,
  ChartNoAxesCombined,
  Check,
  CircleUserRound,
  Clock3,
  FileCheck2,
  Globe,
  Handshake,
  Heart,
  PhoneCall,
  Rocket,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Wrench,
} from 'lucide-react'

const LANG_CODES = ['pl', 'uk', 'en', 'ru']
const ownerFlowSteps = [1, 2, 3, 4]
const driverFlowSteps = [1, 2, 3, 4]

function cleanTitle(value) {
  if (!value) return ''
  return value.replace(/^[^\p{L}\p{N}]+/gu, '').trim()
}

function FadeSection({ id, className = '', children }) {
  return (
    <section id={id} className={`landing-section reveal ${className}`.trim()} data-reveal>
      {children}
    </section>
  )
}

function LandingLanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="landing-lang-switch" role="group" aria-label="Language switcher">
      {LANG_CODES.map((code) => (
        <button
          key={code}
          type="button"
          className={`landing-lang-btn ${i18n.language === code ? 'is-active' : ''}`.trim()}
          onClick={() => i18n.changeLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function LandingPage() {
  const { t } = useTranslation()
  const [activeFlowTab, setActiveFlowTab] = useState('owner')
  const ownerPainIcons = [FileCheck2, Search, Handshake]
  const ownerFeatureIcons = [Bell, ChartNoAxesCombined, Smartphone, Globe, Wrench, Users]
  const driverPainIcons = [Search, Calculator, Shield]
  const driverFeatureIcons = [Car, Calculator, Sparkles, Heart]
  const proofIcons = [Car, CircleUserRound, Globe]

  const flowBenefitCards = useMemo(
    () => [
      { icon: Shield, title: t('landing.flow.benefits.1.title', { defaultValue: 'Безпечно та надійно' }), desc: t('landing.flow.benefits.1.desc', { defaultValue: 'Перевірені власники та захищені контакти' }) },
      { icon: Clock3, title: t('landing.flow.benefits.2.title', { defaultValue: 'Швидко та зручно' }), desc: t('landing.flow.benefits.2.desc', { defaultValue: 'Економія часу на пошук і домовленості' }) },
      { icon: ChartNoAxesCombined, title: t('landing.flow.benefits.3.title', { defaultValue: 'Більше прибутку' }), desc: t('landing.flow.benefits.3.desc', { defaultValue: 'Кращі умови, більше замовлень та постійні поїздки' }) },
      { icon: Smartphone, title: t('landing.flow.benefits.4.title', { defaultValue: 'Мобільний додаток' }), desc: t('landing.flow.benefits.4.desc', { defaultValue: 'Усі можливості під рукою в Cario' }) },
      { icon: Bell, title: t('landing.flow.benefits.5.title', { defaultValue: 'Розумні сповіщення' }), desc: t('landing.flow.benefits.5.desc', { defaultValue: 'Отримуй сигнали про нові авто та важливі події' }) },
      { icon: PhoneCall, title: t('landing.flow.benefits.6.title', { defaultValue: 'Підтримка 24/7' }), desc: t('landing.flow.benefits.6.desc', { defaultValue: 'Команда Cario завжди на звʼязку' }) },
    ],
    [t]
  )

  useEffect(() => {
    const items = Array.from(document.querySelectorAll('[data-reveal]'))
    if (!items.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    )

    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <div className="landing-topbar-inner">
          <a href="#top" className="brand brand-lockup landing-brand">
            <span className="brand-icon" aria-hidden>
              <img src="/brand-emblem.png" alt="" className="brand-icon-img" />
            </span>
            <span className="brand-word">{t('app.brandName')}</span>
          </a>

          <nav className="landing-nav" aria-label={t('landing.navAria')}>
            <a href="#owners">{t('landing.nav.owners')}</a>
            <a href="#drivers">{t('landing.nav.drivers')}</a>
            <a href="#pricing">{t('landing.nav.pricing')}</a>
          </nav>

          <div className="landing-actions">
            <LandingLanguageSwitcher />
            <Link to="/login" className="landing-login">
              {t('landing.nav.login')}
            </Link>
            <Link to="/register" className="btn primary small">
              {t('landing.nav.startFree')}
            </Link>
          </div>
        </div>
      </header>

      <main id="top" className="landing-main page-pad">
        <FadeSection id="hero" className="landing-hero-cyber is-visible">
          <div className="landing-hero-headline">
            <h1>{t('landing.hero.title')}</h1>
          </div>
          <div className="landing-audience-grid cyber">
            <article className="landing-audience-card owner cyber-card">
              <div className="landing-audience-title">
                <Car size={20} />
                <h2>{cleanTitle(t('landing.hero.owner.title'))}</h2>
              </div>
              <p>{t('landing.hero.owner.desc')}</p>
              <Link className="btn primary" to="/register?role=owner">
                {t('landing.hero.owner.cta')}
              </Link>
            </article>
            <article className="landing-audience-card driver cyber-card">
              <div className="landing-audience-title">
                <CircleUserRound size={20} />
                <h2>{cleanTitle(t('landing.hero.driver.title'))}</h2>
              </div>
              <p>{t('landing.hero.driver.desc')}</p>
              <Link className="btn landing-driver-btn" to="/register?role=driver">
                {t('landing.hero.driver.cta')}
              </Link>
            </article>
          </div>
        </FadeSection>

        <FadeSection id="owners" className="landing-block-cyber">
          <p className="landing-kicker">{t('landing.owners.kicker')}</p>
          <h2>{t('landing.owners.title')}</h2>
          <p className="landing-subhead">{t('landing.owners.subtitle')}</p>

          <div className="landing-grid three cyber-cards">
            {[1, 2, 3].map((idx, i) => {
              const Icon = ownerPainIcons[i]
              return (
                <article key={`owner-pain-${idx}`} className="landing-card cyber-card">
                  <h3 className="landing-card-title">
                    <Icon size={18} />
                    <span>{cleanTitle(t(`landing.owners.pain.${idx}.title`))}</span>
                  </h3>
                  <p className="muted">{t(`landing.owners.pain.${idx}.desc`)}</p>
                </article>
              )
            })}
          </div>

          <div className="landing-grid three cyber-cards">
            {[1, 2, 3, 4, 5, 6].map((idx, i) => {
              const Icon = ownerFeatureIcons[i]
              return (
                <article key={`owner-feature-${idx}`} className="landing-card compact cyber-card">
                  <p className="landing-card-title compact">
                    <Icon size={17} />
                    <span>{cleanTitle(t(`landing.owners.features.${idx}`))}</span>
                  </p>
                </article>
              )
            })}
          </div>
        </FadeSection>

        <FadeSection id="drivers" className="landing-block-cyber">
          <p className="landing-kicker">{t('landing.drivers.kicker')}</p>
          <h2>{t('landing.drivers.title')}</h2>
          <p className="landing-subhead">{t('landing.drivers.subtitle')}</p>

          <div className="landing-grid three cyber-cards">
            {[1, 2, 3].map((idx, i) => {
              const Icon = driverPainIcons[i]
              return (
                <article key={`driver-pain-${idx}`} className="landing-card cyber-card">
                  <h3 className="landing-card-title">
                    <Icon size={18} />
                    <span>{cleanTitle(t(`landing.drivers.pain.${idx}.title`))}</span>
                  </h3>
                  <p className="muted">{t(`landing.drivers.pain.${idx}.desc`)}</p>
                </article>
              )
            })}
          </div>

          <div className="landing-grid two cyber-cards">
            {[1, 2, 3, 4].map((idx, i) => {
              const Icon = driverFeatureIcons[i]
              return (
                <article key={`driver-feature-${idx}`} className="landing-card cyber-card">
                  <h3 className="landing-card-title">
                    <Icon size={18} />
                    <span>{cleanTitle(t(`landing.drivers.features.${idx}.title`))}</span>
                  </h3>
                  <p className="muted">{t(`landing.drivers.features.${idx}.desc`)}</p>
                </article>
              )
            })}
          </div>
        </FadeSection>

        <div className="landing-combined-cyber reveal" data-reveal>
          <section id="flow" className="landing-flow-column landing-panel">
            <p className="landing-kicker">{t('landing.flow.title')}</p>
            <h2>{t('landing.flow.subtitle', { defaultValue: 'Все просто в три кроки' })}</h2>
            <div className="landing-tabs">
              <button
                type="button"
                className={`landing-tab ${activeFlowTab === 'owner' ? 'is-active' : ''}`}
                onClick={() => setActiveFlowTab('owner')}
              >
                {t('landing.flow.owner.tab')}
              </button>
              <button
                type="button"
                className={`landing-tab ${activeFlowTab === 'driver' ? 'is-active' : ''}`}
                onClick={() => setActiveFlowTab('driver')}
              >
                {t('landing.flow.driver.tab')}
              </button>
            </div>
            <ol className="landing-steps cyber">
              {(activeFlowTab === 'owner' ? ownerFlowSteps : driverFlowSteps).map((step) => (
                <li key={`${activeFlowTab}-step-${step}`}>
                  <span className="landing-step-index">{String(step).padStart(2, '0')}</span>
                  <span>{t(`landing.flow.${activeFlowTab}.steps.${step}`)}</span>
                </li>
              ))}
            </ol>
            <div className="landing-grid three cyber-cards flow-benefits">
              {flowBenefitCards.map(({ icon: Icon, title, desc }) => (
                <article key={title} className="landing-card compact cyber-card">
                  <p className="landing-card-title compact">
                    <Icon size={16} />
                    <span>{title}</span>
                  </p>
                  <p className="muted small">{desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="pricing" className="landing-pricing-column landing-panel">
            <p className="landing-kicker">{t('landing.pricing.title')}</p>
            <h2>{t('landing.pricing.title')}</h2>
            <div className="landing-grid three pricing-cards">
              {['free', 'start', 'pro'].map((tier) => (
                <article key={tier} className={`landing-card tier ${tier} cyber-card`}>
                  <p className="landing-tier-icon">
                    {tier === 'pro' ? <Star size={18} /> : <Rocket size={18} />}
                  </p>
                  <p className="tier-name">{t(`landing.pricing.owner.${tier}.name`)}</p>
                  <p className="tier-price">{t(`landing.pricing.owner.${tier}.price`)}</p>
                  <p className="muted">{t(`landing.pricing.owner.${tier}.desc`)}</p>
                  {tier === 'start' ? (
                    <span className="landing-tier-badge">{t('landing.pricing.popular', { defaultValue: 'популярний' })}</span>
                  ) : null}
                </article>
              ))}
            </div>
            <article className="landing-driver-banner">
              <div className="landing-driver-banner-icon">
                <BadgeCheck size={24} />
              </div>
              <div>
                <h3>{t('landing.pricing.driver.title')}</h3>
                <p>{t('landing.pricing.driver.desc')}</p>
              </div>
            </article>
          </section>

          <section id="cta" className="landing-final-cta landing-panel">
            <h2>{t('landing.cta.title')}</h2>
            <div className="landing-cta-actions">
              <Link to="/register?role=owner" className="btn primary">
                {t('landing.cta.owner')}
              </Link>
              <Link to="/register?role=driver" className="btn landing-driver-btn">
                {t('landing.cta.driver')}
              </Link>
            </div>
            <p className="muted small">{t('landing.cta.note')}</p>
            <div className="landing-cta-meta">
              <p>
                <Check size={14} /> {t('landing.cta.meta1', { defaultValue: 'Безкоштовний старт' })}
              </p>
              <p>
                <Bell size={14} /> {t('landing.cta.meta2', { defaultValue: 'Підтримка 24/7' })}
              </p>
              <p>
                <Shield size={14} /> {t('landing.cta.meta3', { defaultValue: 'Без прихованих платежів' })}
              </p>
            </div>
          </section>

          <section id="proof" className="landing-panel">
            <h2>{t('landing.proof.title')}</h2>
            <div className="landing-grid three cyber-cards">
              {[1, 2, 3].map((idx, i) => {
                const Icon = proofIcons[i]
                return (
                  <article key={`stat-${idx}`} className="landing-card compact cyber-card">
                    <p className="landing-card-title compact">
                      <Icon size={17} />
                      <span>{cleanTitle(t(`landing.proof.stats.${idx}`))}</span>
                    </p>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner page-pad">
          <div>
            <p className="brand brand-lockup">
              <span className="brand-icon" aria-hidden>
                <img src="/brand-emblem.png" alt="" className="brand-icon-img" />
              </span>
              <span className="brand-word">{t('app.brandName')}</span>
            </p>
            <p className="muted small">{t('landing.footer.tagline')}</p>
          </div>
          <nav className="landing-footer-links">
            <a href="#">{t('landing.footer.terms')}</a>
            <a href="#">{t('landing.footer.privacy')}</a>
            <a href="#">{t('landing.footer.contact')}</a>
            <a href="https://t.me/" target="_blank" rel="noreferrer">
              {t('landing.footer.telegram')}
            </a>
          </nav>
          <p className="muted small">{t('landing.footer.copyright')}</p>
        </div>
      </footer>
    </div>
  )
}
