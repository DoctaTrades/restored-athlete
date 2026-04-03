'use client'

import { useEffect, useState, useCallback } from 'react'
import CoachSidebar from '@/components/CoachSidebar'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface Exercise {
  id: string; name: string; category: string; subcategory: string | null
  has_1rm: boolean; ratio_to_snatch: number | null
}
interface Block {
  id: string; order_index: number; sets: number | null; reps: string | null
  load_type: string; load_percentage: number | null; load_rpe: number | null
  load_kg: number | null; calculated_kg: number | null; notes: string | null
  exercise: Exercise
}
interface Session {
  id: string; scheduled_date: string; session_name: string | null
  target_rpe_low: number | null; target_rpe_high: number | null
  coach_notes: string | null; status: string
  athlete: { profile: { full_name: string; email: string } }
}
interface OneRM { exercise_id: string; weight_kg: number; exercise: Exercise }

const CATEGORIES = ['snatch', 'clean_jerk', 'squat', 'pull', 'press', 'accessory', 'mobility']
const CATEGORY_LABELS: Record<string, string> = {
  snatch: 'Snatch', clean_jerk: 'Clean & Jerk', squat: 'Squat',
  pull: 'Pulls', press: 'Press', accessory: 'Accessory', mobility: 'Mobility'
}

export default function SessionDetail({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<Session | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [oneRMs, setOneRMs] = useState<OneRM[]>([])
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('snatch')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: sessionData } = await supabase
      .from('ra_sessions')
      .select('*, athlete:ra_athletes(profile:ra_profiles(full_name, email))')
      .eq('id', params.id)
      .single()

    const { data: blockData } = await supabase
      .from('ra_session_blocks')
      .select('*, exercise:ra_exercises(*)')
      .eq('session_id', params.id)
      .order('order_index')

    const { data: exerciseData } = await supabase
      .from('ra_exercises')
      .select('*')
      .order('category')
      .order('name')

    // Get athlete's 1RMs
    if (sessionData?.athlete_id) {
      const { data: ormData } = await supabase
        .from('ra_one_rep_maxes')
        .select('exercise_id, weight_kg, exercise:ra_exercises(name)')
        .eq('athlete_id', sessionData.athlete_id)
        .order('tested_at', { ascending: false })
      setOneRMs((ormData as any) || [])
    }

    setSession(sessionData as any)
    setBlocks((blockData as any) || [])
    setExercises((exerciseData as any) || [])
    setLoading(false)
  }, [params.id])

  useEffect(() => { load() }, [load])

  function get1RM(exerciseId: string): number | null {
    const match = oneRMs.find(o => o.exercise_id === exerciseId)
    return match ? match.weight_kg : null
  }

  function calcKg(block: Partial<Block> & { exercise_id?: string }): number | null {
    if (block.load_type === 'absolute' && block.load_kg) return block.load_kg
    if (block.load_type === 'percentage' && block.load_percentage) {
      const orm = get1RM(block.exercise?.id || block.exercise_id || '')
      if (orm) return Math.round(orm * block.load_percentage / 100 / 2.5) * 2.5
    }
    return null
  }

  async function addExercise(exercise: Exercise) {
    const newBlock = {
      session_id: params.id,
      exercise_id: exercise.id,
      order_index: blocks.length,
      sets: 3,
      reps: '3',
      load_type: 'percentage',
      load_percentage: 75,
      load_rpe: null,
      load_kg: null,
      calculated_kg: null,
      notes: null
    }
    const { data } = await supabase
      .from('ra_session_blocks')
      .insert(newBlock)
      .select('*, exercise:ra_exercises(*)')
      .single()
    if (data) setBlocks(prev => [...prev, data as any])
    setShowExercisePicker(false)
  }

  async function updateBlock(blockId: string, updates: Partial<Block>) {
    const block = blocks.find(b => b.id === blockId)
    if (!block) return
    const merged = { ...block, ...updates }
    const calculated_kg = calcKg(merged as any)
    await supabase.from('ra_session_blocks').update({ ...updates, calculated_kg }).eq('id', blockId)
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...updates, calculated_kg } : b))
  }

  async function removeBlock(blockId: string) {
    await supabase.from('ra_session_blocks').delete().eq('id', blockId)
    setBlocks(prev => prev.filter(b => b.id !== blockId))
  }

  const filteredExercises = exercises.filter(e => {
    const matchesSearch = search ? e.name.toLowerCase().includes(search.toLowerCase()) : true
    const matchesCategory = search ? true : e.category === activeCategory
    return matchesSearch && matchesCategory
  })

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#4A6880', background: '#F8FAFC', minHeight: '100vh' }}>Loading session...</div>
  if (!session) return <div style={{ padding: '60px', textAlign: 'center', color: '#EF4444', background: '#F8FAFC', minHeight: '100vh' }}>Session not found</div>

  const inputStyle = { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#0F2044', fontSize: '13px', padding: '6px 10px', outline: 'none' } as React.CSSProperties

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <CoachSidebar active="Programming" />
      <div style={{ marginLeft: '240px', flex: 1, padding: '28px 32px' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a href="/coach/dashboard" style={{ color: '#94A3B8', textDecoration: 'none' }}>Athletes</a>
          <span>›</span>
          <a href="/coach/programming" style={{ color: '#94A3B8', textDecoration: 'none' }}>Programming</a>
          <span>›</span>
          <span style={{ color: '#0F2044', fontWeight: 600 }}>{session.session_name || 'Session'}</span>
          <span style={{ marginLeft: 'auto', color: '#64748B' }}>
            {session.athlete?.profile?.full_name || session.athlete?.profile?.email} · {format(new Date(session.scheduled_date + 'T12:00:00'), 'MMM d, yyyy')}
          </span>
        </div>
        <div style={{ maxWidth: '900px' }}>
        {/* Session info banner */}
        {(session.target_rpe_low || session.coach_notes) && (
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '24px' }}>
            {(session.target_rpe_low || session.target_rpe_high) && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px' }}>Target RPE</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#B8891A' }}>{session.target_rpe_low}–{session.target_rpe_high}</div>
              </div>
            )}
            {session.coach_notes && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px' }}>Coach Notes</div>
                <div style={{ fontSize: '13px', color: '#0F2044' }}>{session.coach_notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Blocks */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Exercises ({blocks.length})</h2>
          <button onClick={() => setShowExercisePicker(true)} style={{
            padding: '8px 18px', background: 'linear-gradient(135deg, #C19B30, #D4AF37)',
            border: 'none', borderRadius: '7px', color: '#0A1F4E',
            fontWeight: '700', fontSize: '13px', cursor: 'pointer'
          }}>+ Add Exercise</button>
        </div>

        {blocks.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#4A6880', border: '1px dashed #1E3A5F', borderRadius: '12px' }}>
            No exercises yet. Click <strong style={{ color: '#B8891A' }}>+ Add Exercise</strong> to build this session.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {blocks.map((block, idx) => {
              const orm = get1RM(block.exercise.id)
              const calcWeight = block.calculated_kg || calcKg(block as any)
              return (
                <div key={block.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Index */}
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#64748B', flexShrink: 0, marginTop: '2px' }}>
                      {idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      {/* Exercise name + category */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px' }}>{block.exercise.name}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(52,152,219,0.15)', border: '1px solid rgba(52,152,219,0.25)', color: '#3498DB', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>
                          {CATEGORY_LABELS[block.exercise.category]}
                        </span>
                        {orm && (
                          <span style={{ fontSize: '11px', color: '#64748B' }}>1RM: {orm}kg</span>
                        )}
                      </div>

                      {/* Sets / Reps / Load row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#4A6880', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Sets</label>
                          <input type="number" value={block.sets || ''} min={1} max={20}
                            onChange={e => updateBlock(block.id, { sets: parseInt(e.target.value) || null })}
                            style={{ ...inputStyle, width: '60px', textAlign: 'center' as const }} />
                        </div>
                        <div style={{ color: '#4A6880', marginTop: '16px' }}>×</div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#4A6880', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Reps</label>
                          <input type="text" value={block.reps || ''} placeholder="3"
                            onChange={e => updateBlock(block.id, { reps: e.target.value })}
                            style={{ ...inputStyle, width: '70px', textAlign: 'center' as const }} />
                        </div>

                        {/* Load type selector */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#4A6880', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Load Type</label>
                          <select value={block.load_type}
                            onChange={e => updateBlock(block.id, { load_type: e.target.value })}
                            style={{ ...inputStyle, width: '120px' }}>
                            <option value="percentage">% of 1RM</option>
                            <option value="rpe">RPE</option>
                            <option value="absolute">Absolute (kg)</option>
                          </select>
                        </div>

                        {block.load_type === 'percentage' && (
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', color: '#4A6880', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>%</label>
                            <input type="number" value={block.load_percentage || ''} min={1} max={110} step={2.5}
                              onChange={e => updateBlock(block.id, { load_percentage: parseFloat(e.target.value) || null })}
                              style={{ ...inputStyle, width: '70px', textAlign: 'center' as const }} />
                          </div>
                        )}
                        {block.load_type === 'rpe' && (
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', color: '#4A6880', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>RPE</label>
                            <input type="number" value={block.load_rpe || ''} min={5} max={10} step={0.5}
                              onChange={e => updateBlock(block.id, { load_rpe: parseFloat(e.target.value) || null })}
                              style={{ ...inputStyle, width: '70px', textAlign: 'center' as const }} />
                          </div>
                        )}
                        {block.load_type === 'absolute' && (
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', color: '#4A6880', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>kg</label>
                            <input type="number" value={block.load_kg || ''} min={0} step={2.5}
                              onChange={e => updateBlock(block.id, { load_kg: parseFloat(e.target.value) || null })}
                              style={{ ...inputStyle, width: '80px', textAlign: 'center' as const }} />
                          </div>
                        )}

                        {/* Calculated weight display */}
                        {calcWeight && block.load_type === 'percentage' && (
                          <div style={{ marginTop: '16px', padding: '6px 12px', background: 'rgba(193,155,48,0.1)', border: '1px solid rgba(193,155,48,0.2)', borderRadius: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#B8891A' }}>≈ {calcWeight}kg</span>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <div style={{ marginTop: '10px' }}>
                        <input type="text" value={block.notes || ''} placeholder="Notes (optional)..."
                          onChange={e => updateBlock(block.id, { notes: e.target.value || null })}
                          style={{ ...inputStyle, width: '100%' }} />
                      </div>
                    </div>

                    {/* Remove */}
                    <button onClick={() => removeBlock(block.id)} style={{
                      background: 'transparent', border: 'none', color: '#4A6880',
                      cursor: 'pointer', fontSize: '18px', padding: '4px', flexShrink: 0,
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.color = '#EF4444'}
                    onMouseLeave={e => (e.target as HTMLElement).style.color = '#4A6880'}
                    >×</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
          onClick={() => setShowExercisePicker(false)}>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>Add Exercise</h3>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search exercises..." autoFocus
                style={{ width: '100%', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F2044', fontSize: '14px', outline: 'none' }} />
            </div>

            {/* Category tabs - only show when not searching */}
            {!search && (
              <div style={{ display: 'flex', gap: '4px', padding: '12px 24px', borderBottom: '1px solid #E2E8F0', overflowX: 'auto', flexShrink: 0 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                    padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' as const,
                    background: activeCategory === cat ? 'rgba(193,155,48,0.2)' : '#0D1B2A',
                    color: activeCategory === cat ? '#C19B30' : '#8BA3BF',
                    outline: activeCategory === cat ? '1px solid rgba(193,155,48,0.4)' : '1px solid #1E3A5F'
                  }}>{CATEGORY_LABELS[cat]}</button>
                ))}
              </div>
            )}

            {/* Exercise list */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              {filteredExercises.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#4A6880' }}>No exercises found</div>
              ) : (
                filteredExercises.map(exercise => (
                  <button key={exercise.id} onClick={() => addExercise(exercise)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 24px', background: 'transparent',
                    border: 'none', color: '#0F2044', cursor: 'pointer', textAlign: 'left' as const,
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1C2E44'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{exercise.name}</div>
                      {exercise.description && (
                        <div style={{ fontSize: '12px', color: '#4A6880', marginTop: '2px' }}>{exercise.description}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginLeft: '12px' }}>
                      {exercise.has_1rm && <span style={{ fontSize: '10px', color: '#B8891A', border: '1px solid rgba(193,155,48,0.3)', padding: '2px 6px', borderRadius: '4px' }}>1RM</span>}
                      <span style={{ fontSize: '18px', color: '#4A6880' }}>+</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}