import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, subDays, startOfDay } from 'date-fns'
import CoachSidebar from '@/components/CoachSidebar'

const COMPLIANCE_LABELS: Record<string, { label: string; color: string; bg: string; score: number }> = {
  over:           { label: 'Over',         color: '#DC2626', bg: 'rgba(220,38,38,0.08)',   score: 0 },
  slightly_over:  { label: 'Slightly Over', color: '#D97706', bg: 'rgba(217,119,6,0.08)',  score: 0.5 },
  on_track:       { label: 'On Track',     color: '#16A34A', bg: 'rgba(22,163,74,0.08)',   score: 1 },
  slightly_under: { label: 'Slightly Under',color: '#D97706', bg: 'rgba(217,119,6,0.08)', score: 0.5 },
  under:          { label: 'Under',        color: '#DC2626', bg: 'rgba(220,38,38,0.08)',   score: 0 },
}

function calcCompliance(logs: any[], days: number): number | null {
  if (!logs.length) return null
  const cutoff = subDays(new Date(), days)
  const relevant = logs.filter(l => new Date(l.logged_date) >= cutoff)
  if (!relevant.length) return null
  const total = relevant.reduce((sum, l) => sum + (COMPLIANCE_LABELS[l.compliance]?.score ?? 0), 0)
  return Math.round((total / relevant.length) * 100)
}

function ComplianceBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ fontSize: '13px', color: '#CBD5E1' }}>No data</span>
  const color = pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626'
  return (
    <span style={{ fontSize: '20px', fontWeight: 800, color }}>{pct}%</span>
  )
}

export default async function CoachNutritionOverview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('ra_profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'coach') redirect('/athlete/dashboard')

  const { data: athletes } = await supabase
    .from('ra_athletes')
    .select('id, nutrition_goal, bodyweight_kg, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
    .eq('coach_id', user.id).eq('is_active', true)

  if (!athletes?.length) redirect('/coach/dashboard')

  // Fetch nutrition logs for all athletes
  const athleteIds = athletes.map((a: any) => a.id)
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const { data: allLogs } = await supabase
    .from('ra_nutrition_logs')
    .select('athlete_id, logged_date, compliance')
    .in('athlete_id', athleteIds)
    .gte('logged_date', thirtyDaysAgo)
    .order('logged_date', { ascending: false })

  // Fetch latest nutrition targets
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: allTargets } = await supabase
    .from('ra_nutrition_targets')
    .select('athlete_id, calories, training_calories, cut_rate_pct, effective_date')
    .in('athlete_id', athleteIds)
    .lte('effective_date', today)
    .order('effective_date', { ascending: false })

  // Fetch latest bodyweight logs for cut rate tracking
  const { data: allWeighIns } = await supabase
    .from('ra_bodyweight_log')
    .select('athlete_id, weight_kg, logged_at')
    .in('athlete_id', athleteIds)
    .gte('logged_at', thirtyDaysAgo)
    .order('logged_at', { ascending: false })

  // Build per-athlete data
  const athleteData = athletes.map((athlete: any) => {
    const logs = (allLogs || []).filter((l: any) => l.athlete_id === athlete.id)
    const target = (allTargets || []).find((t: any) => t.athlete_id === athlete.id)
    const weighIns = (allWeighIns || []).filter((w: any) => w.athlete_id === athlete.id)

    const comp7 = calcCompliance(logs, 7)
    const comp30 = calcCompliance(logs, 30)
    const todayLog = logs.find((l: any) => l.logged_date === today)

    // Weekly weight change
    const recent7 = weighIns.slice(0, 7)
    const older7 = weighIns.slice(7, 14)
    const recentAvg = recent7.length ? recent7.reduce((s: number, w: any) => s + w.weight_kg, 0) / recent7.length : null
    const olderAvg = older7.length ? older7.reduce((s: number, w: any) => s + w.weight_kg, 0) / older7.length : null
    const weeklyChange = recentAvg && olderAvg ? Math.round((recentAvg - olderAvg) * 100) / 100 : null
    const changePct = recentAvg && olderAvg ? Math.abs(weeklyChange!) / olderAvg * 100 : null
    const isAtCeiling = changePct ? changePct > 1.5 : false
    const isOverLimit = changePct ? changePct > 1.0 : false

    return { athlete, logs, target, comp7, comp30, todayLog, weeklyChange, changePct, isAtCeiling, isOverLimit, recentAvg }
  })

  const alerts = athleteData.filter(d => d.isAtCeiling || d.isOverLimit)
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <CoachSidebar active="Nutrition" />
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px', maxWidth: 'calc(100vw - 240px)' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>Nutrition Overview</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Compliance tracking across all athletes — {format(new Date(), 'MMMM d, yyyy')}</p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
            {athleteData.filter(d => d.isAtCeiling).map(d => (
              <div key={d.athlete.id} style={{ padding: '14px 18px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div>
                  <span style={{ fontWeight: 700, color: '#DC2626' }}>{d.athlete.profile?.full_name?.split(' ')[0]} </span>
                  <span style={{ fontSize: '13px', color: '#7F1D1D' }}>is losing {d.changePct?.toFixed(2)}% BW/week — above the 1.5% ceiling. Increase calories immediately.</span>
                </div>
                <a href={`/coach/athletes/${d.athlete.id}/nutrition`} style={{ marginLeft: 'auto', fontSize: '12px', color: '#DC2626', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>View →</a>
              </div>
            ))}
            {athleteData.filter(d => !d.isAtCeiling && d.isOverLimit).map(d => (
              <div key={d.athlete.id} style={{ padding: '14px 18px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '18px' }}>⚡</span>
                <div>
                  <span style={{ fontWeight: 700, color: '#D97706' }}>{d.athlete.profile?.full_name?.split(' ')[0]} </span>
                  <span style={{ fontSize: '13px', color: '#78350F' }}>is losing {d.changePct?.toFixed(2)}% BW/week — over 1% sustainable rate. Monitor closely.</span>
                </div>
                <a href={`/coach/athletes/${d.athlete.id}/nutrition`} style={{ marginLeft: 'auto', fontSize: '12px', color: '#D97706', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>View →</a>
              </div>
            ))}
          </div>
        )}

        {/* Athlete compliance table */}
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>Athlete Compliance</h2>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
              <span>On Track = 100% · Slightly Off = 50% · Under/Over = 0%</span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                {['Athlete', 'Goal', 'Today', '7-Day', '30-Day', 'Weight Trend', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {athleteData.map(({ athlete, comp7, comp30, todayLog, weeklyChange, changePct, isAtCeiling, isOverLimit, target }, idx) => (
                <tr key={athlete.id} style={{ borderBottom: idx < athleteData.length - 1 ? '1px solid #F9FAFB' : 'none', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F2044' }}>{athlete.profile?.full_name || athlete.profile?.email}</div>
                    {athlete.bodyweight_kg && <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>{athlete.bodyweight_kg}kg</div>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {athlete.nutrition_goal ? (
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' as const, background: 'rgba(15,32,68,0.06)', color: '#0F2044', border: '1px solid rgba(15,32,68,0.1)' }}>
                        {athlete.nutrition_goal.replace('_', ' ')}
                      </span>
                    ) : <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {todayLog ? (
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: COMPLIANCE_LABELS[todayLog.compliance]?.bg, color: COMPLIANCE_LABELS[todayLog.compliance]?.color, border: `1px solid ${COMPLIANCE_LABELS[todayLog.compliance]?.color}30` }}>
                        {COMPLIANCE_LABELS[todayLog.compliance]?.label}
                      </span>
                    ) : <span style={{ fontSize: '13px', color: '#CBD5E1' }}>Not logged</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}><ComplianceBadge pct={comp7} /></td>
                  <td style={{ padding: '14px 16px' }}><ComplianceBadge pct={comp30} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    {weeklyChange !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: isAtCeiling ? '#DC2626' : isOverLimit ? '#D97706' : '#475569' }}>
                          {weeklyChange > 0 ? '+' : ''}{weeklyChange}kg
                        </span>
                        {(isAtCeiling || isOverLimit) && <span style={{ fontSize: '14px' }}>{isAtCeiling ? '⚠️' : '⚡'}</span>}
                      </div>
                    ) : <span style={{ fontSize: '13px', color: '#CBD5E1' }}>No data</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <a href={`/coach/athletes/${athlete.id}/nutrition`} style={{ fontSize: '12px', color: '#B8891A', fontWeight: 600, textDecoration: 'none' }}>View →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Last 7 days log grid */}
        <div style={{ ...card, marginTop: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>Last 7 Days</h2>
          </div>
          <div style={{ padding: '16px 20px', overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#94A3B8', width: '160px' }}>Athlete</th>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = subDays(new Date(), 6 - i)
                    return (
                      <th key={i} style={{ padding: '8px 10px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 600, color: i === 6 ? '#0F2044' : '#94A3B8' }}>
                        <div>{format(d, 'EEE')}</div>
                        <div style={{ fontWeight: 800, fontSize: '14px' }}>{format(d, 'd')}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {athleteData.map(({ athlete, logs }) => (
                  <tr key={athlete.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#0F2044' }}>
                      {athlete.profile?.full_name?.split(' ')[0] || 'Athlete'}
                    </td>
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = subDays(new Date(), 6 - i)
                      const dateStr = format(d, 'yyyy-MM-dd')
                      const log = logs.find((l: any) => l.logged_date === dateStr)
                      const info = log ? COMPLIANCE_LABELS[log.compliance] : null
                      return (
                        <td key={i} style={{ padding: '8px 10px', textAlign: 'center' as const }}>
                          {info ? (
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: info.bg, border: `1px solid ${info.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', title: info.label }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: info.color }} />
                            </div>
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', margin: '0 auto' }} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Legend */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
              {Object.entries(COMPLIANCE_LABELS).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: val.color }} />
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>{val.label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E2E8F0' }} />
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Not logged</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
