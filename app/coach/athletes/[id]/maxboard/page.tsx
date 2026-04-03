'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import CoachSidebar from '@/components/CoachSidebar'

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

