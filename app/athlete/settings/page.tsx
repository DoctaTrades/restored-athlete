'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AthleteNav from '@/components/AthleteNav'

const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentary', sub: 'Desk job, little to no exercise' },
  { value: 1.375, label: 'Lightly Active', sub: '1–3 days training/week' },
  { value: 1.55, label: 'Moderately Active', sub: '3–5 days training/week' },
  { value: 1.725, label: 'Very Active', sub: '6–7 days heavy training' },
  { value: 1.9, label: 'Extremely Active', sub: '2x/day or physical job' },
]

export default function AthleteSettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [athlete, setAthlete] = useState<any>(null)
  const [activityLevel, setActivityLevel] = useState(1.55)
  const [bodyweight, setBodyweight] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profileData } = await supabase
      .from('ra_profiles').select('*').eq('id', user.id).maybeSingle()

    const { data: athleteData } = await supabase
      .from('ra_athletes').select('*').eq('profile_id', user.id).maybeSingle()

    setProfile(profileData)
    setAthlete(athleteData)
    if (athleteData?.bodyweight_kg) setBodyweight(athleteData.bodyweight_kg.toString())
    // Activity level stored in notes field temporarily until we add the column
    // For now default to 1.55
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!athlete) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('ra_athletes')
      .update({
        bodyweight_kg: bodyweight ? parseFloat(bodyweight) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', athlete.id)

    if (error) { setError(error.message); setSaving(false); return }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    load()
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '12px', fontWeight: 600 as const, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const, marginBottom: '16px' }
  const cardHeader = { padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontSize: '14px', fontWeight: 700 as const, color: '#0F2044' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ height: '52px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} />
      <div style={{ padding: '60px', textAlign: 'center' as const, color: '#94A3B8' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <AthleteNav active="settings" athleteName={profile?.full_name || profile?.email} />

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F2044' }}>Settings</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Your profile and preferences</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saved && <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600 }}>✓ Saved</span>}
            <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626', marginBottom: '16px' }}>{error}</div>}

        {/* Profile info (read only) */}
        <div style={card}>
          <div style={cardHeader}>Account</div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Name</label>
              <div style={{ ...inp, background: '#F8FAFC', color: '#475569' }}>{profile?.full_name || '—'}</div>
            </div>
            <div>
              <label style={lbl}>Email</label>
              <div style={{ ...inp, background: '#F8FAFC', color: '#475569' }}>{profile?.email}</div>
            </div>
          </div>
          <div style={{ padding: '0 20px 16px', fontSize: '12px', color: '#94A3B8' }}>
            To update your name or email, contact your coach.
          </div>
        </div>

        {/* Current bodyweight */}
        <div style={card}>
          <div style={cardHeader}>Current Bodyweight</div>
          <div style={{ padding: '20px' }}>
            <label style={lbl}>Bodyweight (kg)</label>
            <input type="number" value={bodyweight} onChange={e => setBodyweight(e.target.value)} placeholder="e.g. 84.5" step="0.1" style={{ ...inp, fontSize: '18px', fontWeight: 700, maxWidth: '200px' }} />
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>
              Used for TDEE calculation and weight class tracking. Log daily weigh-ins from the Nutrition page.
            </p>
          </div>
        </div>

        {/* Activity level */}
        <div style={card}>
          <div style={cardHeader}>
            Activity Level
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>Used to calculate your TDEE</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {ACTIVITY_LEVELS.map(level => (
              <button key={level.value} onClick={() => setActivityLevel(level.value)} style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                border: `1.5px solid ${activityLevel === level.value ? '#0F2044' : '#E2E8F0'}`,
                borderRadius: '10px', background: activityLevel === level.value ? 'rgba(15,32,68,0.04)' : '#FFFFFF',
                cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s', width: '100%'
              }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${activityLevel === level.value ? '#0F2044' : '#CBD5E1'}`, background: activityLevel === level.value ? '#0F2044' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {activityLevel === level.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFFFFF' }} />}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: activityLevel === level.value ? 700 : 500, color: '#0F2044' }}>{level.label}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>{level.sub}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>×{level.value}</div>
              </button>
            ))}
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', padding: '0 4px' }}>
              Consider your total daily activity — not just training. A physically demanding job or 20k+ steps/day counts.
            </p>
          </div>
        </div>

        {/* Athlete stats (read only from coach) */}
        <div style={card}>
          <div style={cardHeader}>
            Training Profile
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>Set by your coach</span>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Weight Class', value: athlete?.weight_class ? `${athlete.weight_class}kg` : '—' },
              { label: 'Competition Level', value: athlete?.competition_level || '—' },
              { label: 'Nutrition Goal', value: athlete?.nutrition_goal?.replace('_', ' ') || '—' },
              { label: 'Training Age', value: athlete?.training_age_years ? `${athlete.training_age_years} years` : '—' },
            ].map(item => (
              <div key={item.label}>
                <label style={lbl}>{item.label}</label>
                <div style={{ ...inp, background: '#F8FAFC', color: '#475569', textTransform: 'capitalize' as const }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
