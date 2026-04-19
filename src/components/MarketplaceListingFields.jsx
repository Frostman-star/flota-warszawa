import { useTranslation } from 'react-i18next'

/** @typedef {{ marketplace_description?: string, marketplace_location?: string, marketplace_photo_url?: string, deposit_amount?: string, fuel_type?: string, transmission?: string, seats?: string, consumption?: string, marketplace_features?: string[], min_driver_age?: string, min_experience_years?: string, min_rental_months?: string, owner_phone?: string, owner_telegram?: string }} ListingForm */

const FEATURE_KEYS = ['seats_7', 'camera', 'dashcam', 'ac', 'gps', 'trunk']

/**
 * @param {{
 *   form: ListingForm,
 *   setForm: (fn: (f: ListingForm) => ListingForm) => void,
 *   disabled?: boolean,
 * }} props
 */
export function MarketplaceListingFields({ form, setForm, disabled = false }) {
  const { t } = useTranslation()
  const feats = Array.isArray(form.marketplace_features) ? form.marketplace_features : []

  function toggleFeature(key) {
    if (disabled) return
    setForm((f) => {
      const cur = Array.isArray(f.marketplace_features) ? f.marketplace_features : []
      const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]
      return { ...f, marketplace_features: next }
    })
  }

  function field(name, label, type = 'text', opts = {}) {
    const { rows, placeholder, step, min } = opts
    return (
      <label className="field">
        <span className="field-label">{label}</span>
        {type === 'textarea' ? (
          <textarea
            className="input"
            rows={rows ?? 3}
            name={name}
            value={form[name] ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          />
        ) : (
          <input
            className="input"
            type={type}
            name={name}
            value={form[name] ?? ''}
            placeholder={placeholder}
            step={step}
            min={min}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          />
        )}
      </label>
    )
  }

  return (
    <div className="market-listing-fields">
      <h3 className="market-listing-heading">{t('carForm.marketplaceListingHeading')}</h3>
      {field('marketplace_description', t('carForm.marketplaceDescription'), 'textarea', { rows: 3 })}
      {field('marketplace_location', t('carForm.marketplaceLocation'))}
      {field('marketplace_photo_url', t('carForm.marketplacePhotoUrl'), 'url', { placeholder: 'https://' })}
      {field('deposit_amount', t('carForm.depositAmount'), 'number', { min: 0, step: 1 })}
      <label className="field">
        <span className="field-label">{t('carForm.fuelType')}</span>
        <select
          className="input"
          value={form.fuel_type ?? 'benzyna'}
          disabled={disabled}
          onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value }))}
        >
          <option value="benzyna">{t('carForm.fuelBenzyna')}</option>
          <option value="diesel">{t('carForm.fuelDiesel')}</option>
          <option value="hybryda">{t('carForm.fuelHybryda')}</option>
          <option value="gaz">{t('carForm.fuelGaz')}</option>
          <option value="elektryczny">{t('carForm.fuelElektryczny')}</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t('carForm.transmission')}</span>
        <select
          className="input"
          value={form.transmission ?? 'automat'}
          disabled={disabled}
          onChange={(e) => setForm((f) => ({ ...f, transmission: e.target.value }))}
        >
          <option value="automat">{t('carForm.transmissionAuto')}</option>
          <option value="manualna">{t('carForm.transmissionManual')}</option>
        </select>
      </label>
      {field('seats', t('carForm.seatsCount'), 'number', { min: 1, max: 9, step: 1 })}
      {field('consumption', t('carForm.consumption'), 'text', { placeholder: t('carForm.consumptionPh') })}
      <div className="field">
        <span className="field-label">{t('carForm.marketplaceFeatures')}</span>
        <div className="market-feature-grid">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="checkbox-line market-feature-check">
              <input
                type="checkbox"
                checked={feats.includes(key)}
                disabled={disabled}
                onChange={() => toggleFeature(key)}
              />
              <span>{t(`carForm.feature.${key}`)}</span>
            </label>
          ))}
        </div>
      </div>
      {field('min_driver_age', t('carForm.minDriverAge'), 'number', { min: 18, max: 80, step: 1 })}
      {field('min_experience_years', t('carForm.minExperienceYears'), 'number', { min: 0, max: 40, step: 1 })}
      {field('min_rental_months', t('carForm.minRentalMonths'), 'number', { min: 1, max: 36, step: 1 })}
      {field('owner_phone', t('carForm.ownerPhone'), 'tel')}
      {field('owner_telegram', t('carForm.ownerTelegram'), 'text', { placeholder: t('carForm.ownerTelegramPh') })}
    </div>
  )
}
