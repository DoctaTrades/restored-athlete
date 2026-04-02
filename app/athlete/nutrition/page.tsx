'use client'

import React, { useEffect, useState, useCallback } from 'react'
import AthleteNav from '@/components/AthleteNav'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface NutritionTarget {
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
}

interface MealPrefs {
  meals_per_day: number
  post_workout_meal: number
}

interface Meal {
  number: number
  label: string
  isPostWorkout: boolean
  isSecondAfterWorkout: boolean
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

// Carb distribution based on proximity to workout
function distributeMeals(
  totalProtein: number,
  totalCarbs: number,
  totalFat: number,
  totalCalories: number,
  mealsPerDay: number,
  postWorkoutMeal: number
): Meal[] {
  const meals: Meal[] = []
  const secondAfterWorkout = postWorkoutMeal < mealsPerDay ? postWorkoutMeal + 1 : null

  // Carb distribution percentages
  const carbDistribution: number[] = new Array(mealsPerDay).fill(0)

  if (mealsPerDay === 1) {
    carbDistribution[0] = 1.0
  } else if (mealsPerDay === 2) {
    const pwIdx = postWorkoutMeal - 1
    carbDistribution[pwIdx] = 0.6
    const other = pwIdx === 0 ? 1 : 0
    carbDistribution[other] = 0.4
  } else {
    const pwIdx = postWorkoutMeal - 1
    const s2Idx = secondAfterWorkout ? secondAfterWorkout - 1 : null
    carbDistribution[pwIdx] = 0.35
    if (s2Idx !== null) carbDistribution[s2Idx] = 0.25
    const remaining = s2Idx !== null ? 0.40 : 0.65
    const otherCount = s2Idx !== null ? mealsPerDay - 2 : mealsPerDay - 1
    const perOther = otherCount > 0 ? remaining / otherCount : 0
    for (let i = 0; i < mealsPerDay; i++) {
      if (i !== pwIdx && i !== s2Idx) carbDistribution[i] = perOther
    }
  }

  // Protein equal across all meals
  const proteinPerMeal = Math.round(totalProtein / mealsPerDay)

  // Fat: slightly lower near workout (fat slows digestion), higher away
  // PWO meal: 10% of fat, 2nd after: 15%, rest split evenly
  const fatDistribution: number[] = new Array(mealsPerDay).fill(0)
  if (mealsPerDay === 1) {
    fatDistribution[0] = 1.0
  } else {
    const pwIdx = postWorkoutMeal - 1
    const s2Idx = secondAfterWorkout ? secondAfterWorkout - 1 : null
    fatDistribution[pwIdx] = 0.10
    if (s2Idx !== null) fatDistribution[s2Idx] = 0.15
    const remaining = s2Idx !== null ? 0.75 : 0.90
    const otherCount = s2Idx !== null ? mealsPerDay - 2 : mealsPerDay - 1
    const perOther = otherCount > 0 ? remaining / otherCount : 0
    for (let i = 0; i < mealsPerDay; i++) {
      if (i !== pwIdx && i !== s2Idx) fatDistribution[i] = perOther
    }
  }

  for (let i = 0; i < mealsPerDay; i++) {
    const mealNum = i + 1
    const isPostWorkout = mealNum === postWorkoutMeal
    const isSecondAfterWorkout = mealNum === secondAfterWorkout

    const carbs = Math.round(totalCarbs * carbDistribution[i])
    const fat = Math.round(totalFat * fatDistribution[i])
    const calories = Math.round(proteinPerMeal * 4 + carbs * 4 + fat * 9)

    let label = `Meal ${mealNum}`
    if (isPostWorkout) label = `Meal ${mealNum} — Post-Workout`
    else if (isSecondAfterWorkout) label = `Meal ${mealNum} — 2nd After Workout`

    meals.push({
      number: mealNum,
      label,
      isPostWorkout,
      isSecondAfterWorkout,
      calories,
      protein_g: proteinPerMeal,
      carbs_g: carbs,
      fat_g: fat,
    })
  }

  return meals
}

function NavBar({ athleteName }: { athleteName: string }) {
  return (
    <nav style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF', position: 'sticky' as const, top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: '#0F2044', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#B8891A' }}>RA</div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Restored Athlete</span>
        </div>
        <div style={{ width: '1px', height: '16px', background: '#E2E8F0' }} />
        {[
          { label: 'Today', href: '/athlete/dashboard' },
          { label: 'Nutrition', href: '/athlete/nutrition', active: true },
        ].map(link => (
          <a key={link.href} href={link.href} style={{ fontSize: '13px', fontWeight: (link as any).active ? 700 : 500, color: (link as any).active ? '#B8891A' : '#64748B', textDecoration: 'none', borderBottom: (link as any).active ? '2px solid #B8891A' : '2px solid transparent', paddingBottom: '2px' }}>{link.label}</a>
        ))}
      </div>
      <span style={{ fontSize: '13px', color: '#94A3B8' }}>{athleteName}</span>
    </nav>
  )
}

function MacroBar({ label, g, pct, color }: { label: string; g: number; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{label}</span>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>{g}g</span>
      </div>
      <div style={{ height: '5px', background: '#F1F5F9', borderRadius: '3px' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '3px' }} />
      </div>
    </div>
  )
}

export default function AthleteNutritionPage() {
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [athleteName, setAthleteName] = useState('')
  const [targets, setTargets] = useState<NutritionTarget | null>(null)
  const [mealPrefs, setMealPrefs] = useState<MealPrefs>({ meals_per_day: 3, post_workout_meal: 2 })
  const [isTrainingDay, setIsTrainingDay] = useState(true)
  const [view, setView] = useState<'table' | 'timeline'>('table')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: athleteData } = await supabase
      .from('ra_athletes')
      .select('id, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!athleteData) { setLoading(false); return }
    setAthleteId(athleteData.id)
    setAthleteName((athleteData as any).profile?.full_name || (athleteData as any).profile?.email || 'Athlete')

    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: targetData } = await supabase
      .from('ra_nutrition_targets')
      .select('*')
      .eq('athlete_id', athleteData.id)
      .lte('effective_date', today)
      .order('effective_date', { ascending: false })
      .limit(1).maybeSingle()

    const { data: prefData } = await supabase
      .from('ra_meal_preferences')
      .select('*')
      .eq('athlete_id', athleteData.id)
      .maybeSingle()

    setTargets(targetData as any)
    if (prefData) setMealPrefs({ meals_per_day: prefData.meals_per_day, post_workout_meal: prefData.post_workout_meal })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveMealPrefs() {
    if (!athleteId) return
    setSaving(true)
    await supabase.from('ra_meal_preferences').upsert({
      athlete_id: athleteId,
      meals_per_day: mealPrefs.meals_per_day,
      post_workout_meal: Math.min(mealPrefs.post_workout_meal, mealPrefs.meals_per_day),
      updated_at: new Date().toISOString()
    }, { onConflict: 'athlete_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Get active macros based on training/rest day
  function getActiveMacros() {
    if (!targets) return null
    if (isTrainingDay && targets.training_calories) {
      return { calories: targets.training_calories, protein_g: targets.training_protein_g!, carbs_g: targets.training_carbs_g!, fat_g: targets.training_fat_g! }
    }
    if (!isTrainingDay && targets.rest_calories) {
      return { calories: targets.rest_calories, protein_g: targets.rest_protein_g!, carbs_g: targets.rest_carbs_g!, fat_g: targets.rest_fat_g! }
    }
    if (targets.calories) {
      return { calories: targets.calories, protein_g: targets.protein_g!, carbs_g: targets.carbs_g!, fat_g: targets.fat_g! }
    }
    return null
  }

  const activeMacros = getActiveMacros()
  const adjustedPostWorkout = Math.min(mealPrefs.post_workout_meal, mealPrefs.meals_per_day)
  const meals = activeMacros
    ? distributeMeals(activeMacros.protein_g, activeMacros.carbs_g, activeMacros.fat_g, activeMacros.calories, mealPrefs.meals_per_day, adjustedPostWorkout)
    : []

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>Loading...</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <AthleteNav active="nutrition" athleteName={athleteName} />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F2044' }}>My Nutrition</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>

        {!targets ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center' as const, color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🥗</div>
            <p style={{ fontWeight: 600, color: '#475569' }}>No nutrition targets set yet</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Your coach will set your targets soon.</p>
          </div>
        ) : (
          <>
            {/* Day type toggle */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Today is a...</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Affects your carb and calorie targets</div>
              </div>
              <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
                {[
                  { label: '🏋️ Training Day', value: true },
                  { label: '😴 Rest Day', value: false },
                ].map(opt => (
                  <button key={opt.label} onClick={() => setIsTrainingDay(opt.value)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: isTrainingDay === opt.value ? '#FFFFFF' : 'transparent', color: isTrainingDay === opt.value ? '#0F2044' : '#94A3B8', boxShadow: isTrainingDay === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>


        {/* Daily nutrition check-in */}
        <DailyCheckIn athleteId={athleteId!} />

            {/* Daily totals summary */}
            {activeMacros && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '12px' }}>Daily Totals</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 800, color: '#0F2044' }}>{activeMacros.calories}</span>
                  <span style={{ fontSize: '16px', color: '#94A3B8', fontWeight: 500 }}>kcal</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {[
                    { label: 'Protein', g: activeMacros.protein_g, pct: Math.round(activeMacros.protein_g * 4 / activeMacros.calories * 100), color: '#0F2044' },
                    { label: 'Carbs', g: activeMacros.carbs_g, pct: Math.round(activeMacros.carbs_g * 4 / activeMacros.calories * 100), color: '#B8891A' },
                    { label: 'Fat', g: activeMacros.fat_g, pct: Math.round(activeMacros.fat_g * 9 / activeMacros.calories * 100), color: '#3B82F6' },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: 'center' as const }}>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: m.color }}>{m.g}g</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{m.label} · {m.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meal settings */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const, marginBottom: '16px' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Meal Settings</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {saved && <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>✓ Saved</span>}
                  <button onClick={saveMealPrefs} disabled={saving} style={{ padding: '6px 14px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Meals Per Day
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <button key={n} onClick={() => setMealPrefs(p => ({ ...p, meals_per_day: n, post_workout_meal: Math.min(p.post_workout_meal, n) }))}
                        style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid', fontSize: '14px', fontWeight: 700, cursor: 'pointer', borderColor: mealPrefs.meals_per_day === n ? '#B8891A' : '#E2E8F0', background: mealPrefs.meals_per_day === n ? 'rgba(184,137,26,0.08)' : '#FFFFFF', color: mealPrefs.meals_per_day === n ? '#B8891A' : '#94A3B8' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Post-Workout Meal #
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {Array.from({ length: mealPrefs.meals_per_day }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setMealPrefs(p => ({ ...p, post_workout_meal: n }))}
                        style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid', fontSize: '14px', fontWeight: 700, cursor: 'pointer', borderColor: mealPrefs.post_workout_meal === n ? '#0F2044' : '#E2E8F0', background: mealPrefs.post_workout_meal === n ? '#0F2044' : '#FFFFFF', color: mealPrefs.post_workout_meal === n ? '#FFFFFF' : '#94A3B8' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>Which meal comes right after your workout?</div>
                </div>
              </div>
            </div>

            {/* Meal breakdown */}
            {meals.length > 0 && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Meal Breakdown</div>
                  <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '6px', padding: '2px' }}>
                    {[{ label: 'Table', value: 'table' }, { label: 'Timeline', value: 'timeline' }].map(v => (
                      <button key={v.value} onClick={() => setView(v.value as any)} style={{ padding: '5px 12px', borderRadius: '4px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: view === v.value ? '#FFFFFF' : 'transparent', color: view === v.value ? '#0F2044' : '#94A3B8', boxShadow: view === v.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {view === 'table' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        {['Meal', 'Calories', 'Protein', 'Carbs', 'Fat'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Meal' ? 'left' as const : 'center' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {meals.map((meal, idx) => (
                        <tr key={meal.number} style={{ borderBottom: idx < meals.length - 1 ? '1px solid #F9FAFB' : 'none', background: meal.isPostWorkout ? 'rgba(15,32,68,0.02)' : meal.isSecondAfterWorkout ? 'rgba(184,137,26,0.02)' : 'transparent' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {meal.isPostWorkout && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0F2044', flexShrink: 0 }} />}
                              {meal.isSecondAfterWorkout && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#B8891A', flexShrink: 0 }} />}
                              {!meal.isPostWorkout && !meal.isSecondAfterWorkout && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E2E8F0', flexShrink: 0 }} />}
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2044' }}>{meal.label}</div>
                                {meal.isPostWorkout && <div style={{ fontSize: '11px', color: '#0F2044', fontWeight: 500 }}>Highest carbs — replenish glycogen</div>}
                                {meal.isSecondAfterWorkout && <div style={{ fontSize: '11px', color: '#B8891A', fontWeight: 500 }}>Second highest carbs</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' as const, fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>{meal.calories}</td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' as const }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>{meal.protein_g}g</span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' as const }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#B8891A' }}>{meal.carbs_g}g</span>
                            <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                              {Math.round(meal.carbs_g / (activeMacros?.carbs_g || 1) * 100)}% of daily
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' as const }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#3B82F6' }}>{meal.fat_g}g</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  // Timeline view
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ position: 'relative' as const }}>
                      {/* Carb bar visualization */}
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '10px' }}>Carb Distribution</div>
                        <div style={{ display: 'flex', gap: '4px', height: '40px', alignItems: 'flex-end' }}>
                          {meals.map(meal => {
                            const pct = Math.round(meal.carbs_g / (activeMacros?.carbs_g || 1) * 100)
                            return (
                              <div key={meal.number} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px' }}>
                                <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>{pct}%</div>
                                <div style={{ width: '100%', height: `${Math.max(pct, 8)}%`, minHeight: '8px', maxHeight: '32px', background: meal.isPostWorkout ? '#0F2044' : meal.isSecondAfterWorkout ? '#B8891A' : '#CBD5E1', borderRadius: '3px 3px 0 0' }} />
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Meal cards */}
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                        {meals.map(meal => (
                          <div key={meal.number} style={{
                            padding: '14px 16px', borderRadius: '10px',
                            background: meal.isPostWorkout ? '#0F2044' : meal.isSecondAfterWorkout ? 'rgba(184,137,26,0.06)' : '#F8FAFC',
                            border: `1px solid ${meal.isPostWorkout ? '#0F2044' : meal.isSecondAfterWorkout ? 'rgba(184,137,26,0.2)' : '#E2E8F0'}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: meal.isPostWorkout ? '#FFFFFF' : '#0F2044' }}>{meal.label}</div>
                                <div style={{ fontSize: '11px', color: meal.isPostWorkout ? 'rgba(255,255,255,0.5)' : '#94A3B8', marginTop: '1px' }}>{meal.calories} kcal</div>
                              </div>
                              {meal.isPostWorkout && (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', background: '#B8891A', borderRadius: '4px', color: '#0F2044', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>⚡ PWO</span>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                              {[
                                { label: 'Protein', g: meal.protein_g, color: meal.isPostWorkout ? 'rgba(255,255,255,0.7)' : '#0F2044' },
                                { label: 'Carbs', g: meal.carbs_g, color: meal.isPostWorkout ? '#E0AE35' : '#B8891A' },
                                { label: 'Fat', g: meal.fat_g, color: meal.isPostWorkout ? 'rgba(255,255,255,0.5)' : '#3B82F6' },
                              ].map(m => (
                                <div key={m.label} style={{ textAlign: 'center' as const }}>
                                  <div style={{ fontSize: '16px', fontWeight: 800, color: m.color }}>{m.g}g</div>
                                  <div style={{ fontSize: '10px', color: meal.isPostWorkout ? 'rgba(255,255,255,0.4)' : '#94A3B8', fontWeight: 500 }}>{m.label}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Legend */}
                      <div style={{ marginTop: '16px', display: 'flex', gap: '16px', fontSize: '11px', color: '#94A3B8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0F2044' }} />
                          <span>Post-workout (35% carbs)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#B8891A' }} />
                          <span>2nd after workout (25% carbs)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#CBD5E1' }} />
                          <span>Other meals (split evenly)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
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
    async function load() {
      const { data } = await supabase
        .from('ra_nutrition_logs')
        .select('compliance, notes')
        .eq('athlete_id', athleteId)
        .eq('logged_date', today)
        .maybeSingle()
      if (data) { setTodayLog(data.compliance); setNotes(data.notes || '') }
    }
    load()
  }, [athleteId])

  async function logCompliance(compliance: string) {
    setSaving(true)
    await supabase.from('ra_nutrition_logs').upsert({
      athlete_id: athleteId,
      logged_date: today,
      compliance,
      notes: notes || null
    }, { onConflict: 'athlete_id,logged_date' })
    setTodayLog(compliance)
    setSaving(false)
  }

  const options = [
    { value: 'under', label: 'Under', sub: 'Significantly under target', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)' },
    { value: 'slightly_under', label: 'Slightly Under', sub: 'A bit below target', color: '#D97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)' },
    { value: 'on_track', label: 'On Track', sub: 'Hit my targets', color: '#16A34A', bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.2)' },
    { value: 'slightly_over', label: 'Slightly Over', sub: 'A bit above target', color: '#D97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)' },
    { value: 'over', label: 'Over', sub: 'Significantly over target', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)' },
  ]

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>Today's Check-In</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>How did your nutrition go today?</p>
        </div>
        {todayLog && (
          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>✓ Logged</span>
        )}
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {options.map(opt => (
            <button key={opt.value} onClick={() => logCompliance(opt.value)} disabled={saving}
              style={{
                flex: 1, padding: '10px 6px', borderRadius: '8px', border: `1.5px solid`,
                borderColor: todayLog === opt.value ? opt.color : '#E2E8F0',
                background: todayLog === opt.value ? opt.bg : '#FFFFFF',
                cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                textAlign: 'center' as const
              }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: todayLog === opt.value ? opt.color : '#475569' }}>{opt.label}</div>
            </button>
          ))}
        </div>

        {todayLog && (
          <div>
            <button onClick={() => setShowNotes(!showNotes)} style={{ fontSize: '12px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showNotes ? '8px' : 0 }}>
              {showNotes ? '▼' : '▶'} Add a note (optional)
            </button>
            {showNotes && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. social event, felt depleted, meal prepped..."
                  style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', color: '#0F2044', outline: 'none', background: '#FFFFFF' }} />
                <button onClick={() => logCompliance(todayLog)} style={{ padding: '8px 14px', background: '#0F2044', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>Save</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
