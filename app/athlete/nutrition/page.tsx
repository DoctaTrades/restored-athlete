'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, subDays, startOfWeek, differenceInDays } from 'date-fns'
import AthleteNav from '@/components/AthleteNav'
import { getCurrentPhase, getNextPhaseStart, PHASE_INFO } from '@/lib/cycleUtils'
import { buildWeeklyAverages, analyzeWeightTrend, applyCalorieAdjustment } from '@/lib/macroAdjustment'

interface NutritionTarget {
  id: string; calories: number | null; protein_g: number | null
  carbs_g: number | null; fat_g: number | null
  training_calories: number | null; training_protein_g: number | null
  training_carbs_g: number | null; training_fat_g: number | null
  rest_calories: number | null; rest_protein_g: number | null
  rest_carbs_g: number | null; rest_fat_g: number | null
  cut_rate_pct: number | null; notes: string | null; effective_date: string
  goal_date: string | null; start_weight_kg: number | null; start_date: string | null
}

interface MacroSuggestion {
  id: string; suggested_calories: number; suggested_protein_g: number
  suggested_carbs_g: number; suggested_fat_g: number
  suggested_training_calories: number | null; suggested_training_carbs_g: number | null
  suggested_rest_calories: number | null; suggested_rest_carbs_g: number | null
  reason: string; actual_rate_pct: number | null; target_rate_pct: number | null
  status: string; created_at: string
}

interface WeighIn { id: string; weight_kg: number; logged_at: string; time_of_day: string | null; notes: string | null }

const GOAL_LABELS: Record<string, string> = {
  recomp: 'Recomposition', bulk: 'Lean Bulk', cut: 'Fat Loss / Cut', comp_prep: 'Competition Prep'
}

const ACTIVITY_MULTIPLIERS = [
  { label: 'Sedentary', value: 1.2 },
  { label: 'Lightly Active (1-3 days)', value: 1.375 },
  { label: 'Moderately Active (3-5 days)', value: 1.55 },
  { label: 'Very Active (6-7 days)', value: 1.725 },
  { label: 'Extremely Active (2x/day)', value: 1.9 },
]

function calcBMR(weightKg: number, heightCm: number, ageYears: number, sex: string): number {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears)
  return sex === 'male' ? base + 5 : base - 161
}

function calcAge(dob: string): number {
  const today = new Date(), birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

function MacroCard({ emoji, title, calories, protein, carbs, fat }: { emoji: string; title: string; calories: number; protein: number; carbs: number; fat: number }) {
  const proteinPct = Math.round(protein * 4 / calories * 100)
  const carbsPct = Math.round(carbs * 4 / calories * 100)
  const fatPct = Math.round(fat * 9 / calories * 100)
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{emoji}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044', marginBottom: '12px' }}>{title}</div>
      <div style={{ fontSize: '32px', fontWeight: 800, color: '#0F2044' }}>{calories} <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: 500 }}>kcal</span></div>
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
        {[
          { label: 'Protein', g: protein, pct: proteinPct, color: '#0F2044' },
          { label: 'Carbs', g: carbs, pct: carbsPct, color: '#B8891A' },
          { label: 'Fat', g: fat, pct: fatPct, color: '#3B82F6' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{m.label}</span>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>{m.g}g · {m.pct}%</span>
            </div>
            <div style={{ height: '5px', background: '#F1F5F9', borderRadius: '3px' }}>
              <div style={{ width: `${Math.min(m.pct, 100)}%`, height: '100%', background: m.color, borderRadius: '3px' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '11px', color: '#94A3B8' }}>
        Per meal (3): <span style={{ color: '#0F2044', fontWeight: 600 }}>P{Math.round(protein/3)}g</span> · <span style={{ color: '#B8891A', fontWeight: 600 }}>C{Math.round(carbs/3)}g</span> · <span style={{ color: '#3B82F6', fontWeight: 600 }}>F{Math.round(fat/3)}g</span>
      </div>
    </div>
  )
}

export default function AthleteNutritionPage() {
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [athlete, setAthlete] = useState<any>(null)
  const [athleteName, setAthleteName] = useState('')
  const [targets, setTargets] = useState<NutritionTarget | null>(null)
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [macroSuggestion, setMacroSuggestion] = useState<MacroSuggestion | null>(null)
  const [mealPrefs, setMealPrefs] = useState({ meals_per_day: 3, post_workout_meal: 2 })
  const [isTrainingDay, setIsTrainingDay] = useState(true)
  const [activityMultiplier, setActivityMultiplier] = useState(1.55)
  const [cutRatePct, setCutRatePct] = useState<number | null>(null)
  const [goalDate, setGoalDate] = useState('')
  const [showTDEE, setShowTDEE] = useState(false)
  const [showWeighIn, setShowWeighIn] = useState(false)
  const [showCycleSettings, setShowCycleSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profileData } = await supabase.from('ra_profiles').select('full_name, email').eq('id', user.id).maybeSingle()
    const { data: athleteData } = await supabase.from('ra_athletes').select('*').eq('profile_id', user.id).maybeSingle()
    if (!athleteData) { setLoading(false); return }

    setAthleteId(athleteData.id)
    setAthlete(athleteData)
    setAthleteName((profileData as any)?.full_name || (profileData as any)?.email || 'Athlete')

    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: targetData } = await supabase.from('ra_nutrition_targets').select('*')
      .eq('athlete_id', athleteData.id).lte('effective_date', today)
      .order('effective_date', { ascending: false }).limit(1).maybeSingle()

    const { data: weighInData } = await supabase.from('ra_bodyweight_log').select('*')
      .eq('athlete_id', athleteData.id).order('logged_at', { ascending: false }).limit(20)

    const { data: prefData } = await supabase.from('ra_meal_preferences').select('*')
      .eq('athlete_id', athleteData.id).maybeSingle()

    const { data: suggestionData } = await supabase.from('ra_macro_suggestions').select('*')
      .eq('athlete_id', athleteData.id).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    setTargets(targetData as any)
    setWeighIns((weighInData as any) || [])
    if (prefData) setMealPrefs({ meals_per_day: prefData.meals_per_day, post_workout_meal: prefData.post_workout_meal })
    if (targetData?.cut_rate_pct) setCutRatePct(targetData.cut_rate_pct)
    if (targetData?.goal_date) setGoalDate(targetData.goal_date)
    setMacroSuggestion(suggestionData as any)

    // Run adjustment check
    if (athleteData && targetData && weighInData?.length >= 3) {
      await checkAndCreateSuggestion(athleteData, targetData, weighInData)
    }

    setLoading(false)
  }, [])

  async function checkAndCreateSuggestion(athleteData: any, targetData: any, weighInData: any[]) {
    // Don't create if one already pending
    const { data: existing } = await supabase.from('ra_macro_suggestions')
      .select('id').eq('athlete_id', athleteData.id).eq('status', 'pending').limit(1)
    if (existing?.length) return

    const weeklyData = buildWeeklyAverages(
      weighInData,
      athleteData.cycle_tracking_enabled || false
    )

    const result = analyzeWeightTrend(
      weeklyData,
      athleteData.nutrition_goal || 'recomp',
      targetData.cut_rate_pct,
      targetData.calories || targetData.training_calories || 2000,
      athleteData.bodyweight_kg || 80
    )

    if (!result.shouldSuggest) return

    const currentCals = targetData.calories || targetData.training_calories || 2000
    const currentProtein = targetData.protein_g || targetData.training_protein_g || 150
    const currentCarbs = targetData.carbs_g || targetData.training_carbs_g || 200
    const currentFat = targetData.fat_g || targetData.training_fat_g || 70

    const adjusted = applyCalorieAdjustment(currentCals, currentProtein, currentCarbs, currentFat, result.calorieChange)

    // Calculate training/rest adjustments
    let suggestedTrainingCals = null, suggestedTrainingCarbs = null
    let suggestedRestCals = null, suggestedRestCarbs = null

    if (targetData.training_calories && targetData.rest_calories) {
      const trainAdj = applyCalorieAdjustment(targetData.training_calories, targetData.training_protein_g, targetData.training_carbs_g, targetData.training_fat_g, result.calorieChange)
      const restAdj = applyCalorieAdjustment(targetData.rest_calories, targetData.rest_protein_g, targetData.rest_carbs_g, targetData.rest_fat_g, Math.round(result.calorieChange * 0.5))
      suggestedTrainingCals = trainAdj.calories
      suggestedTrainingCarbs = trainAdj.carbs_g
      suggestedRestCals = restAdj.calories
      suggestedRestCarbs = restAdj.carbs_g
    }

    await supabase.from('ra_macro_suggestions').insert({
      athlete_id: athleteData.id,
      current_target_id: targetData.id,
      suggested_calories: adjusted.calories,
      suggested_protein_g: adjusted.protein_g,
      suggested_carbs_g: adjusted.carbs_g,
      suggested_fat_g: adjusted.fat_g,
      suggested_training_calories: suggestedTrainingCals,
      suggested_training_carbs_g: suggestedTrainingCarbs,
      suggested_rest_calories: suggestedRestCals,
      suggested_rest_carbs_g: suggestedRestCarbs,
      reason: result.reason,
      actual_rate_pct: result.actualRatePct,
      target_rate_pct: result.targetRatePct,
      status: 'pending'
    })
  }

  useEffect(() => { load() }, [load])

  async function acceptSuggestion() {
    if (!macroSuggestion || !athleteId || !targets) return
    setSaving(true)

    await supabase.from('ra_nutrition_targets').insert({
      athlete_id: athleteId,
      effective_date: format(new Date(), 'yyyy-MM-dd'),
      calories: macroSuggestion.suggested_calories,
      protein_g: macroSuggestion.suggested_protein_g,
      carbs_g: macroSuggestion.suggested_carbs_g,
      fat_g: macroSuggestion.suggested_fat_g,
      training_calories: macroSuggestion.suggested_training_calories || targets.training_calories,
      training_protein_g: targets.training_protein_g,
      training_carbs_g: macroSuggestion.suggested_training_carbs_g || targets.training_carbs_g,
      training_fat_g: targets.training_fat_g,
      rest_calories: macroSuggestion.suggested_rest_calories || targets.rest_calories,
      rest_protein_g: targets.rest_protein_g,
      rest_carbs_g: macroSuggestion.suggested_rest_carbs_g || targets.rest_carbs_g,
      rest_fat_g: targets.rest_fat_g,
      cut_rate_pct: targets.cut_rate_pct,
      auto_adjusted: true,
      adjustment_reason: macroSuggestion.reason,
    })

    await supabase.from('ra_macro_suggestions')
      .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
      .eq('id', macroSuggestion.id)

    setSaving(false)
    load()
  }

  async function declineSuggestion() {
    if (!macroSuggestion) return
    await supabase.from('ra_macro_suggestions')
      .update({ status: 'declined', reviewed_at: new Date().toISOString() })
      .eq('id', macroSuggestion.id)
    setMacroSuggestion(null)
  }

  // Cycle phase
  const cyclePhase = athlete?.sex === 'female' && athlete?.cycle_tracking_enabled && athlete?.last_period_start
    ? getCurrentPhase(new Date(athlete.last_period_start), athlete.cycle_length_days || 28)
    : null

  // Apply cycle carb modifier to active macros
  function getActiveMacros() {
    if (!targets) return null
    let base = isTrainingDay && targets.training_calories
      ? { calories: targets.training_calories, protein_g: targets.training_protein_g!, carbs_g: targets.training_carbs_g!, fat_g: targets.training_fat_g! }
      : !isTrainingDay && targets.rest_calories
      ? { calories: targets.rest_calories, protein_g: targets.rest_protein_g!, carbs_g: targets.rest_carbs_g!, fat_g: targets.rest_fat_g! }
      : targets.calories
      ? { calories: targets.calories, protein_g: targets.protein_g!, carbs_g: targets.carbs_g!, fat_g: targets.fat_g! }
      : null
    if (!base || !cyclePhase) return base
    // Apply cycle carb modifier
    const modifier = cyclePhase.carbModifier
    const extraCarbs = Math.round(base.carbs_g * (modifier - 1))
    return { ...base, carbs_g: base.carbs_g + extraCarbs, calories: base.calories + extraCarbs * 4 }
  }

  // Meal distribution
  function distributeMeals(totalProtein: number, totalCarbs: number, totalFat: number, mealsPerDay: number, postWorkoutMeal: number) {
    const secondAfter = postWorkoutMeal < mealsPerDay ? postWorkoutMeal + 1 : null
    const carbDist = new Array(mealsPerDay).fill(0)
    const fatDist = new Array(mealsPerDay).fill(0)
    const pwIdx = postWorkoutMeal - 1
    const s2Idx = secondAfter ? secondAfter - 1 : null

    if (mealsPerDay === 1) { carbDist[0] = 1; fatDist[0] = 1 }
    else {
      carbDist[pwIdx] = 0.35
      if (s2Idx !== null) carbDist[s2Idx] = 0.25
      const remCarb = s2Idx !== null ? 0.40 : 0.65
      const otherCount = s2Idx !== null ? mealsPerDay - 2 : mealsPerDay - 1
      for (let i = 0; i < mealsPerDay; i++) if (i !== pwIdx && i !== s2Idx) carbDist[i] = remCarb / otherCount

      fatDist[pwIdx] = 0.10
      if (s2Idx !== null) fatDist[s2Idx] = 0.15
      const remFat = s2Idx !== null ? 0.75 : 0.90
      const otherFatCount = s2Idx !== null ? mealsPerDay - 2 : mealsPerDay - 1
      for (let i = 0; i < mealsPerDay; i++) if (i !== pwIdx && i !== s2Idx) fatDist[i] = remFat / otherFatCount
    }

    return Array.from({ length: mealsPerDay }, (_, i) => {
      const protein = Math.round(totalProtein / mealsPerDay)
      const carbs = Math.round(totalCarbs * carbDist[i])
      const fat = Math.round(totalFat * fatDist[i])
      return {
        number: i + 1,
        isPostWorkout: i === pwIdx,
        isSecondAfter: i === s2Idx,
        calories: Math.round(protein * 4 + carbs * 4 + fat * 9),
        protein_g: protein, carbs_g: carbs, fat_g: fat,
      }
    })
  }

  // Weekly stats
  function getWeeklyStats() {
    if (weighIns.length < 2) return null
    const sorted = [...weighIns].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    const recent = sorted.slice(-7), older = sorted.slice(-14, -7)
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
      isAtCeiling: changePct !== null ? changePct > 1.5 : false,
      isFast: changePct !== null ? changePct > 1.0 : false,
    }
  }

  const activeMacros = getActiveMacros()
  const weeklyStats = getWeeklyStats()
  const meals = activeMacros ? distributeMeals(activeMacros.protein_g, activeMacros.carbs_g, activeMacros.fat_g, mealPrefs.meals_per_day, mealPrefs.post_workout_meal) : []
  const [mealView, setMealView] = useState<'table' | 'timeline'>('table')
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }
  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties

  if (loading) return <div style={{ minHeight: '100vh', background: '#F4F6F9' }}><AthleteNav active="nutrition" athleteName="" /><div style={{ padding: '60px', textAlign: 'center' as const, color: '#94A3B8' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <AthleteNav active="nutrition" athleteName={athleteName} />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F2044' }}>My Nutrition</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>
              {format(new Date(), 'EEEE, MMMM d')} · {athlete?.nutrition_goal ? GOAL_LABELS[athlete.nutrition_goal] : 'Goal not set'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Cycle phase badge */}
            {cyclePhase && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cyclePhase.dotColor }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>{cyclePhase.label}</span>
              </div>
            )}
            <button onClick={() => setShowWeighIn(true)} style={{ padding: '8px 14px', background: '#B8891A', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>+ Log Weight</button>
          </div>
        </div>

        {/* Cycle phase context */}
        {cyclePhase && (
          <div style={{ padding: '12px 16px', background: `${cyclePhase.dotColor}15`, border: `1px solid ${cyclePhase.dotColor}40`, borderRadius: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cyclePhase.dotColor, marginTop: '5px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044', marginBottom: '2px' }}>
                  {cyclePhase.label} — Training: <span style={{ color: cyclePhase.color }}>{cyclePhase.trainingNote.split('.')[0]}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>{cyclePhase.nutritionNote}</div>
                {!cyclePhase.weightReliable && (
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', fontStyle: 'italic' }}>
                    ⚠️ Weight readings this week may reflect hormonal water retention — macro suggestions are paused.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Macro suggestion banner */}
        {macroSuggestion && (!cyclePhase || cyclePhase.weightReliable) && (
          <div style={{ padding: '16px 18px', background: 'rgba(15,32,68,0.04)', border: '2px solid #0F2044', borderRadius: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044', marginBottom: '6px' }}>📊 Suggested Macro Adjustment</div>
            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>{macroSuggestion.reason}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '10px 14px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' as const }}>Current</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F2044' }}>{targets?.calories || targets?.training_calories} kcal</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>P{targets?.protein_g || targets?.training_protein_g}g · C{targets?.carbs_g || targets?.training_carbs_g}g · F{targets?.fat_g || targets?.training_fat_g}g</div>
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(184,137,26,0.06)', borderRadius: '8px', border: '1px solid rgba(184,137,26,0.2)' }}>
                <div style={{ fontSize: '11px', color: '#B8891A', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' as const }}>Suggested</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#B8891A' }}>{macroSuggestion.suggested_calories} kcal</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>P{macroSuggestion.suggested_protein_g}g · C{macroSuggestion.suggested_carbs_g}g · F{macroSuggestion.suggested_fat_g}g</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={acceptSuggestion} disabled={saving} style={{ flex: 2, padding: '10px', background: '#0F2044', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
                {saving ? 'Applying...' : '✓ Accept & Apply'}
              </button>
              <button onClick={declineSuggestion} style={{ flex: 1, padding: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                Not Now
              </button>
            </div>
          </div>
        )}

        {/* Safety alerts */}
        {weeklyStats?.isAtCeiling && (
          <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '10px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#DC2626' }}>⚠️ Weight Loss Rate Too Aggressive</div>
            <div style={{ fontSize: '12px', color: '#7F1D1D', marginTop: '2px' }}>You're losing {weeklyStats.changePct}% BW/week — above the 1.5% maximum. Increase calories to protect muscle.</div>
          </div>
        )}

        {/* Day toggle */}
        <div style={{ ...card, padding: '14px 18px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>Today is a...</div>
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
            {[{ label: '🏋️ Training Day', value: true }, { label: '😴 Rest Day', value: false }].map(opt => (
              <button key={opt.label} onClick={() => setIsTrainingDay(opt.value)} style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: isTrainingDay === opt.value ? '#FFFFFF' : 'transparent', color: isTrainingDay === opt.value ? '#0F2044' : '#94A3B8', boxShadow: isTrainingDay === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active macros */}
        {!targets ? (
          <div style={{ ...card, padding: '40px', textAlign: 'center' as const, color: '#94A3B8', marginBottom: '16px' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🥗</div>
            <p style={{ fontWeight: 600, color: '#475569', marginBottom: '8px' }}>No targets set yet</p>
            <button onClick={() => setShowTDEE(true)} style={{ color: '#B8891A', background: 'none', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Open TDEE Calculator →</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: targets.training_calories ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '16px' }}>
            {activeMacros && (
              targets.training_calories ? (
                isTrainingDay
                  ? <MacroCard emoji="🏋️" title={cyclePhase ? `Training Day (${cyclePhase.label} carb adjusted)` : 'Training Day'} calories={activeMacros.calories} protein={activeMacros.protein_g} carbs={activeMacros.carbs_g} fat={activeMacros.fat_g} />
                  : <MacroCard emoji="😴" title="Rest Day" calories={activeMacros.calories} protein={activeMacros.protein_g} carbs={activeMacros.carbs_g} fat={activeMacros.fat_g} />
              ) : (
                <MacroCard emoji="📊" title={cyclePhase ? `Daily (${cyclePhase.label} adjusted)` : 'Daily Targets'} calories={activeMacros.calories} protein={activeMacros.protein_g} carbs={activeMacros.carbs_g} fat={activeMacros.fat_g} />
              )
            )}
          </div>
        )}

        {/* Meal settings */}
        <div style={{ ...card, marginBottom: '16px' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Meal Settings</div>
            <button onClick={async () => {
              if (!athleteId) return
              await supabase.from('ra_meal_preferences').upsert({ athlete_id: athleteId, meals_per_day: mealPrefs.meals_per_day, post_workout_meal: Math.min(mealPrefs.post_workout_meal, mealPrefs.meals_per_day), updated_at: new Date().toISOString() }, { onConflict: 'athlete_id' })
            }} style={{ padding: '6px 14px', background: '#B8891A', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>Save</button>
          </div>
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px' }}>Meals Per Day</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => setMealPrefs(p => ({ ...p, meals_per_day: n, post_workout_meal: Math.min(p.post_workout_meal, n) }))}
                    style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid', fontSize: '14px', fontWeight: 700, cursor: 'pointer', borderColor: mealPrefs.meals_per_day === n ? '#B8891A' : '#E2E8F0', background: mealPrefs.meals_per_day === n ? 'rgba(184,137,26,0.08)' : '#FFFFFF', color: mealPrefs.meals_per_day === n ? '#B8891A' : '#94A3B8' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px' }}>Post-Workout Meal #</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {Array.from({ length: mealPrefs.meals_per_day }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setMealPrefs(p => ({ ...p, post_workout_meal: n }))}
                    style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid', fontSize: '14px', fontWeight: 700, cursor: 'pointer', borderColor: mealPrefs.post_workout_meal === n ? '#0F2044' : '#E2E8F0', background: mealPrefs.post_workout_meal === n ? '#0F2044' : '#FFFFFF', color: mealPrefs.post_workout_meal === n ? '#FFFFFF' : '#94A3B8' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Meal breakdown */}
        {meals.length > 0 && activeMacros && (
          <div style={{ ...card, marginBottom: '16px' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Meal Breakdown</div>
              <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '6px', padding: '2px' }}>
                {[{ label: 'Table', value: 'table' }, { label: 'Timeline', value: 'timeline' }].map(v => (
                  <button key={v.value} onClick={() => setMealView(v.value as any)} style={{ padding: '5px 12px', borderRadius: '4px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: mealView === v.value ? '#FFFFFF' : 'transparent', color: mealView === v.value ? '#0F2044' : '#94A3B8', boxShadow: mealView === v.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {mealView === 'table' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {['Meal', 'Calories', 'Protein', 'Carbs', 'Fat'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Meal' ? 'left' as const : 'center' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {meals.map((meal, idx) => (
                    <tr key={meal.number} style={{ borderBottom: idx < meals.length - 1 ? '1px solid #F9FAFB' : 'none', background: meal.isPostWorkout ? 'rgba(15,32,68,0.02)' : 'transparent' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: meal.isPostWorkout ? '#0F2044' : meal.isSecondAfter ? '#B8891A' : '#E2E8F0', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044' }}>
                              Meal {meal.number}{meal.isPostWorkout ? ' — Post-Workout' : meal.isSecondAfter ? ' — 2nd After' : ''}
                            </div>
                            {meal.isPostWorkout && <div style={{ fontSize: '11px', color: '#94A3B8' }}>Highest carbs — replenish glycogen</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' as const, fontSize: '13px', fontWeight: 700 }}>{meal.calories}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' as const, fontSize: '13px', fontWeight: 700, color: '#0F2044' }}>{meal.protein_g}g</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' as const }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#B8891A' }}>{meal.carbs_g}g</span>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>{Math.round(meal.carbs_g / activeMacros.carbs_g * 100)}%</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' as const, fontSize: '13px', fontWeight: 700, color: '#3B82F6' }}>{meal.fat_g}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: '4px', height: '48px', alignItems: 'flex-end', marginBottom: '16px' }}>
                  {meals.map(meal => {
                    const pct = Math.round(meal.carbs_g / activeMacros.carbs_g * 100)
                    return (
                      <div key={meal.number} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '3px' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>{pct}%</div>
                        <div style={{ width: '100%', background: meal.isPostWorkout ? '#0F2044' : meal.isSecondAfter ? '#B8891A' : '#CBD5E1', borderRadius: '3px 3px 0 0', minHeight: '8px', height: `${Math.max(pct, 8)}%`, maxHeight: '36px' }} />
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                  {meals.map(meal => (
                    <div key={meal.number} style={{ padding: '12px 14px', borderRadius: '10px', background: meal.isPostWorkout ? '#0F2044' : 'rgba(15,32,68,0.03)', border: `1px solid ${meal.isPostWorkout ? '#0F2044' : '#E2E8F0'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: meal.isPostWorkout ? '#FFFFFF' : '#0F2044' }}>Meal {meal.number}{meal.isPostWorkout ? ' ⚡ PWO' : ''}</span>
                        <span style={{ fontSize: '12px', color: meal.isPostWorkout ? 'rgba(255,255,255,0.6)' : '#94A3B8' }}>{meal.calories} kcal</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' as const }}>
                        {[{ label: 'Protein', g: meal.protein_g, color: meal.isPostWorkout ? 'rgba(255,255,255,0.8)' : '#0F2044' }, { label: 'Carbs', g: meal.carbs_g, color: meal.isPostWorkout ? '#E0AE35' : '#B8891A' }, { label: 'Fat', g: meal.fat_g, color: meal.isPostWorkout ? 'rgba(255,255,255,0.5)' : '#3B82F6' }].map(m => (
                          <div key={m.label}>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: m.color }}>{m.g}g</div>
                            <div style={{ fontSize: '10px', color: meal.isPostWorkout ? 'rgba(255,255,255,0.4)' : '#94A3B8' }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weigh-in tracker */}
        <div style={{ ...card, marginBottom: '16px' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Weigh-In Tracker</h2>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Log 1–3x/week for best results</span>
          </div>
          {weighIns.length > 0 ? (
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '72px', marginBottom: '6px' }}>
                {[...weighIns].sort((a,b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()).slice(-10).map((w, idx, arr) => {
                  const weights = arr.map(x => x.weight_kg)
                  const min = Math.min(...weights), max = Math.max(...weights), range = max - min || 1
                  const h = 30 + ((w.weight_kg - min) / range) * 70
                  return (
                    <div key={w.id} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '3px' }}>
                      <div style={{ fontSize: '9px', color: '#94A3B8' }}>{w.weight_kg}</div>
                      <div style={{ width: '100%', height: `${h}%`, background: idx >= arr.length - 7 ? '#B8891A' : '#CBD5E1', borderRadius: '3px 3px 0 0', minHeight: '6px' }} />
                      <div style={{ fontSize: '9px', color: '#94A3B8' }}>{format(new Date(w.logged_at + 'T12:00:00'), 'M/d')}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                {[
                  { label: 'Last Wk', value: weeklyStats?.olderAvg ? `${weeklyStats.olderAvg}kg` : '—', color: '#475569' },
                  { label: 'This Wk', value: weeklyStats?.recentAvg ? `${weeklyStats.recentAvg}kg` : '—', color: '#B8891A' },
                  { label: 'Change', value: weeklyStats?.weeklyChange !== null && weeklyStats?.weeklyChange !== undefined ? `${weeklyStats.weeklyChange > 0 ? '+' : ''}${weeklyStats.weeklyChange}kg` : '—', color: weeklyStats?.weeklyChange ? (weeklyStats.weeklyChange > 0 ? '#D97706' : '#16A34A') : '#475569' },
                  { label: '% BW/wk', value: weeklyStats?.changePct ? `${weeklyStats.changePct}%` : '—', color: weeklyStats?.isAtCeiling ? '#DC2626' : weeklyStats?.isFast ? '#D97706' : '#16A34A' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' as const }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '3px', fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center' as const, color: '#94A3B8' }}>
              <button onClick={() => setShowWeighIn(true)} style={{ color: '#B8891A', background: 'none', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Log your first weigh-in →</button>
            </div>
          )}
        </div>

        {/* Daily check-in */}
        <DailyCheckIn athleteId={athleteId!} />

        {/* Cycle tracking toggle — female athletes only */}
        {athlete?.sex === 'female' && <div style={{ ...card, marginBottom: '16px' }}>
          <button onClick={() => setShowCycleSettings(!showCycleSettings)} style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Cycle-Aware Training</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                {athlete?.cycle_tracking_enabled ? `Enabled · ${cyclePhase?.label || ''}` : 'Optional — enables phase-based training and nutrition guidance'}
              </div>
            </div>
            <span style={{ color: '#94A3B8' }}>{showCycleSettings ? '▲' : '▼'}</span>
          </button>
          {showCycleSettings && (
            <div style={{ padding: '0 18px 18px', borderTop: '1px solid #F1F5F9' }}>
              <CycleSettings athlete={athlete} onSaved={load} />
            </div>
          )}
        </div>}
      </div>

      {/* Weigh-in modal */}
      {showWeighIn && <WeighInModal athleteId={athleteId!} onClose={() => setShowWeighIn(false)} onSaved={() => { setShowWeighIn(false); load() }} />}
    </div>
  )
}

function CycleSettings({ athlete, onSaved }: { athlete: any; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(athlete?.cycle_tracking_enabled || false)
  const [cycleLength, setCycleLength] = useState(athlete?.cycle_length_days?.toString() || '28')
  const [lastPeriod, setLastPeriod] = useState(athlete?.last_period_start || '')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function save() {
    setSaving(true)
    await supabase.from('ra_athletes').update({
      cycle_tracking_enabled: enabled,
      cycle_length_days: parseInt(cycleLength) || 28,
      last_period_start: lastPeriod || null,
    }).eq('id', athlete.id)
    setSaving(false)
    onSaved()
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties

  return (
    <div style={{ paddingTop: '14px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
        <div style={{ position: 'relative' as const, display: 'inline-block', width: '44px', height: '24px' }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
          <div style={{ position: 'absolute', inset: 0, background: enabled ? '#B8891A' : '#CBD5E1', borderRadius: '12px', transition: 'background 0.2s', cursor: 'pointer' }}>
            <div style={{ position: 'absolute', height: '18px', width: '18px', left: enabled ? '23px' : '3px', bottom: '3px', background: '#FFFFFF', borderRadius: '50%', transition: 'left 0.2s' }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>Enable cycle-aware guidance</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>Adjusts carb recommendations and weight analysis by phase</div>
        </div>
      </label>

      {enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Cycle Length (days)</label>
            <input type="number" value={cycleLength} onChange={e => setCycleLength(e.target.value)} min="21" max="35" style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Last Period Start</label>
            <input type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} style={inp} />
          </div>
        </div>
      )}

      {enabled && (
        <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Phase guide:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {[
              { phase: 'W1', color: '#DC2626', note: 'Recovery priority · weight may fluctuate' },
              { phase: 'W2', color: '#16A34A', note: 'Peak performance · best for PRs' },
              { phase: 'W3', color: '#D97706', note: 'Moderate week · carb needs increase' },
              { phase: 'W4', color: '#16A34A', note: 'Strong week · higher carbs recommended' },
            ].map(p => (
              <div key={p.phase} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: p.color, marginTop: '3px', flexShrink: 0 }} />
                <span><strong>{p.phase}</strong> — {p.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#E2E8F0' : '#0F2044', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}

function DailyCheckIn({ athleteId }: { athleteId: string }) {
  const [todayLog, setTodayLog] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const [showNotes, setShowNotes] = React.useState(false)
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  React.useEffect(() => {
    if (!athleteId) return
    supabase.from('ra_nutrition_logs').select('compliance, notes').eq('athlete_id', athleteId).eq('logged_date', today).maybeSingle()
      .then(({ data }) => { if (data) { setTodayLog(data.compliance); setNotes(data.notes || '') } })
  }, [athleteId])

  async function logCompliance(compliance: string) {
    setSaving(true)
    await supabase.from('ra_nutrition_logs').upsert({ athlete_id: athleteId, logged_date: today, compliance, notes: notes || null }, { onConflict: 'athlete_id,logged_date' })
    setTodayLog(compliance)
    setSaving(false)
  }

  const options = [
    { value: 'under', label: 'Under', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)' },
    { value: 'slightly_under', label: 'Slightly Under', color: '#D97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)' },
    { value: 'on_track', label: 'On Track', color: '#16A34A', bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.2)' },
    { value: 'slightly_over', label: 'Slightly Over', color: '#D97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)' },
    { value: 'over', label: 'Over', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)' },
  ]

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Today's Check-In</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>How did your nutrition go today?</p>
        </div>
        {todayLog && <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>✓ Logged</span>}
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {options.map(opt => (
            <button key={opt.value} onClick={() => logCompliance(opt.value)} disabled={saving}
              style={{ flex: 1, padding: '9px 4px', borderRadius: '8px', border: `1.5px solid ${todayLog === opt.value ? opt.color : '#E2E8F0'}`, background: todayLog === opt.value ? opt.bg : '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: todayLog === opt.value ? opt.color : '#475569' }}>{opt.label}</div>
            </button>
          ))}
        </div>
        {todayLog && (
          <div>
            <button onClick={() => setShowNotes(!showNotes)} style={{ fontSize: '12px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showNotes ? '▼' : '▶'} Add a note
            </button>
            {showNotes && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. social event, felt depleted..."
                  style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', color: '#0F2044', outline: 'none' }} />
                <button onClick={() => logCompliance(todayLog)} style={{ padding: '8px 14px', background: '#0F2044', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>Save</button>
              </div>
            )}
          </div>
        )}
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
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '360px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(15,32,68,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between' }}>
          <div><h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F2044' }}>Log Weigh-In</h2><p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{format(new Date(), 'MMMM d, yyyy')}</p></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
          <div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Weight (kg)</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 84.5" step="0.1" style={{ ...inp, fontSize: '22px', fontWeight: 800 }} autoFocus /></div>
          <div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Time of Day</label>
            <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} style={inp}>
              <option value="morning">Morning (fasted)</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="post_weigh_in">Post Weigh-In (competition)</option>
            </select></div>
          <div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. after hard training week" style={inp} /></div>
          {error && <div style={{ padding: '10px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Log Weight →'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function useState<T>(v: T) { return React.useState(v) }
