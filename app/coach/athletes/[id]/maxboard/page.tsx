'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

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

interface Athlete {
  id: string
  profile: { full_name: string; email: string }
}

const PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]

function Sidebar({ active, athleteId, athleteName }: { active: string; athleteId: string; athleteName: string }) {
  const links = [
    { label: 'Athletes', href: '/coach/dashboard', icon: '👥' },
    { label: 'Programming', href: '/coach/programming', icon: '📅' },
  ]
  const athleteLinks = [
    { label: 'Program', href: `/coach/athletes/${athleteId}/program`, icon: '📅' },
    { label: 'Max Board', href: `/coach/athletes/${athleteId}/maxboard`, icon: '🏆' },
    { label: 'Nutrition', href: `/coach/athletes/${athleteId}/nutrition`, icon: '🥗' },
  ]
  return (
    <div style={{ width: '240px', background: '#0F2044', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, position: 'fixed', left: 0, top: 0, bottom: 0 }}>
      <div>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: '#B8891A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#0F2044', flexShrink: 0 }}>R</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>Restored Athlete</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Coach Portal</div>
            </div>
          </div>
        </div>
        <nav style={{ padding: '12px' }}>
          {links.map(link => (
            <a key={link.href} href={link.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', marginBottom: '2px', color: 'rgba(255,255,255,0.4)' }}>
              <span style={{ fontSize: '16px' }}>{link.icon}</span>
              <span style={{ fontSize: '13px' }}>{link.label}</span>
            </a>
          ))}
          {/* Athlete section */}
          <div style={{ margin: '8px 0 4px', padding: '0 12px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '6px' }}>
              {athleteName.split(' ')[0]}
            </div>
          </div>
          {athleteLinks.map(link => (
            <a key={link.href} href={link.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', marginBottom: '2px', background: active === link.label ? 'rgba(184,137,26,0.15)' : 'transparent', color: active === link.label ? '#B8891A' : 'rgba(255,255,255,0.5)' }}>
              <span style={{ fontSize: '16px' }}>{link.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: active === link.label ? 600 : 400 }}>{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px' }}>Viewing As</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ padding: '6px 14px', background: '#B8891A', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#0F2044' }}>Coach</div>
          <a href="/athlete/dashboard" style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Athlete</a>
        </div>
      </div>
    </div>
  )
}

export default function MaxBoardPage({ params }: { params: { id: string } }) {
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [oneRMs, setOneRMs] = useState<OneRM[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCalcModal, setShowCalcModal] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: athleteData } = await supabase
      .from('ra_athletes')
      .select('id, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
      .eq('id', params.id)
      .maybeSingle()

    const { data: exerciseData } = await supabase
      .from('ra_exercises')
      .select('*')
      .eq('has_1rm', true)
      .order('category').order('name')

    // Get latest 1RM per exercise
    const { data: ormData } = await supabase
      .from('ra_one_rep_maxes')
      .select('*, exercise:ra_exercises(*)')
      .eq('athlete_id', params.id)
      .order('tested_at', { ascending: false })

    // Deduplicate — keep only latest per exercise
    const seen = new Set<string>()
    const deduped = (ormData || []).filter((o: any) => {
      if (seen.has(o.exercise_id)) return false
      seen.add(o.exercise_id)
      return true
    })

    setAthlete(athleteData as any)
    setExercises((exerciseData as any) || [])
    setOneRMs(deduped as any)
    setLoading(false)
  }, [params.id])

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
    const snatch1RM = getSnatch1RM()
    if (!snatch1RM) return null
    return {
      weight: Math.round(snatch1RM * exercise.ratio_to_snatch),
      source: `${Math.round(exercise.ratio_to_snatch * 100)}% of Snatch`
    }
  }

  function calcPercentage(weight: number, pct: number): number {
    return Math.round(weight * pct / 100 / 2.5) * 2.5
  }

  // Competition lifts for the hero section
  const compLifts = exercises.filter(e => e.is_competition_lift)
  const nonCompLifts = exercises.filter(e => !e.is_competition_lift && e.has_1rm)

  // Lift selected for percentage breakdown
  const focusExercise = selectedExercise
    ? exercises.find(e => e.id === selectedExercise)
    : compLifts[0]
  const focus1RM = focusExercise ? get1RM(focusExercise.id) : null

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}><div style={{ marginLeft: '240px', padding: '60px', color: '#94A3B8' }}>Loading...</div></div>

  const athleteName = (athlete as any)?.profile?.full_name || (athlete as any)?.profile?.email || 'Athlete'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <Sidebar active="Max Board" athleteId={params.id} athleteName={athleteName} />

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
          <a href="/coach/dashboard" style={{ color: '#94A3B8', textDecoration: 'none' }}>Athletes</a>
          {' / '}
          <a href={`/coach/athletes/${params.id}/maxboard`} style={{ color: '#94A3B8', textDecoration: 'none' }}>{athleteName}</a>
          {' / '}
          <span style={{ color: '#0F2044', fontWeight: 600 }}>Max Board</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>{athleteName} — Max Board</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>All current 1RMs</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowCalcModal(true)} style={{ padding: '9px 18px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
              Calc from Reps
            </button>
            <button onClick={() => setShowAddModal(true)} style={{ padding: '9px 18px', background: '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
              + Add Max
            </button>
          </div>
        </div>

        {/* Competition lift hero cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {compLifts.map(exercise => {
            const orm = get1RM(exercise.id)
            const isSelected = selectedExercise === exercise.id || (!selectedExercise && exercise === compLifts[0])
            return (
              <button key={exercise.id} onClick={() => setSelectedExercise(exercise.id)}
                style={{ padding: '24px', background: isSelected ? '#0F2044' : '#FFFFFF', border: `2px solid ${isSelected ? '#0F2044' : '#E2E8F0'}`, borderRadius: '12px', textAlign: 'left' as const, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? '#B8891A' : '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '8px' }}>{exercise.name}</div>
                {orm ? (
                  <>
                    <div style={{ fontSize: '48px', fontWeight: 800, color: isSelected ? '#FFFFFF' : '#0F2044', lineHeight: 1 }}>
                      {orm}<span style={{ fontSize: '20px', fontWeight: 600, color: isSelected ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>kg</span>
                    </div>
                    <div style={{ fontSize: '11px', color: isSelected ? '#B8891A' : '#94A3B8', marginTop: '8px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                      {oneRMs.find(o => o.exercise_id === exercise.id)?.is_competition ? 'Competition' : 'Training Max'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '24px', color: isSelected ? 'rgba(255,255,255,0.3)' : '#CBD5E1', fontWeight: 700, marginTop: '8px' }}>Not set</div>
                )}
              </button>
            )
          })}
        </div>

        {/* Percentage breakdown for selected lift */}
        {focusExercise && focus1RM && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044', marginBottom: '16px' }}>
              Quick % — {focusExercise.name} ({focus1RM}kg)
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {PERCENTAGES.map(pct => {
                const kg = calcPercentage(focus1RM, pct)
                const isHeavy = pct >= 90
                const isMod = pct >= 80 && pct < 90
                return (
                  <div key={pct} style={{
                    padding: '8px 12px', borderRadius: '8px', textAlign: 'center' as const, minWidth: '72px',
                    background: isHeavy ? 'rgba(220,38,38,0.06)' : isMod ? 'rgba(217,119,6,0.06)' : 'rgba(22,163,74,0.06)',
                    border: `1px solid ${isHeavy ? 'rgba(220,38,38,0.15)' : isMod ? 'rgba(217,119,6,0.15)' : 'rgba(22,163,74,0.15)'}`
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: isHeavy ? '#DC2626' : isMod ? '#D97706' : '#16A34A' }}>{pct}%</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F2044' }}>{kg}kg</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Full lift table */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>All Lifts</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                {['Lift', '1RM', 'Source', 'Info'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exercises.filter(e => e.has_1rm).map((exercise, idx) => {
                const tested = oneRMs.find(o => o.exercise_id === exercise.id)
                const estimated = !tested ? estimatedFrom1RM(exercise) : null
                const weight = tested?.weight_kg || estimated?.weight

                if (!weight && !tested) return null // skip if no data and no ratio

                return (
                  <tr key={exercise.id} style={{ borderBottom: '1px solid #F9FAFB', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                    <td style={{ padding: '12px 20px', fontSize: '14px', fontWeight: 600, color: '#0F2044' }}>{exercise.name}</td>
                    <td style={{ padding: '12px 20px', fontSize: '16px', fontWeight: 800, color: '#0F2044' }}>
                      {weight ? `${weight}kg` : <span style={{ color: '#CBD5E1', fontWeight: 400, fontSize: '13px' }}>Not set</span>}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      {tested ? (
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: tested.is_competition ? 'rgba(184,137,26,0.1)' : 'rgba(22,163,74,0.08)', color: tested.is_competition ? '#B8891A' : '#16A34A', border: `1px solid ${tested.is_competition ? 'rgba(184,137,26,0.25)' : 'rgba(22,163,74,0.2)'}` }}>
                          {tested.is_competition ? 'Competition' : 'Tested'}
                        </span>
                      ) : estimated ? (
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}>Ratio</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '12px', color: '#94A3B8' }}>
                      {tested ? format(new Date(tested.tested_at + 'T12:00:00'), 'MMM d') : estimated?.source}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Max Modal */}
      {showAddModal && (
        <AddMaxModal
          athleteId={params.id}
          exercises={exercises.filter(e => e.has_1rm)}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); load() }}
        />
      )}

      {/* Calc from Reps Modal */}
      {showCalcModal && (
        <CalcFromRepsModal
          athleteId={params.id}
          exercises={exercises.filter(e => e.has_1rm)}
          onClose={() => setShowCalcModal(false)}
          onSaved={() => { setShowCalcModal(false); load() }}
        />
      )}
    </div>
  )
}

function AddMaxModal({ athleteId, exercises, onClose, onSaved }: {
  athleteId: string; exercises: Exercise[]
  onClose: () => void; onSaved: () => void
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F2044' }}>Add / Update Max</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}>×</button>
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
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 115" step="0.5" style={inp} />
            </div>
            <div>
              <label style={lbl}>Date Tested</label>
              <input type="date" value={testedAt} onChange={e => setTestedAt(e.target.value)} style={inp} />
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isComp} onChange={e => setIsComp(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#B8891A' }} />
              <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>This was a competition lift</span>
            </label>
          </div>
          <div>
            <label style={lbl}>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Hit depth, clean pull..." style={inp} />
          </div>
          {error && <div style={{ padding: '10px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Max →'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CalcFromRepsModal({ athleteId, exercises, onClose, onSaved }: {
  athleteId: string; exercises: Exercise[]
  onClose: () => void; onSaved: () => void
}) {
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Epley formula
  const estimated1RM = weight && reps && parseInt(reps) > 0
    ? Math.round(parseFloat(weight) * (1 + parseInt(reps) / 30))
    : null

  async function saveEstimate() {
    if (!exerciseId || !estimated1RM) return
    setSaving(true)
    await supabase.from('ra_one_rep_maxes').upsert({
      athlete_id: athleteId,
      exercise_id: exerciseId,
      weight_kg: estimated1RM,
      is_competition: false,
      tested_at: format(new Date(), 'yyyy-MM-dd'),
      notes: `Calculated from ${weight}kg × ${reps} reps (Epley formula)`
    }, { onConflict: 'athlete_id,exercise_id,tested_at' })
    onSaved()
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '11px', fontWeight: 600 as const, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(15,32,68,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F2044' }}>Calculate from Reps</h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Uses Epley formula to estimate 1RM</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}>×</button>
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
              <label style={lbl}>Weight Used (kg)</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 100" step="0.5" style={inp} />
            </div>
            <div>
              <label style={lbl}>Reps Completed</label>
              <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="e.g. 3" min="1" max="30" style={inp} />
            </div>
          </div>

          {estimated1RM && (
            <div style={{ padding: '16px 20px', background: 'rgba(15,32,68,0.04)', border: '1px solid rgba(15,32,68,0.1)', borderRadius: '8px', textAlign: 'center' as const }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Estimated 1RM</div>
              <div style={{ fontSize: '42px', fontWeight: 800, color: '#0F2044' }}>{estimated1RM}<span style={{ fontSize: '18px', color: '#94A3B8', fontWeight: 600 }}>kg</span></div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                {weight}kg × (1 + {reps}/30) = {estimated1RM}kg
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveEstimate} disabled={saving || !estimated1RM || !exerciseId} style={{ flex: 2, padding: '11px', background: (!estimated1RM || !exerciseId || saving) ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: (!estimated1RM || !exerciseId || saving) ? '#94A3B8' : '#FFFFFF', cursor: (!estimated1RM || !exerciseId || saving) ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : `Save ${estimated1RM ? estimated1RM + 'kg' : ''} as 1RM →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}