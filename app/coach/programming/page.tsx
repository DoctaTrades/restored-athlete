'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns'

interface Athlete { id: string; profile: { full_name: string; email: string } }
interface Session {
  id: string; athlete_id: string; scheduled_date: string
  session_name: string | null; status: string
  target_rpe_low: number | null; target_rpe_high: number | null
}

function Sidebar({ active }: { active: string }) {
  const links = [
    { label: 'Athletes', href: '/coach/dashboard', icon: '👥' },
    { label: 'Programming', href: '/coach/programming', icon: '📅' },
    { label: 'Nutrition', href: '/coach/nutrition', icon: '🥗' },
  ]
  return (
    <div style={{ width: '240px', background: '#0F2044', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0', flexShrink: 0, position: 'fixed', left: 0, top: 0, bottom: 0 }}>
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
          <a href="/athlete/dashboard" style={{ padding: '6px 14px', background: 'transparent', borderRadius: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Athlete</a>
        </div>
      </div>
    </div>
  )
}

export default function ProgrammingCalendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedDay, setSelectedDay] = useState<{ date: Date; athleteId: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: athleteData } = await supabase
        .from('ra_athletes')
        .select('id, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
        .eq('coach_id', user.id).eq('is_active', true)
      const { data: sessionData } = await supabase
        .from('ra_sessions')
        .select('id, athlete_id, scheduled_date, session_name, status, target_rpe_low, target_rpe_high')
        .gte('scheduled_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
      setAthletes((athleteData as any) || [])
      setSessions(sessionData || [])
      setLoading(false)
    }
    load()
  }, [currentWeek])

  function getSessionsForCell(athleteId: string, date: Date) {
    return sessions.filter(s => s.athlete_id === athleteId && s.scheduled_date === format(date, 'yyyy-MM-dd'))
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <Sidebar active="Programming" />
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '4px' }}>Programming</div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>
              {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {[
              { label: '← Prev', action: () => setCurrentWeek(subWeeks(currentWeek, 1)) },
              { label: 'Today', action: () => setCurrentWeek(new Date()) },
              { label: 'Next →', action: () => setCurrentWeek(addWeeks(currentWeek, 1)) },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{btn.label}</button>
            ))}
            <a href="/coach/athletes/new" style={{ padding: '8px 16px', background: '#B8891A', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', textDecoration: 'none', marginLeft: '4px' }}>+ Add Athlete</a>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#94A3B8' }}>Loading...</div>
        ) : athletes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#94A3B8', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>👤</div>
            <p style={{ marginBottom: '12px', fontWeight: 600, color: '#475569' }}>No athletes yet</p>
            <a href="/coach/athletes/new" style={{ color: '#B8891A', fontWeight: 600, textDecoration: 'none' }}>Add your first athlete →</a>
          </div>
        ) : (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ width: '160px', padding: '12px 16px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Athlete</th>
                  {days.map(day => {
                    const isToday = isSameDay(day, today)
                    return (
                      <th key={day.toISOString()} style={{ padding: '10px 8px', textAlign: 'center' as const, borderLeft: '1px solid #F1F5F9', background: isToday ? 'rgba(184,137,26,0.04)' : 'transparent' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: isToday ? '#B8891A' : '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{format(day, 'EEE')}</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: isToday ? '#B8891A' : '#0F2044', lineHeight: 1.2 }}>{format(day, 'd')}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {athletes.map((athlete, idx) => (
                  <tr key={athlete.id} style={{ borderBottom: idx < athletes.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '10px 16px', verticalAlign: 'top' as const }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#0F2044' }}>{athlete.profile?.full_name || athlete.profile?.email}</div>
                    </td>
                    {days.map(day => {
                      const cellSessions = getSessionsForCell(athlete.id, day)
                      const isToday = isSameDay(day, today)
                      return (
                        <td key={day.toISOString()} style={{ padding: '6px', borderLeft: '1px solid #F1F5F9', verticalAlign: 'top' as const, minWidth: '120px', background: isToday ? 'rgba(184,137,26,0.02)' : 'transparent' }}>
                          <div style={{ minHeight: '60px', display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                            {cellSessions.map(session => (
                              <a key={session.id} href={`/coach/sessions/${session.id}`} style={{
                                display: 'block', padding: '6px 8px', textDecoration: 'none',
                                background: session.status === 'completed' ? 'rgba(22,163,74,0.08)' : 'rgba(15,32,68,0.06)',
                                border: `1px solid ${session.status === 'completed' ? 'rgba(22,163,74,0.2)' : 'rgba(15,32,68,0.12)'}`,
                                borderRadius: '6px', borderLeft: `3px solid ${session.status === 'completed' ? '#16A34A' : '#0F2044'}`
                              }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F2044', lineHeight: 1.3 }}>{session.session_name || 'Session'}</div>
                                {(session.target_rpe_low || session.target_rpe_high) && (
                                  <div style={{ fontSize: '10px', color: '#B8891A', marginTop: '1px', fontWeight: 500 }}>RPE {session.target_rpe_low}–{session.target_rpe_high}</div>
                                )}
                              </a>
                            ))}
                            <button onClick={() => { setSelectedDay({ date: day, athleteId: athlete.id }); setShowModal(true) }}
                              style={{ padding: '4px', border: '1px dashed #CBD5E1', borderRadius: '6px', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', fontSize: '16px', lineHeight: 1, transition: 'all 0.15s' }}
                              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = '#B8891A'; (e.target as HTMLElement).style.color = '#B8891A' }}
                              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = '#CBD5E1'; (e.target as HTMLElement).style.color = '#CBD5E1' }}
                            >+</button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selectedDay && (
        <AddSessionModal
          date={selectedDay.date}
          athleteId={selectedDay.athleteId}
          athleteName={athletes.find(a => a.id === selectedDay.athleteId)?.profile?.full_name || 'Athlete'}
          onClose={() => { setShowModal(false); setSelectedDay(null) }}
          onSaved={(newSession) => { setSessions(prev => [...prev, newSession]); setShowModal(false); setSelectedDay(null) }}
        />
      )}
    </div>
  )
}

function AddSessionModal({ date, athleteId, athleteName, onClose, onSaved }: {
  date: Date; athleteId: string; athleteName: string
  onClose: () => void; onSaved: (s: Session) => void
}) {
  const [name, setName] = useState('')
  const [rpeLow, setRpeLow] = useState('')
  const [rpeHigh, setRpeHigh] = useState('')
  const [coachNotes, setCoachNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function save() {
    setSaving(true)
    setError(null)
    const { data, error } = await supabase.from('ra_sessions').insert({
      athlete_id: athleteId,
      scheduled_date: format(date, 'yyyy-MM-dd'),
      session_name: name || null,
      target_rpe_low: rpeLow ? parseFloat(rpeLow) : null,
      target_rpe_high: rpeHigh ? parseFloat(rpeHigh) : null,
      coach_notes: coachNotes || null,
      status: 'planned'
    }).select().single()
    if (error) { setError(error.message); setSaving(false) }
    else { onSaved(data) }
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' } as React.CSSProperties

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(15,32,68,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F2044' }}>Add Session</h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>{athleteName} · {format(date, 'EEEE, MMMM d')}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
          <div>
            <label style={lbl}>Session Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Heavy Snatch + Back Squat" style={inp} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>RPE Low</label>
              <input value={rpeLow} onChange={e => setRpeLow(e.target.value)} placeholder="7.0" type="number" min="1" max="10" step="0.5" style={inp} />
            </div>
            <div>
              <label style={lbl}>RPE High</label>
              <input value={rpeHigh} onChange={e => setRpeHigh(e.target.value)} placeholder="8.5" type="number" min="1" max="10" step="0.5" style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Coach Notes</label>
            <textarea value={coachNotes} onChange={e => setCoachNotes(e.target.value)} placeholder="Cues, focus points, anything for the athlete..." rows={3} style={{ ...inp, resize: 'vertical' as const }} />
          </div>
          {error && <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Session →'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
