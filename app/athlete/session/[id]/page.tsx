'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import AthleteNav from '@/components/AthleteNav'

interface Exercise { id: string; name: string; category: string }
interface Block {
  id: string; order_index: number; sets: number | null; reps: string | null
  load_type: string; load_percentage: number | null; load_rpe: number | null
  load_kg: number | null; calculated_kg: number | null; notes: string | null
  exercise: Exercise
}
interface SessionLog {
  block_id: string; sets_completed: number | null; reps_completed: string | null
  weight_kg: number | null; actual_rpe: number | null; misses: number
  miss_notes: string | null; athlete_notes: string | null
}
interface ExtraWork { exercise_name: string; sets: string; reps: string; weight_kg: string; notes: string }
interface Session {
  id: string; scheduled_date: string; session_name: string | null
  target_rpe_low: number | null; target_rpe_high: number | null
  coach_notes: string | null; status: string; athlete_id: string | null
}

const RPE_LABELS: Record<number, string> = {
  1: 'No effort', 2: 'Very light', 3: 'Light', 4: 'Somewhat easy',
  5: 'Moderate — many reps left', 6: 'Somewhat hard — 4+ reps left',
  7: 'Hard — 3 reps left', 7.5: '2–3 reps left',
  8: 'Very hard — 2 reps left', 8.5: '1–2 reps left',
  9: 'Near max — 1 rep left', 9.5: 'Could maybe do 1 more',
  10: 'Absolute max'
}
const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10]

const SORENESS_LABELS: Record<number, string> = {
  1: 'None', 2: 'Very mild', 3: 'Mild', 4: 'Noticeable',
  5: 'Moderate', 6: 'Significant', 7: 'Quite sore',
  8: 'Very sore — affecting movement', 9: 'Severely sore', 10: 'Debilitating'
}

async function runSuggestionEngine(supabase: any, sessionId: string, athleteId: string, coachId: string) {
  // Get last 10 session logs for this athlete
  const { data: recentLogs } = await supabase
    .from('ra_session_logs')
    .select('*, session:ra_sessions(scheduled_date)')
    .eq('athlete_id', athleteId)
    .order('logged_at', { ascending: false })
    .limit(50)

  if (!recentLogs?.length) return

  const suggestions: any[] = []

  // 1. Check consecutive misses per exercise
  const byBlock: Record<string, any[]> = {}
  recentLogs.filter((l: any) => l.block_id).forEach((l: any) => {
    if (!byBlock[l.block_id]) byBlock[l.block_id] = []
    byBlock[l.block_id].push(l)
  })
  for (const [blockId, logs] of Object.entries(byBlock)) {
    const recent3 = logs.slice(0, 3)
    if (recent3.length >= 3 && recent3.every((l: any) => (l.misses || 0) >= 1)) {
      suggestions.push({
        athlete_id: athleteId, coach_id: coachId,
        suggestion_type: 'reduce_load',
        trigger_reason: `3 consecutive sessions with misses on this exercise`,
        suggested_change: 'Consider reducing load by 5–10% for the next 2 sessions to rebuild confidence and motor pattern.',
        status: 'pending'
      })
    }
  }

  // 2. Check avg fatigue last 5 sessions
  const fatigueScores = recentLogs.filter((l: any) => l.session_fatigue_score).slice(0, 5).map((l: any) => l.session_fatigue_score)
  if (fatigueScores.length >= 5) {
    const avg = fatigueScores.reduce((a: number, b: number) => a + b, 0) / fatigueScores.length
    if (avg >= 8) {
      suggestions.push({
        athlete_id: athleteId, coach_id: coachId,
        suggestion_type: 'deload_week',
        trigger_reason: `Average session fatigue of ${avg.toFixed(1)}/10 over last 5 sessions`,
        suggested_change: 'Athlete may be accumulating excessive fatigue. Consider a deload week — reduce volume by 40% and intensity by 10–15%.',
        status: 'pending'
      })
    }
  }

  // 3. Check soreness scores
  const sorenessScores = recentLogs.filter((l: any) => l.soreness_score).slice(0, 3).map((l: any) => l.soreness_score)
  if (sorenessScores.length >= 3 && sorenessScores.every((s: number) => s >= 4)) {
    const avg = sorenessScores.reduce((a: number, b: number) => a + b, 0) / sorenessScores.length
    suggestions.push({
      athlete_id: athleteId, coach_id: coachId,
      suggestion_type: 'soreness_warning',
      trigger_reason: `Persistent soreness averaging ${avg.toFixed(1)}/10 for 3+ consecutive sessions`,
      suggested_change: 'Athlete is not recovering adequately between sessions. Consider an active recovery day, reduced intensity, or reviewing sleep and nutrition.',
      status: 'pending'
    })
  }

  // 4. RPE consistently above prescribed
  const highRPE = recentLogs.filter((l: any) => l.actual_rpe && l.actual_rpe >= 9.5).slice(0, 4)
  if (highRPE.length >= 3) {
    suggestions.push({
      athlete_id: athleteId, coach_id: coachId,
      suggestion_type: 'reduce_intensity',
      trigger_reason: `RPE at or near max (≥9.5) in ${highRPE.length} of last ${Math.min(recentLogs.length, 4)} sessions`,
      suggested_change: 'Training intensity may be too high. Consider reducing prescribed percentages by 5% or shifting to RPE-based loading.',
      status: 'pending'
    })
  }

  // Insert suggestions (avoid duplicates by checking recent ones)
  if (suggestions.length) {
    const { data: existing } = await supabase
      .from('ra_program_suggestions')
      .select('suggestion_type')
      .eq('athlete_id', athleteId)
      .eq('status', 'pending')

    const existingTypes = new Set((existing || []).map((s: any) => s.suggestion_type))
    const newSuggestions = suggestions.filter(s => !existingTypes.has(s.suggestion_type))
    if (newSuggestions.length) {
      await supabase.from('ra_program_suggestions').insert(newSuggestions)
    }
  }
}

export default function AthleteSessionPage({ params }: { params: { id: string } }) {
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [athleteName, setAthleteName] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [logs, setLogs] = useState<Record<string, SessionLog>>({})
  const [extraWork, setExtraWork] = useState<ExtraWork[]>([])
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [sessionFatigue, setSessionFatigue] = useState<number | null>(null)
  const [sorenessScore, setSorenessScore] = useState<number | null>(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profileData } = await supabase
      .from('ra_profiles').select('full_name, email').eq('id', user.id).maybeSingle()

    const { data: athleteData } = await supabase
      .from('ra_athletes').select('id, coach_id').eq('profile_id', user.id).maybeSingle()

    if (!athleteData) { setLoading(false); return }
    setAthleteId(athleteData.id)
    setCoachId(athleteData.coach_id)
    setAthleteName((profileData as any)?.full_name || (profileData as any)?.email || 'Athlete')

    const { data: sessionData } = await supabase
      .from('ra_sessions').select('*').eq('id', params.id).maybeSingle()

    const { data: blockData } = await supabase
      .from('ra_session_blocks').select('*, exercise:ra_exercises(*)')
      .eq('session_id', params.id).order('order_index')

    const { data: existingLogs } = await supabase
      .from('ra_session_logs').select('*')
      .eq('session_id', params.id).eq('athlete_id', athleteData.id)

    const { data: exerciseData } = await supabase
      .from('ra_exercises').select('id, name, category').order('category').order('name')

    setSession(sessionData as any)
    setBlocks((blockData as any) || [])
    setExercises((exerciseData as any) || [])
    setCompleted(sessionData?.status === 'completed')

    const logMap: Record<string, SessionLog> = {}
    if (existingLogs) {
      existingLogs.forEach((log: any) => {
        if (log.block_id) {
          logMap[log.block_id] = {
            block_id: log.block_id, sets_completed: log.sets_completed,
            reps_completed: log.reps_completed, weight_kg: log.weight_kg,
            actual_rpe: log.actual_rpe, misses: log.misses || 0,
            miss_notes: log.miss_notes, athlete_notes: log.athlete_notes,
          }
        }
        if (log.session_fatigue_score) setSessionFatigue(log.session_fatigue_score)
        if (log.soreness_score) setSorenessScore(log.soreness_score)
        if (log.athlete_notes && !log.block_id) setSessionNotes(log.athlete_notes)
      })
    }
    setLogs(logMap)

    const firstUnlogged = (blockData as any)?.find((b: Block) => !logMap[b.id])
    if (firstUnlogged) setActiveBlock(firstUnlogged.id)
    else if (blockData?.length) setActiveBlock((blockData as any)[0].id)

    setLoading(false)
  }, [params.id])

  useEffect(() => { load() }, [load])

  function updateLog(blockId: string, field: keyof SessionLog, value: any) {
    setLogs(prev => ({ ...prev, [blockId]: { ...prev[blockId], block_id: blockId, [field]: value } }))
  }

  function getLog(blockId: string): SessionLog {
    return logs[blockId] || { block_id: blockId, sets_completed: null, reps_completed: null, weight_kg: null, actual_rpe: null, misses: 0, miss_notes: null, athlete_notes: null }
  }

  function isBlockLogged(blockId: string): boolean {
    const log = logs[blockId]
    return !!(log?.actual_rpe || log?.weight_kg)
  }

  const loggedCount = blocks.filter(b => isBlockLogged(b.id)).length
  const progress = blocks.length > 0 ? Math.round((loggedCount / blocks.length) * 100) : 0

  async function saveBlockLog(blockId: string) {
    if (!athleteId) return
    const log = getLog(blockId)
    await supabase.from('ra_session_logs').upsert({
      session_id: params.id, block_id: blockId, athlete_id: athleteId,
      sets_completed: log.sets_completed, reps_completed: log.reps_completed,
      weight_kg: log.weight_kg, actual_rpe: log.actual_rpe,
      misses: log.misses || 0, miss_notes: log.miss_notes, athlete_notes: log.athlete_notes,
    }, { onConflict: 'session_id,block_id,athlete_id' } as any)
    const currentIdx = blocks.findIndex(b => b.id === blockId)
    if (currentIdx < blocks.length - 1) setActiveBlock(blocks[currentIdx + 1].id)
    else setActiveBlock(null)
  }

  function addExtraWork(exercise: Exercise) {
    setExtraWork(prev => [...prev, { exercise_name: exercise.name, sets: '', reps: '', weight_kg: '', notes: '' }])
    setShowExercisePicker(false)
    setExerciseSearch('')
  }

  function addFreeTextExtra() {
    setExtraWork(prev => [...prev, { exercise_name: '', sets: '', reps: '', weight_kg: '', notes: '' }])
    setShowExercisePicker(false)
  }

  function updateExtra(idx: number, field: keyof ExtraWork, value: string) {
    setExtraWork(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  async function completeSession() {
    if (!athleteId || !coachId) return
    setCompleting(true)

    for (const block of blocks) {
      const log = getLog(block.id)
      if (log.weight_kg || log.actual_rpe) {
        await supabase.from('ra_session_logs').upsert({
          session_id: params.id, block_id: block.id, athlete_id: athleteId,
          sets_completed: log.sets_completed, reps_completed: log.reps_completed,
          weight_kg: log.weight_kg, actual_rpe: log.actual_rpe,
          misses: log.misses || 0, miss_notes: log.miss_notes, athlete_notes: log.athlete_notes,
          session_fatigue_score: sessionFatigue, soreness_score: sorenessScore,
        }, { onConflict: 'session_id,block_id,athlete_id' } as any)
      }
    }

    // Save session-level log
    await supabase.from('ra_session_logs').upsert({
      session_id: params.id, athlete_id: athleteId,
      session_fatigue_score: sessionFatigue, soreness_score: sorenessScore,
      athlete_notes: sessionNotes || null,
    }, { onConflict: 'session_id,athlete_id' } as any)

    // Save extra work as notes
    if (extraWork.filter(e => e.exercise_name).length > 0) {
      const extraNotes = extraWork.filter(e => e.exercise_name).map(e =>
        `EXTRA: ${e.exercise_name} ${e.sets}x${e.reps}${e.weight_kg ? ` @ ${e.weight_kg}kg` : ''}${e.notes ? ` — ${e.notes}` : ''}`
      ).join('\n')
      await supabase.from('ra_session_logs').upsert({
        session_id: params.id, athlete_id: athleteId,
        athlete_notes: [sessionNotes, extraNotes].filter(Boolean).join('\n'),
        session_fatigue_score: sessionFatigue, soreness_score: sorenessScore,
      }, { onConflict: 'session_id,athlete_id' } as any)
    }

    await supabase.from('ra_sessions').update({ status: 'completed' }).eq('id', params.id)

    // Run AI suggestion engine
    await runSuggestionEngine(supabase, params.id, athleteId, coachId)

    setCompleted(true)
    setCompleting(false)
  }

  const inp = { padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ height: '100px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} />
      <div style={{ padding: '60px', textAlign: 'center' as const, color: '#94A3B8' }}>Loading session...</div>
    </div>
  )

  if (!session) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ height: '100px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} />
      <div style={{ padding: '60px', textAlign: 'center' as const, color: '#DC2626' }}>Session not found.</div>
    </div>
  )

  if (completed) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <AthleteNav active="today" athleteName={athleteName} />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 20px', textAlign: 'center' as const }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F2044', marginBottom: '8px' }}>Session Complete!</h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '32px' }}>
          {session.session_name || 'Training session'} — {format(new Date(session.scheduled_date + 'T12:00:00'), 'MMMM d')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
          {sessionFatigue && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '4px' }}>Fatigue</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: sessionFatigue >= 8 ? '#DC2626' : sessionFatigue >= 6 ? '#D97706' : '#16A34A' }}>{sessionFatigue}/10</div>
            </div>
          )}
          {sorenessScore && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '4px' }}>Soreness</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: sorenessScore >= 7 ? '#DC2626' : sorenessScore >= 4 ? '#D97706' : '#16A34A' }}>{sorenessScore}/10</div>
            </div>
          )}
        </div>
        <a href="/athlete/dashboard" style={{ display: 'inline-block', padding: '13px 32px', background: '#0F2044', borderRadius: '8px', fontSize: '14px', fontWeight: 700, color: '#FFFFFF', textDecoration: 'none' }}>
          Back to Dashboard →
        </a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <AthleteNav active="today" athleteName={athleteName} />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <a href="/athlete/dashboard" style={{ fontSize: '12px', color: '#94A3B8', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }}>← Back</a>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F2044' }}>{session.session_name || 'Training Session'}</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>{format(new Date(session.scheduled_date + 'T12:00:00'), 'EEEE, MMMM d')}</p>
        </div>

        {/* Progress */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>{loggedCount} of {blocks.length} logged</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: progress === 100 ? '#16A34A' : '#B8891A' }}>{progress}%</span>
          </div>
          <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#16A34A' : '#B8891A', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
        </div>

        {(session.target_rpe_low || session.target_rpe_high) && (
          <div style={{ padding: '12px 16px', background: 'rgba(184,137,26,0.06)', border: '1px solid rgba(184,137,26,0.2)', borderRadius: '10px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span>⚡</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#B8891A' }}>Target RPE: {session.target_rpe_low}–{session.target_rpe_high}</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Listen to your body — a lower RPE on a fatigued day is always the right call.</div>
            </div>
          </div>
        )}

        {session.coach_notes && (
          <div style={{ padding: '10px 14px', background: '#F8FAFC', borderLeft: '3px solid #0F2044', borderRadius: '0 8px 8px 0', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '3px' }}>Coach Notes</div>
            <div style={{ fontSize: '13px', color: '#334155' }}>{session.coach_notes}</div>
          </div>
        )}

        {/* Exercise blocks */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '20px' }}>
          {blocks.map((block, idx) => {
            const log = getLog(block.id)
            const isActive = activeBlock === block.id
            const isLogged = isBlockLogged(block.id)

            return (
              <div key={block.id} style={{ background: '#FFFFFF', border: `1.5px solid ${isActive ? '#0F2044' : isLogged ? 'rgba(22,163,74,0.3)' : '#E2E8F0'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                <button onClick={() => setActiveBlock(isActive ? null : block.id)}
                  style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: isLogged ? '#16A34A' : isActive ? '#0F2044' : '#F1F5F9', color: isLogged || isActive ? '#FFFFFF' : '#94A3B8' }}>
                    {isLogged ? '✓' : idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>{block.exercise?.name}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>
                      {block.sets} × {block.reps}
                      {block.load_type === 'percentage' && block.load_percentage && ` @ ${block.load_percentage}%`}
                      {block.load_type === 'rpe' && block.load_rpe && ` @ RPE ${block.load_rpe}`}
                      {block.calculated_kg && <span style={{ color: '#B8891A', fontWeight: 600 }}> ≈ {block.calculated_kg}kg</span>}
                    </div>
                  </div>
                  {isLogged && (
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      {log.weight_kg && <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F2044' }}>{log.weight_kg}kg</div>}
                      {log.actual_rpe && <div style={{ fontSize: '12px', color: '#B8891A', fontWeight: 600 }}>RPE {log.actual_rpe}</div>}
                      {(log.misses || 0) > 0 && <div style={{ fontSize: '11px', color: '#DC2626' }}>{log.misses} miss{log.misses !== 1 ? 'es' : ''}</div>}
                    </div>
                  )}
                  <span style={{ color: '#94A3B8', fontSize: '14px' }}>{isActive ? '▲' : '▼'}</span>
                </button>

                {isActive && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F1F5F9' }}>
                    <div style={{ paddingTop: '14px' }}>
                      {block.notes && (
                        <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', fontSize: '12px', color: '#64748B', marginBottom: '14px', borderLeft: '3px solid #CBD5E1' }}>
                          {block.notes}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }}>Weight (kg)</label>
                          <input type="number" value={log.weight_kg || ''} onChange={e => updateLog(block.id, 'weight_kg', parseFloat(e.target.value) || null)}
                            placeholder={block.calculated_kg ? `${block.calculated_kg}` : '—'} step="0.5"
                            style={{ ...inp, width: '100%', fontSize: '18px', fontWeight: 700 }} autoFocus={isActive} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }}>Sets Done</label>
                          <input type="number" value={log.sets_completed || ''} onChange={e => updateLog(block.id, 'sets_completed', parseInt(e.target.value) || null)}
                            placeholder={block.sets ? `${block.sets}` : '3'} min="0" max="20"
                            style={{ ...inp, width: '100%' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }}>Reps Done</label>
                          <input type="text" value={log.reps_completed || ''} onChange={e => updateLog(block.id, 'reps_completed', e.target.value || null)}
                            placeholder={block.reps || '3'} style={{ ...inp, width: '100%' }} />
                        </div>
                      </div>

                      {/* Full RPE 1-10 */}
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>
                          RPE {log.actual_rpe ? <span style={{ color: '#B8891A', textTransform: 'none' as const, fontWeight: 400 }}>— {RPE_LABELS[log.actual_rpe]}</span> : ''}
                        </label>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' as const }}>
                          {RPE_OPTIONS.map(rpe => (
                            <button key={rpe} onClick={() => updateLog(block.id, 'actual_rpe', rpe)}
                              style={{ padding: '7px 8px', borderRadius: '6px', border: '1.5px solid', fontSize: '12px', fontWeight: 700, cursor: 'pointer', minWidth: '44px', transition: 'all 0.1s', borderColor: log.actual_rpe === rpe ? '#0F2044' : '#E2E8F0', background: log.actual_rpe === rpe ? '#0F2044' : '#FFFFFF', color: log.actual_rpe === rpe ? '#FFFFFF' : '#475569' }}>
                              {rpe}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Misses */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', marginBottom: '14px', alignItems: 'start' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }}>Misses</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button onClick={() => updateLog(block.id, 'misses', Math.max(0, (log.misses || 0) - 1))} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', fontSize: '16px' }}>−</button>
                            <span style={{ fontSize: '18px', fontWeight: 800, color: (log.misses || 0) > 0 ? '#DC2626' : '#0F2044', minWidth: '20px', textAlign: 'center' as const }}>{log.misses || 0}</span>
                            <button onClick={() => updateLog(block.id, 'misses', (log.misses || 0) + 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', fontSize: '16px' }}>+</button>
                          </div>
                        </div>
                        {(log.misses || 0) > 0 && (
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }}>Miss notes</label>
                            <input value={log.miss_notes || ''} onChange={e => updateLog(block.id, 'miss_notes', e.target.value || null)}
                              placeholder="e.g. forward lean, no hip drive..." style={{ ...inp, width: '100%' }} />
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }}>Notes</label>
                        <input value={log.athlete_notes || ''} onChange={e => updateLog(block.id, 'athlete_notes', e.target.value || null)}
                          placeholder="How did it feel?" style={{ ...inp, width: '100%' }} />
                      </div>

                      <button onClick={() => saveBlockLog(block.id)} style={{ width: '100%', padding: '12px', background: '#0F2044', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
                        Log {idx < blocks.length - 1 ? '→ Next Exercise' : '→ Finish Exercises'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Extra Work */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '14px 18px', borderBottom: extraWork.length > 0 ? '1px solid #F1F5F9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Extra Work</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>Add any additional exercises you did today</div>
            </div>
            <button onClick={() => setShowExercisePicker(true)} style={{ padding: '7px 14px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>+ Add</button>
          </div>
          {extraWork.map((extra, idx) => (
            <div key={idx} style={{ padding: '14px 18px', borderBottom: idx < extraWork.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input value={extra.exercise_name} onChange={e => updateExtra(idx, 'exercise_name', e.target.value)}
                  placeholder="Exercise name" style={{ ...inp, fontSize: '13px' }} />
                <input value={extra.sets} onChange={e => updateExtra(idx, 'sets', e.target.value)}
                  placeholder="Sets" style={{ ...inp, fontSize: '13px' }} />
                <input value={extra.reps} onChange={e => updateExtra(idx, 'reps', e.target.value)}
                  placeholder="Reps" style={{ ...inp, fontSize: '13px' }} />
                <input value={extra.weight_kg} onChange={e => updateExtra(idx, 'weight_kg', e.target.value)}
                  placeholder="kg" style={{ ...inp, fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={extra.notes} onChange={e => updateExtra(idx, 'notes', e.target.value)}
                  placeholder="Notes (optional)" style={{ ...inp, flex: 1, fontSize: '13px' }} />
                <button onClick={() => setExtraWork(prev => prev.filter((_, i) => i !== idx))}
                  style={{ padding: '0 12px', background: 'none', border: '1px solid #E2E8F0', borderRadius: '7px', color: '#DC2626', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>
            </div>
          ))}
        </div>

        {/* Session wrap-up */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044', marginBottom: '16px' }}>Session Wrap-Up</h2>

          {/* Fatigue */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>
              CNS / Energy Fatigue {sessionFatigue ? `— ${sessionFatigue}/10` : ''}
              {sessionFatigue && <span style={{ color: '#94A3B8', fontWeight: 400, textTransform: 'none' as const, marginLeft: '6px' }}>({sessionFatigue <= 3 ? 'Fresh' : sessionFatigue <= 6 ? 'Moderately fatigued' : sessionFatigue <= 8 ? 'Very fatigued' : 'Exhausted'})</span>}
            </label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setSessionFatigue(n)} style={{ flex: 1, padding: '10px 2px', borderRadius: '6px', border: '1.5px solid', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderColor: sessionFatigue === n ? (n >= 8 ? '#DC2626' : n >= 6 ? '#D97706' : '#16A34A') : '#E2E8F0', background: sessionFatigue === n ? (n >= 8 ? 'rgba(220,38,38,0.08)' : n >= 6 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)') : '#FFFFFF', color: sessionFatigue === n ? (n >= 8 ? '#DC2626' : n >= 6 ? '#D97706' : '#16A34A') : '#94A3B8' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: '#16A34A' }}>Fresh</span>
              <span style={{ fontSize: '11px', color: '#DC2626' }}>Exhausted</span>
            </div>
          </div>

          {/* Soreness */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>
              Muscle Soreness / DOMS {sorenessScore ? `— ${sorenessScore}/10` : ''}
              {sorenessScore && <span style={{ color: '#94A3B8', fontWeight: 400, textTransform: 'none' as const, marginLeft: '6px' }}>({SORENESS_LABELS[sorenessScore]})</span>}
            </label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setSorenessScore(n)} style={{ flex: 1, padding: '10px 2px', borderRadius: '6px', border: '1.5px solid', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderColor: sorenessScore === n ? (n >= 7 ? '#DC2626' : n >= 4 ? '#D97706' : '#16A34A') : '#E2E8F0', background: sorenessScore === n ? (n >= 7 ? 'rgba(220,38,38,0.08)' : n >= 4 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)') : '#FFFFFF', color: sorenessScore === n ? (n >= 7 ? '#DC2626' : n >= 4 ? '#D97706' : '#16A34A') : '#94A3B8' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: '#16A34A' }}>No soreness</span>
              <span style={{ fontSize: '11px', color: '#DC2626' }}>Severely sore</span>
            </div>
            {sorenessScore && sorenessScore >= 7 && (
              <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: '6px', fontSize: '12px', color: '#DC2626' }}>
                High soreness logged — your coach will be notified to review your recovery.
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>Session Notes</label>
            <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
              placeholder="Sleep, stress, how you felt overall, anything relevant for your coach..." rows={3}
              style={{ ...inp, width: '100%', resize: 'vertical' as const }} />
          </div>

          <button onClick={completeSession} disabled={completing} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: completing ? 'not-allowed' : 'pointer', background: completing ? '#E2E8F0' : '#16A34A', color: completing ? '#94A3B8' : '#FFFFFF' }}>
            {completing ? 'Saving...' : '✓ Complete Session'}
          </button>
        </div>
      </div>

      {/* Exercise picker modal */}
      {showExercisePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '20px' }} onClick={() => setShowExercisePicker(false)}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '600px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F2044', marginBottom: '10px' }}>Add Extra Exercise</h3>
              <input value={exerciseSearch} onChange={e => setExerciseSearch(e.target.value)} placeholder="Search exercises..." autoFocus
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <button onClick={addFreeTextExtra} style={{ width: '100%', padding: '12px 20px', background: 'rgba(184,137,26,0.04)', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '18px' }}>✏️</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#B8891A' }}>Type exercise manually</span>
              </button>
              {exercises.filter(e => !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase())).map(exercise => (
                <button key={exercise.id} onClick={() => addExtraWork(exercise)}
                  style={{ width: '100%', padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#0F2044' }}>{exercise.name}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'capitalize' as const }}>{exercise.category.replace('_', ' ')}</div>
                  </div>
                  <span style={{ color: '#94A3B8', fontSize: '18px' }}>+</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
