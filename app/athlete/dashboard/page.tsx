import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import AthleteNav from '@/components/AthleteNav'

export default async function AthleteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('ra_profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) redirect('/auth/login')

  const { data: athlete } = await supabase
    .from('ra_athletes').select('*').eq('profile_id', user.id).maybeSingle()

  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: todaySession } = await supabase
    .from('ra_sessions')
    .select('*, blocks:ra_session_blocks(*, exercise:ra_exercises(*))')
    .eq('athlete_id', athlete?.id)
    .eq('scheduled_date', today)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()

  const { data: latestWeight } = await supabase
    .from('ra_bodyweight_log')
    .select('*').eq('athlete_id', athlete?.id)
    .order('logged_at', { ascending: false }).limit(1).maybeSingle()

  const { data: nutrition } = await supabase
    .from('ra_nutrition_targets').select('*').eq('athlete_id', athlete?.id)
    .lte('effective_date', today).order('effective_date', { ascending: false }).limit(1).maybeSingle()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (profile.full_name || '').split(' ')[0] || 'Athlete'
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <AthleteNav active="today" athleteName={profile.full_name || profile.email} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F2044' }}>{greeting}, {firstName}</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Bodyweight', value: latestWeight ? `${latestWeight.weight_kg}kg` : '—', sub: latestWeight ? format(new Date(latestWeight.logged_at + 'T12:00:00'), 'MMM d') : 'Not logged', color: '#0F2044', href: '/athlete/nutrition' },
            { label: 'Target Calories', value: (nutrition as any)?.training_calories || (nutrition as any)?.calories ? `${(nutrition as any).training_calories || (nutrition as any).calories}` : '—', sub: 'Training day', color: '#B8891A', href: '/athlete/nutrition' },
            { label: 'Weight Class', value: athlete?.weight_class ? `${athlete.weight_class}kg` : '—', sub: athlete?.target_bodyweight_kg ? `Target: ${athlete.target_bodyweight_kg}kg` : 'Not set', color: '#16A34A', href: '/athlete/settings' },
          ].map(stat => (
            <a key={stat.label} href={stat.href} style={{ ...card, padding: '16px 18px', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px' }}>{stat.label}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>{stat.sub}</div>
            </a>
          ))}
        </div>

        {/* Today's session */}
        <div style={{ ...card, marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>Today's Training</h2>
            {todaySession && (
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: todaySession.status === 'completed' ? 'rgba(22,163,74,0.08)' : 'rgba(184,137,26,0.08)', border: `1px solid ${todaySession.status === 'completed' ? 'rgba(22,163,74,0.2)' : 'rgba(184,137,26,0.2)'}`, color: todaySession.status === 'completed' ? '#16A34A' : '#B8891A' }}>{todaySession.status}</span>
            )}
          </div>

          {!todaySession ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' as const }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏖️</div>
              <div style={{ fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Rest Day</div>
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>No session scheduled — recover well.</div>
            </div>
          ) : (
            <div style={{ padding: '16px 20px' }}>
              {(todaySession.target_rpe_low || todaySession.target_rpe_high) && (
                <div style={{ padding: '12px 16px', background: 'rgba(184,137,26,0.06)', border: '1px solid rgba(184,137,26,0.2)', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px' }}>⚡</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#B8891A' }}>Target RPE: {todaySession.target_rpe_low}–{todaySession.target_rpe_high}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>Listen to your body — a lower RPE on a fatigued day is always the right call.</div>
                  </div>
                </div>
              )}

              {todaySession.coach_notes && (
                <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', borderLeft: '3px solid #0F2044', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '3px' }}>Coach Notes</div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>{todaySession.coach_notes}</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                {(todaySession.blocks || []).sort((a: any, b: any) => a.order_index - b.order_index).map((block: any, idx: number) => (
                  <div key={block.id} style={{ display: 'flex', gap: '12px', padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#B8891A', flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>{block.exercise?.name}</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                        {block.sets} sets × {block.reps} reps
                        {block.load_type === 'percentage' && block.load_percentage && ` @ ${block.load_percentage}%`}
                        {block.load_type === 'rpe' && block.load_rpe && ` @ RPE ${block.load_rpe}`}
                        {block.calculated_kg && <span style={{ color: '#B8891A', fontWeight: 600 }}> ≈ {block.calculated_kg}kg</span>}
                      </div>
                    </div>
                    {block.notes && <div style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '140px', textAlign: 'right' as const }}>{block.notes}</div>}
                  </div>
                ))}
              </div>

              {todaySession.status !== 'completed' && (
                <a href={`/athlete/session/${todaySession.id}`} style={{ display: 'block', marginTop: '16px', padding: '13px', background: '#0F2044', borderRadius: '8px', textAlign: 'center' as const, fontSize: '14px', fontWeight: 700, color: '#FFFFFF', textDecoration: 'none' }}>
                  Start Session →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { label: 'My Nutrition', sub: 'Macros & meal plan', href: '/athlete/nutrition', icon: '🥗', bg: '#B8891A' },
            { label: 'My Maxes', sub: '1RMs & percentages', href: '/athlete/maxes', icon: '🏆', bg: '#0F2044' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{ ...card, padding: '18px 20px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>{item.sub}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
