import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'

export default async function CoachDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('ra_profiles')
    .select('*')
    .eq('id', user!.id)
    .maybeSingle()

  if (!profile || profile.role !== 'coach') redirect('/athlete/dashboard')

  const { data: athletes } = await supabase
    .from('ra_athletes')
    .select('*, profile:ra_profiles(*)')
    .eq('coach_id', user!.id)
    .eq('is_active', true)

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: weekSessions } = await supabase
    .from('ra_sessions')
    .select('*, athlete:ra_athletes(*, profile:ra_profiles(*))')
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd)
    .order('scheduled_date')

  const todayCount = weekSessions?.filter(s => s.scheduled_date === today).length || 0
  const completedCount = weekSessions?.filter(s => s.status === 'completed').length || 0

  return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', color: '#F0F4F8' }}>
      {/* Nav */}
      <nav style={{
        padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #1E3A5F', background: '#0A1F4E'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #C19B30, #D4AF37)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '900', color: '#0A1F4E'
          }}>RA</div>
          <span style={{ fontSize: '16px', fontWeight: '700' }}>Restored Athlete</span>
          <span style={{
            padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
            background: 'rgba(193,155,48,0.15)', border: '1px solid rgba(193,155,48,0.3)',
            color: '#C19B30', textTransform: 'uppercase' as const, letterSpacing: '0.5px'
          }}>Coach</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#8BA3BF' }}>{profile.full_name || profile.email}</span>
          <a href="/auth/signout" style={{
            padding: '6px 14px', border: '1px solid #1E3A5F', borderRadius: '6px',
            fontSize: '13px', color: '#8BA3BF', textDecoration: 'none'
          }}>Sign out</a>
        </div>
      </nav>

      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>Coach Dashboard</h1>
          <p style={{ color: '#8BA3BF', marginTop: '4px' }}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Active Athletes', value: athletes?.length || 0, color: '#3498DB' },
            { label: "Today's Sessions", value: todayCount, color: '#C19B30' },
            { label: 'Completed This Week', value: completedCount, color: '#10B981' },
            { label: 'Week Total', value: weekSessions?.length || 0, color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ fontSize: '32px', fontWeight: '800', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: '#8BA3BF', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Athletes list */}
          <div style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1E3A5F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Athletes</h2>
              <a href="/coach/athletes/new" style={{
                padding: '6px 14px', background: 'linear-gradient(135deg, #C19B30, #D4AF37)',
                borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#0A1F4E', textDecoration: 'none'
              }}>+ Add Athlete</a>
            </div>
            {!athletes?.length ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#4A6880' }}>
                No athletes yet. Add your first athlete to get started.
              </div>
            ) : (
              athletes.map((athlete: any) => (
                <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', borderBottom: '1px solid #1E3A5F' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #1E3F82, #3361B6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: '700'
                  }}>
                    {(athlete.profile?.full_name || athlete.profile?.email || 'A')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{athlete.profile?.full_name || athlete.profile?.email}</div>
                    <div style={{ fontSize: '12px', color: '#8BA3BF', marginTop: '2px' }}>
                      {athlete.weight_class ? `${athlete.weight_class}kg` : 'No weight class'} · {athlete.competition_level || 'Level not set'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* This week */}
          <div style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1E3A5F' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600' }}>This Week</h2>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
                const dateStr = format(day, 'yyyy-MM-dd')
                const daySessions = weekSessions?.filter((s: any) => s.scheduled_date === dateStr) || []
                const isToday = dateStr === today
                return (
                  <div key={dateStr} style={{ display: 'flex', gap: '16px', padding: '10px 0', borderBottom: i < 6 ? '1px solid #1E3A5F' : 'none' }}>
                    <div style={{ width: '36px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: isToday ? '#C19B30' : '#4A6880', textTransform: 'uppercase' as const }}>{format(day, 'EEE')}</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: isToday ? '#C19B30' : '#8BA3BF' }}>{format(day, 'd')}</div>
                    </div>
                    <div style={{ flex: 1, paddingTop: '4px' }}>
                      {daySessions.length === 0 ? (
                        <span style={{ fontSize: '13px', color: '#4A6880' }}>Rest</span>
                      ) : (
                        daySessions.map((s: any) => (
                          <div key={s.id} style={{ fontSize: '13px', color: '#F0F4F8', marginBottom: '2px' }}>
                            {s.session_name || 'Training Session'}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
