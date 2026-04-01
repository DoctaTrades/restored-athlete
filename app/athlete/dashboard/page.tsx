import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function AthleteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('ra_profiles')
    .select('*')
    .eq('id', user!.id)
    .maybeSingle()

  if (!profile) redirect('/auth/login')

  const { data: athlete } = await supabase
    .from('ra_athletes')
    .select('*')
    .eq('profile_id', user!.id)
    .maybeSingle()

  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: todaySession } = await supabase
    .from('ra_sessions')
    .select('*, blocks:ra_session_blocks(*, exercise:ra_exercises(*))')
    .eq('athlete_id', athlete?.id)
    .eq('scheduled_date', today)
    .maybeSingle()

  const { data: latestWeight } = await supabase
    .from('ra_bodyweight_log')
    .select('*')
    .eq('athlete_id', athlete?.id)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: nutrition } = await supabase
    .from('ra_nutrition_targets')
    .select('*')
    .eq('athlete_id', athlete?.id)
    .lte('effective_date', today)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (profile.full_name || '').split(' ')[0] || 'Athlete'

  return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', color: '#F0F4F8' }}>
      <nav style={{
        padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #1E3A5F', background: '#0A1F4E'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #C19B30, #D4AF37)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: '900', color: '#0A1F4E'
          }}>RA</div>
          <span style={{ fontSize: '15px', fontWeight: '700' }}>Restored Athlete</span>
        </div>
        <a href="/auth/signout" style={{ fontSize: '13px', color: '#8BA3BF', textDecoration: 'none' }}>Sign out</a>
      </nav>

      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>{greeting}, {firstName}</h1>
          <p style={{ color: '#8BA3BF', marginTop: '2px', fontSize: '14px' }}>{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Bodyweight', value: latestWeight ? `${latestWeight.weight_kg}kg` : '—', color: '#3498DB' },
            { label: 'Target Calories', value: nutrition?.calories || '—', color: '#C19B30' },
            { label: 'Weight Class', value: athlete?.weight_class ? `${athlete.weight_class}kg` : '—', color: '#10B981' },
          ].map(s => (
            <div key={s.label} style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#8BA3BF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1E3A5F' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Today's Training</h2>
          </div>
          {!todaySession ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#4A6880' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏋️</div>
              Rest day — no session scheduled
            </div>
          ) : (
            <div style={{ padding: '20px 24px' }}>
              {(todaySession.target_rpe_low || todaySession.target_rpe_high) && (
                <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'rgba(193,155,48,0.1)', border: '1px solid rgba(193,155,48,0.25)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#C19B30' }}>
                    Target RPE: {todaySession.target_rpe_low}–{todaySession.target_rpe_high}
                  </div>
                  <div style={{ fontSize: '12px', color: '#8BA3BF', marginTop: '2px' }}>
                    Listen to your body. A lower RPE on a fatigued day is always the right call.
                  </div>
                </div>
              )}
              {todaySession.blocks?.sort((a: any, b: any) => a.order_index - b.order_index).map((block: any, i: number) => (
                <div key={block.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: '#1C2E44', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0A1F4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#8BA3BF', flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{block.exercise?.name}</div>
                    <div style={{ fontSize: '12px', color: '#8BA3BF', marginTop: '2px' }}>
                      {block.sets} × {block.reps}
                      {block.load_percentage && ` @ ${block.load_percentage}%`}
                      {block.calculated_kg && ` (~${block.calculated_kg}kg)`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
