'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import AthleteNav from '@/components/AthleteNav'

interface Exercise {
  id: string
  name: string
  category: string
  has_1rm: boolean
  ratio_to_snatch: number | null
  is_competition_lift: boolean
}

interface OneRM {
  id: string
  exercise_id: string
  weight_kg: number
  is_competition: boolean
  tested_at: string
  notes: string | null
  exercise: Exercise
}

const PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]

export default function AthleteMaxesPage() {
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [athleteName, setAthleteName] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [oneRMs, setOneRMs] = useState<OneRM[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [customWeight, setCustomWeight] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profileData } = await supabase
      .from('ra_profiles').select('full_name, email').eq('id', user.id).maybeSingle()

    const { data: athleteData } = await supabase
      .from('ra_athletes').select('id').eq('profile_id', user.id).maybeSingle()

    if (!athleteData) { setLoading(false); return }

    setAthleteId(athleteData.id)
    setAthleteName((profileData as any)?.full_name || (profileData as any)?.email || 'Athlete')

    const { data: exerciseData } = await supabase
      .from('ra_exercises').select('*').eq('has_1rm', true).order('category').order('name')

    const { data: ormData } = await supabase
      .from('ra_one_rep_maxes')
      .select('*, exercise:ra_exercises(*)')
      .eq('athlete_id', athleteData.id)
      .order('tested_at', { ascending: false })

    const seen = new Set<string>()
    const deduped = (ormData || []).filter((o: any) => {
      if (seen.has(o.exercise_id)) return false
      seen.add(o.exercise_id)
      return true
    })

    setExercises((exerciseData as any) || [])
    setOneRMs(deduped as any)

    const snatch = (exerciseData as any)?.find((e: Exercise) => e.name === 'Snatch')
    if (snatch) setSelectedExerciseId(snatch.id)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function get1RM(exerciseId: string): number | null {
    return oneRMs.find(o => o.exercise_id === exerciseId)?.weight_kg || null
  }

  function getSnatch1RM(): number | null {
    const snatch = exercises.find(e => e.name === 'Snatch')
    return snatch ? get1RM(snatch.id) : null
  }

  function estimatedFrom1RM(exercise: Exercise): { weight: number; source: string } | null {
    if (!exercise.ratio_to_snatch) return null
    const snatch = getSnatch1RM()
    if (!snatch) return null
    return {
      weight: Math.round(snatch * exercise.ratio_to_snatch),
      source: `${Math.round(exercise.ratio_to_snatch * 100)}% of Snatch`
    }
  }

  function calcPct(weight: number, pct: number): number {
    return Math.round(weight * pct / 100 / 2.5) * 2.5
  }

  const focusExercise = exercises.find(e => e.id === selectedExerciseId)
  const focus1RM = focusExercise ? get1RM(focusExercise.id) : null
  const calcBase = customWeight ? parseFloat(customWeight) : focus1RM
  const compLifts = exercises.filter(e => e.is_competition_lift)
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ height: '100px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} />
      <div style={{ padding: '60px', textAlign: 'center' as const, color: '#94A3B8' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <AthleteNav active="maxes" athleteName={athleteName} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F2044' }}>My Maxes</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Your current 1RMs and percentage calculator</p>
          </div>
          <button onClick={() => setShowAddModal(true)} style={{ padding: '9px 18px', background: '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
            + Log New Max
          </button>
        </div>

        {oneRMs.length === 0 ? (
          <div style={{ ...card, padding: '48px', textAlign: 'center' as const, color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏋️</div>
            <p style={{ fontWeight: 600, color: '#475569', marginBottom: '8px' }}>No maxes recorded yet</p>
            <button onClick={() => setShowAddModal(true)} style={{ color: '#B8891A', background: 'none', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              Log your first max →
            </button>
          </div>
        ) : (
          <>
            {/* Competition lift hero cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {compLifts.map(exercise => {
                const orm = get1RM(exercise.id)
                const isSelected = selectedExerciseId === exercise.id
                return (
                  <button key={exercise.id} onClick={() => { setSelectedExerciseId(exercise.id); setCustomWeight('') }}
                    style={{ padding: '22px', background: isSelected ? '#0F2044' : '#FFFFFF', border: `2px solid ${isSelected ? '#0F2044' : '#E2E8F0'}`, borderRadius: '12px', textAlign: 'left' as const, cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? '#B8891A' : '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '8px' }}>{exercise.name}</div>
                    {orm ? (
                      <>
                        <div style={{ fontSize: '44px', fontWeight: 800, color: isSelected ? '#FFFFFF' : '#0F2044', lineHeight: 1 }}>
                          {orm}<span style={{ fontSize: '18px', fontWeight: 500, color: isSelected ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>kg</span>
                        </div>
                        <div style={{ fontSize: '11px', color: isSelected ? '#B8891A' : '#94A3B8', marginTop: '8px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                          {oneRMs.find(o => o.exercise_id === exercise.id)?.is_competition ? '🏅 Competition PR' : 'Training Max'}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '20px', color: isSelected ? 'rgba(255,255,255,0.3)' : '#CBD5E1', fontWeight: 700, marginTop: '8px' }}>Not set</div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Percentage calculator */}
            <div style={{ ...card, marginBottom: '20px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044', marginBottom: '12px' }}>Percentage Calculator</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Lift</label>
                    <select value={selectedExerciseId} onChange={e => { setSelectedExerciseId(e.target.value); setCustomWeight('') }}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' }}>
                      {exercises.filter(e => e.has_1rm).map(e => (
                        <option key={e.id} value={e.id}>{e.name}{get1RM(e.id) ? ` — ${get1RM(e.id)}kg` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: '140px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Custom 1RM (kg)</label>
                    <input type="number" value={customWeight} onChange={e => setCustomWeight(e.target.value)} placeholder={focus1RM ? `${focus1RM}` : 'e.g. 100'} step="0.5"
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' }} />
                  </div>
                </div>
              </div>
              {calcBase ? (
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '12px', fontWeight: 500 }}>
                    Based on {customWeight ? `custom ${calcBase}kg` : `${focusExercise?.name} 1RM (${calcBase}kg)`}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                    {PERCENTAGES.map(pct => {
                      const kg = calcPct(calcBase, pct)
                      const isHeavy = pct >= 90
                      const isMod = pct >= 80 && pct < 90
                      return (
                        <div key={pct} style={{ padding: '8px 12px', borderRadius: '8px', textAlign: 'center' as const, minWidth: '68px', background: isHeavy ? 'rgba(220,38,38,0.06)' : isMod ? 'rgba(217,119,6,0.06)' : 'rgba(22,163,74,0.06)', border: `1px solid ${isHeavy ? 'rgba(220,38,38,0.15)' : isMod ? 'rgba(217,119,6,0.15)' : 'rgba(22,163,74,0.15)'}` }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: isHeavy ? '#DC2626' : isMod ? '#D97706' : '#16A34A' }}>{pct}%</div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F2044' }}>{kg}kg</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center' as const, color: '#94A3B8', fontSize: '13px' }}>
                  Select a lift with a 1RM or enter a custom weight above.
                </div>
              )}
            </div>

            {/* All lifts table */}
            <div style={card}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>All Lifts</h2>
                <button onClick={() => setShowAddModal(true)} style={{ fontSize: '12px', color: '#B8891A', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>+ Log Max</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {['Lift', '1RM', 'Source', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exercises.filter(e => e.has_1rm).map((exercise, idx) => {
                    const tested = oneRMs.find(o => o.exercise_id === exercise.id)
                    const estimated = !tested ? estimatedFrom1RM(exercise) : null
                    const weight = tested?.weight_kg || estimated?.weight
                    if (!weight) return null
                    return (
                      <tr key={exercise.id} style={{ borderBottom: '1px solid #F9FAFB', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA', cursor: 'pointer' }}
                        onClick={() => { setSelectedExerciseId(exercise.id); setCustomWeight(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>{exercise.name}</td>
                        <td style={{ padding: '11px 16px', fontSize: '15px', fontWeight: 800, color: '#0F2044' }}>{weight}kg</td>
                        <td style={{ padding: '11px 16px' }}>
                          {tested ? (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: tested.is_competition ? 'rgba(184,137,26,0.1)' : 'rgba(22,163,74,0.08)', color: tested.is_competition ? '#B8891A' : '#16A34A', border: `1px solid ${tested.is_competition ? 'rgba(184,137,26,0.25)' : 'rgba(22,163,74,0.2)'}` }}>
                              {tested.is_competition ? '🏅 Comp' : 'Tested'}
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}>Ratio</span>
                          )}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#94A3B8' }}>
                          {tested ? format(new Date(tested.tested_at + 'T12:00:00'), 'MMM d, yyyy') : estimated?.source}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showAddModal && athleteId && (
        <AddMaxModal
          athleteId={athleteId}
          exercises={exercises.filter(e => e.has_1rm)}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); load() }}
        />
      )}
    </div>
  )
}

function AddMaxModal({ athleteId, exercises, onClose, onSaved }: {
  athleteId: string
  exercises: Exercise[]
  onClose: () => void
  onSaved: () => void
}) {
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [isComp, setIsComp] = useState(false)
  const [testedAt, setTestedAt] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function save() {
    if (!exerciseId || !weight) { setError('Exercise and weight are required'); return }
    setSaving(true)
    const { error } = await supabase.from('ra_one_rep_maxes').upsert({
      athlete_id: athleteId,
      exercise_id: exerciseId,
      weight_kg: parseFloat(weight),
      is_competition: isComp,
      tested_at: testedAt,
      notes: notes || null
    }, { onConflict: 'athlete_id,exercise_id,tested_at' })
    if (error) { setError(error.message); setSaving(false) }
    else { onSaved() }
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '11px', fontWeight: 600 as const, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(15,32,68,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F2044' }}>Log New Max</h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Record a training or competition PR</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '22px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
          <div>
            <label style={lbl}>Exercise</label>
            <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} style={inp}>
              <option value="">Select exercise...</option>
              {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Weight (kg)</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 115" step="0.5" style={{ ...inp, fontSize: '20px', fontWeight: 700 }} autoFocus />
            </div>
            <div>
              <label style={lbl}>Date</label>
              <input type="date" value={testedAt} onChange={e => setTestedAt(e.target.value)} style={inp} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <input type="checkbox" checked={isComp} onChange={e => setIsComp(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#B8891A' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>🏅 This was a competition lift</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>Competition PRs are highlighted separately</div>
            </div>
          </label>
          <div>
            <label style={lbl}>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Hit depth, solid pull..." style={inp} />
          </div>
          {error && <div style={{ padding: '10px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Max →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

