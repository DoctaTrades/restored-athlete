'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import CoachSidebar from '@/components/CoachSidebar'

interface Athlete {
  id: string
  bodyweight_kg: number | null
  height_cm: number | null
  date_of_birth: string | null
  sex: string | null
  weight_class: string | null
  nutrition_goal: string | null
  target_bodyweight_kg: number | null
  profile: { full_name: string; email: string }
}

interface NutritionTarget {
  id: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  training_calories: number | null
  training_protein_g: number | null
  training_carbs_g: number | null
  training_fat_g: number | null
  rest_calories: number | null
  rest_protein_g: number | null
  rest_carbs_g: number | null
  rest_fat_g: number | null
  cut_rate_pct: number | null
  notes: string | null
  effective_date: string
}

interface WeighIn {
  id: string
  weight_kg: number
  logged_at: string
  time_of_day: string | null
  notes: string | null
}

interface TDEEResult {
  bmr: number
  tdee: number
  adjustedCalories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  training_calories: number
  training_protein_g: number
  training_carbs_g: number
  training_fat_g: number
  rest_calories: number
  rest_protein_g: number
  rest_carbs_g: number
  rest_fat_g: number
  activityMultiplier: number
  goalAdjustment: number
  goalLabel: string
}

const GOAL_LABELS: Record<string, string> = {
  recomp: 'Recomposition',
  bulk: 'Lean Bulk',
  cut: 'Fat Loss / Cut',
  comp_prep: 'Competition Prep'
}

const ACTIVITY_MULTIPLIERS = [
  { label: 'Sedentary', value: 1.2 },
  { label: 'Lightly Active (1-3 days)', value: 1.375 },
  { label: 'Moderately Active (3-5 days)', value: 1.55 },
  { label: 'Very Active (6-7 days)', value: 1.725 },
  { label: 'Extremely Active (2x/day)', value: 1.9 },
]

// Mifflin-St Jeor BMR
function calcBMR(weightKg: number, heightCm: number, ageYears: number, sex: string): number {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears)
  return sex === 'male' ? base + 5 : base - 161
}

function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

function calcTDEE(athlete: Athlete, activityMultiplier: number, cutRatePct: number | null): TDEEResult | null {
  if (!athlete.bodyweight_kg || !athlete.height_cm || !athlete.date_of_birth || !athlete.sex) return null

  const age = calcAge(athlete.date_of_birth)
  const bmr = Math.round(calcBMR(athlete.bodyweight_kg, athlete.height_cm, age, athlete.sex))
  const tdee = Math.round(bmr * activityMultiplier)

  const goal = athlete.nutrition_goal || 'recomp'

  // Goal-based calorie adjustment
  let goalAdjustment = 0
  let goalLabel = ''
  if (goal === 'bulk') {
    goalAdjustment = Math.round(tdee * 0.12)
    goalLabel = '+12% surplus'
  } else if (goal === 'cut') {
    // Use cut rate to determine deficit if provided
    if (cutRatePct && athlete.bodyweight_kg) {
      const weeklyWeightLossKg = athlete.bodyweight_kg * (cutRatePct / 100)
      goalAdjustment = -Math.round((weeklyWeightLossKg * 7700) / 7) // 7700 kcal per kg fat
      goalLabel = `${cutRatePct}% BW/week deficit`
    } else {
      goalAdjustment = -Math.round(tdee * 0.18)
      goalLabel = '-18% deficit'
    }
  } else if (goal === 'comp_prep') {
    goalAdjustment = -Math.round(tdee * 0.10)
    goalLabel = '-10% comp prep'
  } else {
    goalAdjustment = 0
    goalLabel = 'maintenance'
  }

  const adjustedCalories = Math.max(tdee + goalAdjustment, 1200)

  // Macro splits by goal
  const macroSplits: Record<string, { p: number; c: number; f: number }> = {
    recomp: { p: 0.35, c: 0.40, f: 0.25 },
    bulk:   { p: 0.25, c: 0.50, f: 0.25 },
    cut:    { p: 0.40, c: 0.35, f: 0.25 },
    comp_prep: { p: 0.40, c: 0.35, f: 0.25 },
  }
  const split = macroSplits[goal] || macroSplits.recomp

  const protein_g = Math.round((adjustedCalories * split.p) / 4)
  const carbs_g = Math.round((adjustedCalories * split.c) / 4)
  const fat_g = Math.round((adjustedCalories * split.f) / 9)

  // Training day: +15% carbs, rest day: -15% carbs, protein constant
  const training_carb_bonus = Math.round(carbs_g * 0.15)
  const training_calories = adjustedCalories + Math.round(training_carb_bonus * 4)
  const rest_calories = adjustedCalories - Math.round(training_carb_bonus * 4)

  return {
    bmr, tdee, adjustedCalories,
    protein_g, carbs_g, fat_g,
    training_calories,
    training_protein_g: protein_g,
    training_carbs_g: carbs_g + training_carb_bonus,
    training_fat_g: fat_g,
    rest_calories,
    rest_protein_g: protein_g,
    rest_carbs_g: carbs_g - training_carb_bonus,
    rest_fat_g: fat_g,
    activityMultiplier,
    goalAdjustment,
    goalLabel,
  }
}


export default function NutritionPage({ params }: { params: { id: string } }) {
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [targets, setTargets] = useState<NutritionTarget | null>(null)
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [activityMultiplier, setActivityMultiplier] = useState(1.55)
  const [cutRatePct, setCutRatePct] = useState<number | null>(null)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [showWeighInModal, setShowWeighInModal] = useState(false)
  const [showTDEEPanel, setShowTDEEPanel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: athleteData } = await supabase
      .from('ra_athletes')
      .select('*, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
      .eq('id', params.id).maybeSingle()

    const { data: targetData } = await supabase
      .from('ra_nutrition_targets')
      .select('*')
      .eq('athlete_id', params.id)
      .lte('effective_date', today)
      .order('effective_date', { ascending: false })
      .limit(1).maybeSingle()

    const { data: weighInData } = await supabase
      .from('ra_bodyweight_log')
      .select('*')
      .eq('athlete_id', params.id)
      .order('logged_at', { ascending: false })
      .limit(14)

    setAthlete(athleteData as any)
    setTargets(targetData as any)
    setWeighIns((weighInData as any) || [])
    if (targetData?.cut_rate_pct) setCutRatePct(targetData.cut_rate_pct)
    setLoading(false)
  }, [params.id])

  useEffect(() => { load() }, [load])

  // Auto-calculate TDEE
  const tdeeResult = athlete ? calcTDEE(athlete, activityMultiplier, cutRatePct) : null
  const missingFields = athlete ? [
    !athlete.bodyweight_kg && 'bodyweight',
    !athlete.height_cm && 'height',
    !athlete.date_of_birth && 'date of birth',
    !athlete.sex && 'sex',
  ].filter(Boolean) : []

  async function applyTDEE() {
    if (!tdeeResult) return
    setSaving(true)
    const { error } = await supabase.from('ra_nutrition_targets').insert({
      athlete_id: params.id,
      effective_date: format(new Date(), 'yyyy-MM-dd'),
      calories: tdeeResult.adjustedCalories,
      protein_g: tdeeResult.protein_g,
      carbs_g: tdeeResult.carbs_g,
      fat_g: tdeeResult.fat_g,
      training_calories: tdeeResult.training_calories,
      training_protein_g: tdeeResult.training_protein_g,
      training_carbs_g: tdeeResult.training_carbs_g,
      training_fat_g: tdeeResult.training_fat_g,
      rest_calories: tdeeResult.rest_calories,
      rest_protein_g: tdeeResult.rest_protein_g,
      rest_carbs_g: tdeeResult.rest_carbs_g,
      rest_fat_g: tdeeResult.rest_fat_g,
      cut_rate_pct: cutRatePct,
      notes: `Auto-calculated via TDEE (${ACTIVITY_MULTIPLIERS.find(a => a.value === activityMultiplier)?.label}, ${tdeeResult.goalLabel})`
    })
    setSaving(false)
    if (!error) load()
  }

  function getWeeklyStats() {
    if (weighIns.length < 2) return null
    const sorted = [...weighIns].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    const recent = sorted.slice(-7)
    const older = sorted.slice(-14, -7)
    if (!recent.length) return null
    const recentAvg = recent.reduce((s, w) => s + w.weight_kg, 0) / recent.length
    const olderAvg = older.length ? older.reduce((s, w) => s + w.weight_kg, 0) / older.length : null
    const weeklyChange = olderAvg !== null ? recentAvg - olderAvg : null
    const changePct = olderAvg && weeklyChange !== null ? Math.abs(weeklyChange / olderAvg * 100) : null
    return {
      recentAvg: Math.round(recentAvg * 10) / 10,
      olderAvg: olderAvg ? Math.round(olderAvg * 10) / 10 : null,
      weeklyChange: weeklyChange !== null ? Math.round(weeklyChange * 100) / 100 : null,
      changePct: changePct !== null ? Math.round(changePct * 100) / 100 : null,
      isSafe: changePct !== null ? changePct <= 1.0 : true,
      isAtCeiling: changePct !== null ? changePct > 1.5 : false,
    }
  }

  const weeklyStats = getWeeklyStats()
  const athleteName = (athlete as any)?.profile?.full_name || (athlete as any)?.profile?.email || 'Athlete'
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }
  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}><div style={{ marginLeft: '240px', padding: '60px', color: '#94A3B8' }}>Loading...</div></div>

  const activeTargets = targets

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <CoachSidebar active="Nutrition" athleteId={params.id} athleteName={athleteName} />

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
          <a href="/coach/dashboard" style={{ color: '#94A3B8', textDecoration: 'none' }}>Athletes</a>
          {' / '}<span style={{ color: '#94A3B8' }}>{athleteName}</span>
          {' / '}<span style={{ color: '#0F2044', fontWeight: 600 }}>Nutrition</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>{athleteName} — Nutrition</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>
              Goal: {athlete?.nutrition_goal ? GOAL_LABELS[athlete.nutrition_goal] : 'Not set'}
              {activeTargets?.cut_rate_pct ? ` · ${activeTargets.cut_rate_pct}% BW/week` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowOverrideModal(true)} style={{ padding: '9px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
              Manual Override
            </button>
            <button onClick={() => setShowWeighInModal(true)} style={{ padding: '9px 16px', background: '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
              + Log Weight
            </button>
          </div>
        </div>

        {/* Safety alerts */}
        {weeklyStats?.isAtCeiling && (
          <div style={{ padding: '14px 18px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#DC2626' }}>Cut Rate Above Hard Ceiling</div>
              <div style={{ fontSize: '13px', color: '#7F1D1D', marginTop: '2px' }}>{athleteName.split(' ')[0]} is losing {weeklyStats.changePct}% BW/week — above the 1.5% maximum. Increase calories immediately to protect muscle and performance.</div>
            </div>
          </div>
        )}
        {weeklyStats && !weeklyStats.isSafe && !weeklyStats.isAtCeiling && (
          <div style={{ padding: '14px 18px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#D97706' }}>Approaching Safe Limit</div>
              <div style={{ fontSize: '13px', color: '#78350F', marginTop: '2px' }}>{athleteName.split(' ')[0]} is losing {weeklyStats.changePct}% BW/week — over the 1% sustainable rate. Monitor closely.</div>
            </div>
          </div>
        )}

        {/* TDEE Calculator Panel */}
        <div style={{ ...card, marginBottom: '20px' }}>
          <button onClick={() => setShowTDEEPanel(!showTDEEPanel)} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' as const }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>🧮 TDEE Calculator</div>
              {tdeeResult ? (
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  BMR: {tdeeResult.bmr} kcal · TDEE: {tdeeResult.tdee} kcal · Target: <strong style={{ color: '#B8891A' }}>{tdeeResult.adjustedCalories} kcal</strong> ({tdeeResult.goalLabel})
                </div>
              ) : missingFields.length > 0 ? (
                <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '2px' }}>Missing athlete data: {missingFields.join(', ')} — update athlete profile to calculate</div>
              ) : null}
            </div>
            <span style={{ color: '#94A3B8', fontSize: '18px' }}>{showTDEEPanel ? '▲' : '▼'}</span>
          </button>

          {showTDEEPanel && (
            <div style={{ padding: '0 20px 20px', borderTop: '1px solid #F1F5F9' }}>
              {missingFields.length > 0 ? (
                <div style={{ padding: '20px', textAlign: 'center' as const, color: '#94A3B8' }}>
                  <p>Missing required data to calculate TDEE:</p>
                  <p style={{ fontWeight: 600, color: '#DC2626', marginTop: '4px' }}>{missingFields.join(', ')}</p>
                  <p style={{ marginTop: '8px', fontSize: '12px' }}>Update the athlete's profile with these fields.</p>
                </div>
              ) : tdeeResult ? (
                <div style={{ paddingTop: '16px' }}>
                  {/* TDEE breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'BMR', value: `${tdeeResult.bmr} kcal`, sub: 'Base metabolic rate' },
                      { label: 'TDEE', value: `${tdeeResult.tdee} kcal`, sub: `×${activityMultiplier} activity` },
                      { label: 'Adjustment', value: `${tdeeResult.goalAdjustment > 0 ? '+' : ''}${tdeeResult.goalAdjustment} kcal`, sub: tdeeResult.goalLabel },
                      { label: 'Target', value: `${tdeeResult.adjustedCalories} kcal`, sub: 'Daily target', highlight: true },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '14px', background: s.highlight ? 'rgba(184,137,26,0.06)' : '#F8FAFC', border: `1px solid ${s.highlight ? 'rgba(184,137,26,0.2)' : '#E2E8F0'}`, borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>{s.label}</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: s.highlight ? '#B8891A' : '#0F2044' }}>{s.value}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Activity selector */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Activity Level</label>
                    <select value={activityMultiplier} onChange={e => setActivityMultiplier(parseFloat(e.target.value))} style={inp}>
                      {ACTIVITY_MULTIPLIERS.map(a => (
                        <option key={a.value} value={a.value}>{a.label} (×{a.value})</option>
                      ))}
                    </select>
                  </div>

                  {/* Cut rate (only for cut/comp_prep) */}
                  {(athlete?.nutrition_goal === 'cut' || athlete?.nutrition_goal === 'comp_prep') && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Target Cut Rate (% BW/week) — max 1.5%
                      </label>
                      <input type="number" value={cutRatePct || ''} onChange={e => setCutRatePct(parseFloat(e.target.value) || null)}
                        placeholder="e.g. 0.75" step="0.25" min="0.25" max="1.5" style={inp} />
                      {cutRatePct && cutRatePct > 1.5 && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#DC2626', fontWeight: 500 }}>⚠️ Hard ceiling is 1.5% — this risks muscle loss and performance.</div>
                      )}
                      {cutRatePct && cutRatePct > 1.0 && cutRatePct <= 1.5 && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#D97706', fontWeight: 500 }}>⚡ Above 1% is aggressive — monitor weekly weigh-ins closely.</div>
                      )}
                    </div>
                  )}

                  <button onClick={applyTDEE} disabled={saving} style={{ width: '100%', padding: '12px', background: saving ? '#E2E8F0' : '#0F2044', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Applying...' : `Apply ${tdeeResult.adjustedCalories} kcal Targets →`}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Active macro targets */}
        {activeTargets ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {activeTargets.training_calories ? (
              <>
                <MacroCard emoji="🏋️" title="Training Day" calories={activeTargets.training_calories!} protein={activeTargets.training_protein_g!} carbs={activeTargets.training_carbs_g!} fat={activeTargets.training_fat_g!} />
                <MacroCard emoji="😴" title="Rest Day" calories={activeTargets.rest_calories!} protein={activeTargets.rest_protein_g!} carbs={activeTargets.rest_carbs_g!} fat={activeTargets.rest_fat_g!} />
              </>
            ) : (
              <div style={{ gridColumn: '1 / -1' }}>
                <MacroCard emoji="📊" title="Daily Targets" calories={activeTargets.calories!} protein={activeTargets.protein_g!} carbs={activeTargets.carbs_g!} fat={activeTargets.fat_g!} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ ...card, padding: '40px', textAlign: 'center' as const, color: '#94A3B8', marginBottom: '20px' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🥗</div>
            <p style={{ fontWeight: 600, color: '#475569', marginBottom: '8px' }}>No targets set yet</p>
            <button onClick={() => setShowTDEEPanel(true)} style={{ color: '#B8891A', background: 'none', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              Open TDEE Calculator to set targets →
            </button>
          </div>
        )}

        {/* Weigh-in tracker */}
        <div style={{ ...card, marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>Weigh-In Tracker</h2>
            <button onClick={() => setShowWeighInModal(true)} style={{ padding: '7px 14px', background: '#B8891A', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>+ Log Today's Weight</button>
          </div>
          {weighIns.length > 0 ? (
            <div style={{ padding: '20px 24px' }}>
              {/* Bar chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px', marginBottom: '8px' }}>
                {[...weighIns].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()).slice(-10).map((w, idx, arr) => {
                  const weights = arr.map(x => x.weight_kg)
                  const min = Math.min(...weights), max = Math.max(...weights)
                  const range = max - min || 1
                  const heightPct = 30 + ((w.weight_kg - min) / range) * 70
                  return (
                    <div key={w.id} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px' }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>{w.weight_kg}</div>
                      <div style={{ width: '100%', height: `${heightPct}%`, background: idx >= arr.length - 7 ? '#B8891A' : '#CBD5E1', borderRadius: '3px 3px 0 0', minHeight: '8px' }} />
                      <div style={{ fontSize: '9px', color: '#94A3B8' }}>{format(new Date(w.logged_at + 'T12:00:00'), 'M/d')}</div>
                    </div>
                  )
                })}
              </div>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                {[
                  { label: 'Last Wk Avg', value: weeklyStats?.olderAvg ? `${weeklyStats.olderAvg}kg` : '—', color: '#475569' },
                  { label: 'This Wk Avg', value: weeklyStats?.recentAvg ? `${weeklyStats.recentAvg}kg` : '—', color: '#B8891A' },
                  { label: 'Change', value: weeklyStats?.weeklyChange !== null && weeklyStats?.weeklyChange !== undefined ? `${weeklyStats.weeklyChange > 0 ? '+' : ''}${weeklyStats.weeklyChange}kg` : '—', color: weeklyStats?.weeklyChange ? (weeklyStats.weeklyChange > 0 ? '#D97706' : '#16A34A') : '#475569' },
                  { label: 'Rate (%BW)', value: weeklyStats?.changePct ? `${weeklyStats.changePct}%` : '—', color: weeklyStats?.isAtCeiling ? '#DC2626' : weeklyStats?.isSafe === false ? '#D97706' : '#16A34A' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' as const }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px', fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#94A3B8', display: 'flex', gap: '16px' }}>
                <span>{weighIns.length} weigh-ins recorded</span>
                <span style={{ color: '#16A34A' }}>Safe: ≤1% BW/wk</span>
                <span style={{ color: '#DC2626' }}>Ceiling: 1.5% BW/wk</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center' as const, color: '#94A3B8' }}>No weigh-ins logged yet.</div>
          )}
        </div>

        {/* Weigh-in history table */}
        {weighIns.length > 0 && (
          <div style={card}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Weigh-In History</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {['Date', 'Weight', 'Time', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...weighIns].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()).map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '11px 20px', fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>{format(new Date(w.logged_at + 'T12:00:00'), 'MMM d, yyyy')}</td>
                    <td style={{ padding: '11px 20px', fontSize: '15px', fontWeight: 800, color: '#0F2044' }}>{w.weight_kg}kg</td>
                    <td style={{ padding: '11px 20px', fontSize: '12px', color: '#94A3B8' }}>{w.time_of_day?.replace('_', ' ') || '—'}</td>
                    <td style={{ padding: '11px 20px', fontSize: '12px', color: '#94A3B8' }}>{w.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOverrideModal && (
        <ManualOverrideModal
          athleteId={params.id}
          onClose={() => setShowOverrideModal(false)}
          onSaved={() => { setShowOverrideModal(false); load() }}
        />
      )}

      {showWeighInModal && (
        <WeighInModal
          athleteId={params.id}
          onClose={() => setShowWeighInModal(false)}
          onSaved={() => { setShowWeighInModal(false); load() }}
        />
      )}
    </div>
  )
}

function ManualOverrideModal({ athleteId, onClose, onSaved }: { athleteId: string; onClose: () => void; onSaved: () => void }) {
  const [useSplit, setUseSplit] = useState(true)
  const [tCal, setTCal] = useState(''); const [tPro, setTPro] = useState(''); const [tCarb, setTCarb] = useState(''); const [tFat, setTFat] = useState('')
  const [rCal, setRCal] = useState(''); const [rPro, setRPro] = useState(''); const [rCarb, setRCarb] = useState(''); const [rFat, setRFat] = useState('')
  const [cal, setCal] = useState(''); const [pro, setPro] = useState(''); const [carb, setCarb] = useState(''); const [fat, setFat] = useState('')
  const [cutRate, setCutRate] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function save() {
    setSaving(true)
    const payload: any = { athlete_id: athleteId, effective_date: format(new Date(), 'yyyy-MM-dd'), cut_rate_pct: cutRate ? parseFloat(cutRate) : null, notes: notes || null }
    if (useSplit) {
      payload.training_calories = parseInt(tCal) || null; payload.training_protein_g = parseInt(tPro) || null; payload.training_carbs_g = parseInt(tCarb) || null; payload.training_fat_g = parseInt(tFat) || null
      payload.rest_calories = parseInt(rCal) || null; payload.rest_protein_g = parseInt(rPro) || null; payload.rest_carbs_g = parseInt(rCarb) || null; payload.rest_fat_g = parseInt(rFat) || null
    } else {
      payload.calories = parseInt(cal) || null; payload.protein_g = parseInt(pro) || null; payload.carbs_g = parseInt(carb) || null; payload.fat_g = parseInt(fat) || null
    }
    const { error } = await supabase.from('ra_nutrition_targets').insert(payload)
    if (error) { setError(error.message); setSaving(false) } else { onSaved() }
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '11px', fontWeight: 600 as const, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(15,32,68,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', position: 'sticky' as const, top: 0, background: '#FFFFFF' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F2044' }}>Manual Override</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
              <input type="checkbox" checked={useSplit} onChange={e => setUseSplit(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
              <div style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: useSplit ? '#B8891A' : '#CBD5E1', borderRadius: '12px', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', height: '18px', width: '18px', left: useSplit ? '23px' : '3px', bottom: '3px', background: '#FFFFFF', borderRadius: '50%', transition: 'left 0.2s' }} />
              </div>
            </label>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>Training / Rest Day Split</span>
          </div>
          {useSplit ? (
            <>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044', marginBottom: '10px' }}>🏋️ Training Day</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  {[['Calories', tCal, setTCal, '3200'], ['Protein (g)', tPro, setTPro, '200'], ['Carbs (g)', tCarb, setTCarb, '380'], ['Fat (g)', tFat, setTFat, '90']].map(([l, v, s, p]) => (
                    <div key={l as string}><label style={lbl}>{l as string}</label><input type="number" value={v as string} onChange={e => (s as any)(e.target.value)} placeholder={p as string} style={inp} /></div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044', marginBottom: '10px' }}>😴 Rest Day</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  {[['Calories', rCal, setRCal, '2800'], ['Protein (g)', rPro, setRPro, '200'], ['Carbs (g)', rCarb, setRCarb, '290'], ['Fat (g)', rFat, setRFat, '90']].map(([l, v, s, p]) => (
                    <div key={l as string}><label style={lbl}>{l as string}</label><input type="number" value={v as string} onChange={e => (s as any)(e.target.value)} placeholder={p as string} style={inp} /></div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044', marginBottom: '10px' }}>Daily Targets</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                {[['Calories', cal, setCal, '3000'], ['Protein (g)', pro, setPro, '200'], ['Carbs (g)', carb, setCarb, '335'], ['Fat (g)', fat, setFat, '90']].map(([l, v, s, p]) => (
                  <div key={l as string}><label style={lbl}>{l as string}</label><input type="number" value={v as string} onChange={e => (s as any)(e.target.value)} placeholder={p as string} style={inp} /></div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label style={lbl}>Target Cut Rate % BW/week (optional)</label>
            <input type="number" value={cutRate} onChange={e => setCutRate(e.target.value)} placeholder="e.g. 0.75" step="0.25" min="0" max="1.5" style={inp} />
          </div>
          <div><label style={lbl}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context for these targets..." rows={2} style={{ ...inp, resize: 'vertical' as const }} /></div>
          {error && <div style={{ padding: '10px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Targets →'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WeighInModal({ athleteId, onClose, onSaved }: { athleteId: string; onClose: () => void; onSaved: () => void }) {
  const [weight, setWeight] = useState(''); const [timeOfDay, setTimeOfDay] = useState('morning'); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  async function save() {
    if (!weight) { setError('Weight is required'); return }
    setSaving(true)
    const { error } = await supabase.from('ra_bodyweight_log').insert({ athlete_id: athleteId, weight_kg: parseFloat(weight), logged_at: format(new Date(), 'yyyy-MM-dd'), time_of_day: timeOfDay, notes: notes || null })
    if (error) { setError(error.message); setSaving(false) } else { onSaved() }
  }
  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '11px', fontWeight: 600 as const, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '380px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(15,32,68,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between' }}>
          <div><h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F2044' }}>Log Weigh-In</h2><p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>{format(new Date(), 'MMMM d, yyyy')}</p></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
          <div><label style={lbl}>Weight (kg)</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 84.5" step="0.1" style={{ ...inp, fontSize: '20px', fontWeight: 700 }} autoFocus /></div>
          <div><label style={lbl}>Time of Day</label>
            <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} style={inp}>
              <option value="morning">Morning (fasted)</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="post_weigh_in">Post Weigh-In (competition)</option>
            </select>
          </div>
          <div><label style={lbl}>Notes (optional)</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. After hard week" style={inp} /></div>
          {error && <div style={{ padding: '10px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Log Weight →'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
