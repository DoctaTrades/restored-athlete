import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import CoachSidebar from '@/components/CoachSidebar'

const SUGGESTION_ICONS: Record<string, string> = {
  reduce_load: '⬇️',
  deload_week: '😴',
  rest_day: '🛌',
  reduce_intensity: '📉',
  soreness_warning: '🔴',
}

const SUGGESTION_TITLES: Record<string, string> = {
  reduce_load: 'Reduce Load',
  deload_week: 'Consider Deload Week',
  rest_day: 'Add Rest Day',
  reduce_intensity: 'Reduce Intensity',
  soreness_warning: 'Recovery Concern',
}

export default async function CoachSuggestionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('ra_profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'coach') redirect('/athlete/dashboard')

  const { data: suggestions } = await supabase
    .from('ra_program_suggestions')
    .select('*, athlete:ra_athletes(id, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email))')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  const pending = suggestions?.filter(s => s.status === 'pending') || []
  const reviewed = suggestions?.filter(s => s.status !== 'pending') || []

  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <CoachSidebar active="Suggestions" />
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>
            Program Suggestions
            {pending.length > 0 && <span style={{ marginLeft: '12px', padding: '3px 10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '20px', fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>{pending.length}</span>}
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>AI-detected patterns from athlete session logs. Review and act on each suggestion.</p>
        </div>

        {pending.length === 0 && reviewed.length === 0 ? (
          <div style={{ ...card, padding: '60px', textAlign: 'center' as const, color: '#94A3B8' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🤖</div>
            <p style={{ fontWeight: 600, color: '#475569', marginBottom: '4px' }}>No suggestions yet</p>
            <p style={{ fontSize: '13px' }}>Suggestions will appear here as athletes log sessions and patterns emerge.</p>
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Needs Review ({pending.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                  {pending.map(s => (
                    <div key={s.id} style={{ ...card, border: '1px solid rgba(184,137,26,0.3)' }}>
                      <div style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: '28px', flexShrink: 0 }}>{SUGGESTION_ICONS[s.suggestion_type]}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <div>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>{SUGGESTION_TITLES[s.suggestion_type]}</span>
                                <span style={{ marginLeft: '10px', fontSize: '12px', color: '#94A3B8' }}>
                                  {(s.athlete as any)?.profile?.full_name || (s.athlete as any)?.profile?.email}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{format(new Date(s.created_at), 'MMM d')}</span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#DC2626', fontWeight: 500, marginBottom: '6px' }}>{s.trigger_reason}</p>
                            <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, marginBottom: '14px' }}>{s.suggested_change}</p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a href={`/api/suggestions/${s.id}/approve`} style={{ padding: '8px 18px', background: '#16A34A', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', textDecoration: 'none', cursor: 'pointer' }}>
                                ✓ Approve
                              </a>
                              <a href={`/api/suggestions/${s.id}/dismiss`} style={{ padding: '8px 18px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', fontWeight: 600, color: '#64748B', textDecoration: 'none', cursor: 'pointer' }}>
                                Dismiss
                              </a>
                              <a href={`/coach/athletes/${(s.athlete as any)?.id}/maxboard`} style={{ padding: '8px 18px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', fontWeight: 600, color: '#B8891A', textDecoration: 'none' }}>
                                View Athlete →
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviewed */}
            {reviewed.length > 0 && (
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#94A3B8', marginBottom: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Reviewed</h2>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                  {reviewed.slice(0, 10).map(s => (
                    <div key={s.id} style={{ ...card, opacity: 0.7 }}>
                      <div style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px' }}>{SUGGESTION_ICONS[s.suggestion_type]}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{SUGGESTION_TITLES[s.suggestion_type]}</span>
                          <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '8px' }}>{(s.athlete as any)?.profile?.full_name}</span>
                        </div>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, background: s.status === 'approved' ? 'rgba(22,163,74,0.08)' : 'rgba(148,163,184,0.1)', color: s.status === 'approved' ? '#16A34A' : '#94A3B8', border: `1px solid ${s.status === 'approved' ? 'rgba(22,163,74,0.2)' : 'rgba(148,163,184,0.2)'}` }}>
                          {s.status}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{format(new Date(s.created_at), 'MMM d')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
      </div>
    </div>
  )
}