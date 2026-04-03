import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { getCurrentPhase } from '@/lib/cycleUtils'
import CoachSidebar from '@/components/CoachSidebar'

: { active: string }) {
  const links = [
    { label: 'Athletes', href: '/coach/dashboard', icon: '👥' },
    { label: 'Programming', href: '/coach/programming', icon: '📅' },
    { label: 'Nutrition', href: '/coach/nutrition-overview', icon: '🥗' },
    { label: 'Messages', href: '/coach/messages', icon: '💬' },
    { label: 'Settings', href: '/coach/settings', icon: '⚙️' },
  ]
  return (
    <div style={{ width: '240px', background: '#0F2044', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0', flexShrink: 0, position: 'fixed', left: 0, top: 0, bottom: 0 }}>
      <div>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: '#B8891A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#0F2044', flexShrink: 0 }}>R</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>Restored Athlete</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coach Portal</div>
            </div>
          </div>
        </div>
        <nav style={{ padding: '12px 12px' }}>
          {links.map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
              borderRadius: '8px', textDecoration: 'none', marginBottom: '2px',
              background: active === link.label ? 'rgba(184,137,26,0.15)' : 'transparent',
              color: active === link.label ? '#B8891A' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s'
            }}>
              <span style={{ fontSize: '16px' }}>{link.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: active === link.label ? 600 : 400 }}>{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Viewing As</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ padding: '6px 14px', background: '#B8891A', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#0F2044' }}>Coach</div>
          <a href="/athlete/dashboard" style={{ padding: '6px 14px', background: 'transparent', borderRadius: '6px', fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Athlete</a>
        </div>
      </div>
    </div>
  )
}

function CycleBadge({ athlete }: { athlete: any }) {
  if (athlete.sex !== 'female') return null
  if (!athlete.cycle_tracking_enabled || !athlete.last_period_start) return null
  const phase = getCurrentPhase(new Date(athlete.last_period_start), athlete.cycle_length_days || 28)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: `${phase.color}15`, border: `1px solid ${phase.color}40`, fontSize: '11px', fontWeight: 700, color: phase.color }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: phase.color, display: 'inline-block', flexShrink: 0 }} />
      {phase.badge}
    </span>
  )
}

export default async function CoachDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('ra_profiles').select('*').eq('id', user!.id).maybeSingle()
  if (!profile || profile.role !== 'coach') redirect('/athlete/dashboard')

  const { data: athletes } = await supabase
    .from('ra_athletes')
    .select('*, profile:ra_profiles!ra_athletes_profile_id_fkey(*)')
    .eq('coach_id', user!.id).eq('is_active', true)

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: weekSessions } = await supabase
    .from('ra_sessions')
    .select('*, athlete:ra_athletes(*, profile:ra_profiles!ra_athletes_profile_id_fkey(*))')
    .gte('scheduled_date', weekStart).lte('scheduled_date', weekEnd).order('scheduled_date')

  const todayCount = weekSessions?.filter(s => s.scheduled_date === today).length || 0
  const completedCount = weekSessions?.filter(s => s.status === 'completed').length || 0

  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <CoachSidebar active="Athletes" />
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Athletes</div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>Athletes</h1>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>{athletes?.length || 0} active athletes</p>
          </div>
          <a href="/coach/athletes/new" style={{ padding: '10px 20px', background: '#B8891A', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', textDecoration: 'none' }}>+ Invite Athlete</a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Active Athletes', value: athletes?.length || 0, color: '#0F2044' },
            { label: "Today's Sessions", value: todayCount, color: '#B8891A' },
            { label: 'Completed This Week', value: completedCount, color: '#16A34A' },
          ].map(stat => (
            <div key={stat.label} style={{ ...card, padding: '20px 24px' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, marginBottom: '28px' }}>
          {!athletes?.length ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
              <p style={{ marginBottom: '12px' }}>No athletes yet.</p>
              <a href="/coach/athletes/new" style={{ color: '#B8891A', fontWeight: 600, textDecoration: 'none' }}>Add your first athlete →</a>
            </div>
          ) : (
            athletes.map((athlete: any, idx: number) => (
              <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderBottom: idx < athletes.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#B8891A', flexShrink: 0 }}>
                  {(athlete.profile?.full_name || 'A')[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{athlete.profile?.full_name || athlete.profile?.email}</span>
                    <CycleBadge athlete={athlete} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                    {athlete.weight_class ? `${athlete.weight_class}kg` : '—'} · {athlete.competition_level ? athlete.competition_level.charAt(0).toUpperCase() + athlete.competition_level.slice(1) : 'Level not set'}
                    {athlete.nutrition_goal ? ` · ${athlete.nutrition_goal.replace('_', ' ')}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <a href="/coach/messages" style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none', padding: '5px 10px', border: '1px solid #E2E8F0', borderRadius: '6px' }}>💬</a>
                  <a href="/coach/programming" style={{ fontSize: '12px', color: '#B8891A', textDecoration: 'none', fontWeight: 600 }}>View Program →</a>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>This Week</h2>
            <a href="/coach/programming" style={{ fontSize: '12px', color: '#B8891A', textDecoration: 'none', fontWeight: 600 }}>View Calendar →</a>
          </div>
          <div style={{ padding: '4px 0' }}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
              const dateStr = format(day, 'yyyy-MM-dd')
              const daySessions = weekSessions?.filter((s: any) => s.scheduled_date === dateStr) || []
              const isToday = dateStr === today
              return (
                <div key={dateStr} style={{ display: 'flex', gap: '16px', padding: '10px 20px', background: isToday ? 'rgba(184,137,26,0.04)' : 'transparent', borderLeft: isToday ? '3px solid #B8891A' : '3px solid transparent' }}>
                  <div style={{ width: '48px', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: isToday ? '#B8891A' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{format(day, 'EEE')}</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: isToday ? '#B8891A' : '#0F2044', lineHeight: 1.2 }}>{format(day, 'd')}</div>
                  </div>
                  <div style={{ flex: 1, paddingTop: '2px' }}>
                    {daySessions.length === 0 ? (
                      <span style={{ fontSize: '13px', color: '#CBD5E1' }}>Rest</span>
                    ) : (
                      daySessions.map((s: any) => (
                        <div key={s.id} style={{ fontSize: '13px', color: '#334155', marginBottom: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.status === 'completed' ? '#16A34A' : '#B8891A', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{s.athlete?.profile?.full_name?.split(' ')[0] || 'Athlete'}</span>
                          <span style={{ color: '#94A3B8' }}>{s.session_name || 'Session'}</span>
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
  )
}
