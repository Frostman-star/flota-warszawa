import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const LANG_CODES = ['pl', 'uk', 'en', 'ru']
const ownerFlowSteps = [1, 2, 3, 4]
const driverFlowSteps = [1, 2, 3, 4]

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
        <FadeSection id="hero" className="landing-hero landing-hero-static is-visible">
          <img
            src="/images/landing-top-overlay-base.png"
            alt={t('landing.hero.title')}
            className="landing-hero-static-image"
          />
          <div
            className="landing-hero-overlay-panel"
            aria-label={t('landing.hero.overlayAria', { defaultValue: 'Quick role selection panel' })}
          >
            <Link className="btn primary landing-hero-overlay-btn" to="/register?role=owner">
              {t('landing.hero.owner.cta')}
            </Link>
            <Link className="btn landing-driver-btn landing-hero-overlay-btn" to="/register?role=driver">
              {t('landing.hero.driver.cta')}
            </Link>
          </div>
        </FadeSection>

        <FadeSection id="owners">
          <p className="landing-kicker">{t('landing.owners.kicker')}</p>
          <h2>{t('landing.owners.title')}</h2>
          <p className="landing-subhead">{t('landing.owners.subtitle')}</p>

          <div className="landing-grid three">
            {[1, 2, 3].map((idx) => (
              <article key={`owner-pain-${idx}`} className="landing-card">
                <h3>{t(`landing.owners.pain.${idx}.title`)}</h3>
                <p className="muted">{t(`landing.owners.pain.${idx}.desc`)}</p>
              </article>
            ))}
          </div>

          <div className="landing-grid three">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <article key={`owner-feature-${idx}`} className="landing-card compact">
                <p>{t(`landing.owners.features.${idx}`)}</p>
              </article>
            ))}
          </div>
        </FadeSection>

        <FadeSection id="drivers">
          <p className="landing-kicker">{t('landing.drivers.kicker')}</p>
          <h2>{t('landing.drivers.title')}</h2>
          <p className="landing-subhead">{t('landing.drivers.subtitle')}</p>

          <div className="landing-grid three">
            {[1, 2, 3].map((idx) => (
              <article key={`driver-pain-${idx}`} className="landing-card">
                <h3>{t(`landing.drivers.pain.${idx}.title`)}</h3>
                <p className="muted">{t(`landing.drivers.pain.${idx}.desc`)}</p>
              </article>
            ))}
          </div>

          <div className="landing-grid two">
            {[1, 2, 3, 4].map((idx) => (
              <article key={`driver-feature-${idx}`} className="landing-card">
                <h3>{t(`landing.drivers.features.${idx}.title`)}</h3>
                <p className="muted">{t(`landing.drivers.features.${idx}.desc`)}</p>
              </article>
            ))}
          </div>
        </FadeSection>

        <div className="landing-lowest-bg-wrap reveal" data-reveal>
          <FadeSection id="flow" className="landing-flow-panel">
            <h2>{t('landing.flow.title')}</h2>
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
            <ol className="landing-steps">
              {(activeFlowTab === 'owner' ? ownerFlowSteps : driverFlowSteps).map((step) => (
                <li key={`${activeFlowTab}-step-${step}`}>{t(`landing.flow.${activeFlowTab}.steps.${step}`)}</li>
              ))}
            </ol>
          </FadeSection>

          <FadeSection id="pricing">
            <h2>{t('landing.pricing.title')}</h2>
            <div className="landing-grid three">
              {['free', 'start', 'pro'].map((tier) => (
                <article key={tier} className={`landing-card tier ${tier}`}>
                  <p className="tier-name">{t(`landing.pricing.owner.${tier}.name`)}</p>
                  <p className="tier-price">{t(`landing.pricing.owner.${tier}.price`)}</p>
                  <p className="muted">{t(`landing.pricing.owner.${tier}.desc`)}</p>
                </article>
              ))}
            </div>
            <article className="landing-driver-banner">
              <h3>{t('landing.pricing.driver.title')}</h3>
              <p>{t('landing.pricing.driver.desc')}</p>
            </article>
          </FadeSection>

          <FadeSection id="proof">
            <h2>{t('landing.proof.title')}</h2>
            <div className="landing-grid three">
              {[1, 2, 3].map((idx) => (
                <article key={`stat-${idx}`} className="landing-card compact">
                  <p className="landing-stat-label">{t(`landing.proof.stats.${idx}`)}</p>
                </article>
              ))}
            </div>
          </FadeSection>

          <FadeSection id="cta" className="landing-final-cta landing-cta-panel">
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
          </FadeSection>
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
