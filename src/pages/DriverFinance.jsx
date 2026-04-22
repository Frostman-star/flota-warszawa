import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDriverAssignedCar } from '../hooks/useDriverAssignedCar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { localeTag } from '../utils/localeTag'

function parseAmount(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function monthKeyFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function DriverFinance() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { user } = useAuth()
  const { assignment } = useDriverAssignedCar(user?.id, Boolean(user?.id))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')
  const [incomeRows, setIncomeRows] = useState([])
  const [expenseRows, setExpenseRows] = useState([])
  const [goal, setGoal] = useState(null)
  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    category: 'rides',
    happened_on: new Date().toISOString().slice(0, 10),
    note: '',
  })
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'fuel',
    happened_on: new Date().toISOString().slice(0, 10),
    note: '',
  })
  const [goalAmount, setGoalAmount] = useState('')
  const [calcForm, setCalcForm] = useState({
    targetNet: '',
    expectedExpenses: '',
    commissionPct: '10',
  })

  const incomeCats = ['rides', 'tips', 'bonus', 'other']
  const expenseCats = ['fuel', 'wash', 'service', 'fees', 'fines', 'other']

  const fmtMoney = useCallback(
    (v) => Number(v || 0).toLocaleString(lc, { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }),
    [lc]
  )

  const reload = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    const [{ data: inc, error: incErr }, { data: exp, error: expErr }, { data: goals, error: goalsErr }] = await Promise.all([
      supabase.from('driver_income_entries').select('id, amount, category, happened_on, note, created_at').order('happened_on', { ascending: false }).limit(120),
      supabase.from('driver_expense_entries').select('id, amount, category, happened_on, note, created_at').order('happened_on', { ascending: false }).limit(120),
      supabase.from('driver_finance_goals').select('id, target_amount, period_key, created_at').order('created_at', { ascending: false }).limit(1),
    ])
    if (incErr || expErr || goalsErr) {
      setError(incErr?.message || expErr?.message || goalsErr?.message || t('app.errorGeneric'))
      setLoading(false)
      return
    }
    setIncomeRows(Array.isArray(inc) ? inc : [])
    setExpenseRows(Array.isArray(exp) ? exp : [])
    const currentGoal = Array.isArray(goals) && goals.length > 0 ? goals[0] : null
    setGoal(currentGoal)
    setGoalAmount(currentGoal?.target_amount != null ? String(currentGoal.target_amount) : '')
    setLoading(false)
  }, [user?.id, t])

  useEffect(() => {
    void reload()
  }, [reload])

  const monthKey = useMemo(() => monthKeyFromDate(new Date()), [])
  const monthlyIncome = useMemo(
    () => incomeRows.filter((r) => String(r.happened_on || '').startsWith(monthKey)).reduce((s, r) => s + parseAmount(r.amount), 0),
    [incomeRows, monthKey]
  )
  const monthlyExpenses = useMemo(
    () => expenseRows.filter((r) => String(r.happened_on || '').startsWith(monthKey)).reduce((s, r) => s + parseAmount(r.amount), 0),
    [expenseRows, monthKey]
  )
  const monthlyNet = monthlyIncome - monthlyExpenses
  const goalTarget = parseAmount(goal?.target_amount)
  const goalProgress = goalTarget > 0 ? Math.min(100, Math.max(0, (monthlyNet / goalTarget) * 100)) : 0

  const requiredDaily = useMemo(() => {
    if (goalTarget <= 0) return 0
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysLeft = Math.max(1, end.getDate() - now.getDate() + 1)
    const remain = Math.max(0, goalTarget - monthlyNet)
    return remain / daysLeft
  }, [goalTarget, monthlyNet])

  const calcRequiredGross = useMemo(() => {
    const targetNet = parseAmount(calcForm.targetNet)
    const expectedExpenses = parseAmount(calcForm.expectedExpenses)
    const commissionPct = parseAmount(calcForm.commissionPct)
    const keepPct = Math.max(0, 100 - commissionPct)
    if (keepPct <= 0) return null
    return ((targetNet + expectedExpenses) * 100) / keepPct
  }, [calcForm])

  async function addIncome(e) {
    e.preventDefault()
    if (!user?.id) return
    setBanner('')
    const amount = parseAmount(incomeForm.amount)
    if (amount <= 0) return
    const { error: insErr } = await supabase.from('driver_income_entries').insert({
      driver_id: user.id,
      car_id: assignment?.carId ?? null,
      amount,
      category: incomeForm.category,
      happened_on: incomeForm.happened_on,
      note: incomeForm.note.trim() || null,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setIncomeForm((prev) => ({ ...prev, amount: '', note: '' }))
    setBanner(t('driverFinance.saved'))
    await reload()
  }

  async function addExpense(e) {
    e.preventDefault()
    if (!user?.id) return
    setBanner('')
    const amount = parseAmount(expenseForm.amount)
    if (amount <= 0) return
    const { error: insErr } = await supabase.from('driver_expense_entries').insert({
      driver_id: user.id,
      car_id: assignment?.carId ?? null,
      amount,
      category: expenseForm.category,
      happened_on: expenseForm.happened_on,
      note: expenseForm.note.trim() || null,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setExpenseForm((prev) => ({ ...prev, amount: '', note: '' }))
    setBanner(t('driverFinance.saved'))
    await reload()
  }

  async function saveGoal(e) {
    e.preventDefault()
    if (!user?.id) return
    const targetAmount = parseAmount(goalAmount)
    if (targetAmount <= 0) return
    const payload = {
      driver_id: user.id,
      target_amount: targetAmount,
      period_key: monthKey,
    }
    const req = goal?.id
      ? supabase.from('driver_finance_goals').update(payload).eq('id', goal.id)
      : supabase.from('driver_finance_goals').insert(payload)
    const { error: saveErr } = await req
    if (saveErr) {
      setError(saveErr.message)
      return
    }
    setBanner(t('driverFinance.goalSaved'))
    await reload()
  }

  if (loading) return <div className="page-simple"><LoadingSpinner /></div>

  return (
    <div className="page-simple driver-finance-page">
      <p className="muted small">
        <Link to="/profil" className="link">← {t('nav.profile')}</Link>
      </p>
      <h1>{t('driverFinance.title')}</h1>
      <p className="muted">{t('driverFinance.lead')}</p>
      {assignment?.plate ? <p className="driver-finance-assigned muted small">{t('driverFinance.car', { plate: assignment.plate })}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {banner ? <p className="form-info">{banner}</p> : null}

      <section className="driver-finance-kpis">
        <article className="card pad-lg">
          <span className="muted small">{t('driverFinance.kpiIncome')}</span>
          <strong>{fmtMoney(monthlyIncome)}</strong>
        </article>
        <article className="card pad-lg">
          <span className="muted small">{t('driverFinance.kpiExpenses')}</span>
          <strong>{fmtMoney(monthlyExpenses)}</strong>
        </article>
        <article className="card pad-lg">
          <span className="muted small">{t('driverFinance.kpiNet')}</span>
          <strong className={monthlyNet >= 0 ? 'stats-money--in' : 'stats-money--out'}>{fmtMoney(monthlyNet)}</strong>
        </article>
      </section>

      <section className="card pad-lg driver-finance-goal">
        <div className="driver-finance-goal-head">
          <strong>{t('driverFinance.goalTitle')}</strong>
          <span className="muted small">{t('driverFinance.goalProgress', { pct: Math.round(goalProgress) })}</span>
        </div>
        <div className="driver-finance-progress">
          <div style={{ width: `${goalProgress}%` }} />
        </div>
        <p className="muted small">{t('driverFinance.requiredDaily', { value: fmtMoney(requiredDaily) })}</p>
        <form className="driver-finance-inline-form" onSubmit={saveGoal}>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            placeholder={t('driverFinance.goalPlaceholder')}
          />
          <button type="submit" className="btn primary">{t('driverFinance.saveGoal')}</button>
        </form>
      </section>

      <section className="driver-finance-forms">
        <form className="card pad-lg driver-finance-form" onSubmit={addIncome}>
          <h2>{t('driverFinance.addIncome')}</h2>
          <input className="input" type="number" step="0.01" min="0" value={incomeForm.amount} onChange={(e) => setIncomeForm((p) => ({ ...p, amount: e.target.value }))} placeholder={t('driverFinance.amount')} required />
          <select className="input" value={incomeForm.category} onChange={(e) => setIncomeForm((p) => ({ ...p, category: e.target.value }))}>
            {incomeCats.map((c) => <option key={c} value={c}>{t(`driverFinance.incomeCat.${c}`)}</option>)}
          </select>
          <input className="input" type="date" value={incomeForm.happened_on} onChange={(e) => setIncomeForm((p) => ({ ...p, happened_on: e.target.value }))} required />
          <input className="input" value={incomeForm.note} onChange={(e) => setIncomeForm((p) => ({ ...p, note: e.target.value }))} placeholder={t('driverFinance.note')} />
          <button type="submit" className="btn primary">{t('driverFinance.saveIncome')}</button>
        </form>

        <form className="card pad-lg driver-finance-form" onSubmit={addExpense}>
          <h2>{t('driverFinance.addExpense')}</h2>
          <input className="input" type="number" step="0.01" min="0" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} placeholder={t('driverFinance.amount')} required />
          <select className="input" value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}>
            {expenseCats.map((c) => <option key={c} value={c}>{t(`driverFinance.expenseCat.${c}`)}</option>)}
          </select>
          <input className="input" type="date" value={expenseForm.happened_on} onChange={(e) => setExpenseForm((p) => ({ ...p, happened_on: e.target.value }))} required />
          <input className="input" value={expenseForm.note} onChange={(e) => setExpenseForm((p) => ({ ...p, note: e.target.value }))} placeholder={t('driverFinance.note')} />
          <button type="submit" className="btn primary">{t('driverFinance.saveExpense')}</button>
        </form>
      </section>

      <section className="card pad-lg driver-finance-calc">
        <h2>{t('driverFinance.calcTitle')}</h2>
        <div className="driver-finance-calc-grid">
          <input className="input" type="number" min="0" step="0.01" value={calcForm.targetNet} onChange={(e) => setCalcForm((p) => ({ ...p, targetNet: e.target.value }))} placeholder={t('driverFinance.calcTargetNet')} />
          <input className="input" type="number" min="0" step="0.01" value={calcForm.expectedExpenses} onChange={(e) => setCalcForm((p) => ({ ...p, expectedExpenses: e.target.value }))} placeholder={t('driverFinance.calcExpenses')} />
          <input className="input" type="number" min="0" max="99" step="0.1" value={calcForm.commissionPct} onChange={(e) => setCalcForm((p) => ({ ...p, commissionPct: e.target.value }))} placeholder={t('driverFinance.calcCommission')} />
        </div>
        <p>
          <strong>{t('driverFinance.calcRequiredGross')}:</strong>{' '}
          {calcRequiredGross == null ? '—' : fmtMoney(calcRequiredGross)}
        </p>
      </section>

      <section className="driver-finance-lists">
        <article className="card pad-lg">
          <h2>{t('driverFinance.latestIncome')}</h2>
          <ul className="driver-finance-list">
            {incomeRows.slice(0, 6).map((r) => (
              <li key={`i-${r.id}`}>
                <span>{String(r.happened_on || '')}</span>
                <span>{t(`driverFinance.incomeCat.${r.category}`)}</span>
                <strong className="stats-money--in">{fmtMoney(r.amount)}</strong>
              </li>
            ))}
            {incomeRows.length === 0 ? <li className="muted small">{t('driverFinance.empty')}</li> : null}
          </ul>
        </article>
        <article className="card pad-lg">
          <h2>{t('driverFinance.latestExpenses')}</h2>
          <ul className="driver-finance-list">
            {expenseRows.slice(0, 6).map((r) => (
              <li key={`e-${r.id}`}>
                <span>{String(r.happened_on || '')}</span>
                <span>{t(`driverFinance.expenseCat.${r.category}`)}</span>
                <strong className="stats-money--out">{fmtMoney(r.amount)}</strong>
              </li>
            ))}
            {expenseRows.length === 0 ? <li className="muted small">{t('driverFinance.empty')}</li> : null}
          </ul>
        </article>
      </section>
    </div>
  )
}
