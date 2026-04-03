'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AthleteNav from '@/components/AthleteNav'

const WEIGHT_CLASSES = ['55', '61', '67', '73', '81', '89', '96', '102', '109', '109+']
const LEVELS = ['beginner', 'intermediate', 'advanced', 'elite']
const GOALS = [
  { value: 'recomp', label: 'Recomposition' },
  { value: 'bulk', label: 'Lean Bulk' },
  { value: 'cut', label: 'Fat Loss / Cut' },
  { value: 'comp_prep', label: 'Competition Prep' },
]
const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentary', sub: 'Desk job, little to no exercise' },
  { value: 1.375, label: 'Lightly Active', sub: '1–3 days training/week' },
  { value: 1.55, label: 'Moderately Active', sub: '3–5 days training/week' },
  { value: 1.725, label: 'Very Active', sub: '6–7 days heavy training' },
  { value: 1.9, label: 'Extremely Active', sub: '2x/day or physical job + 20k+ steps' },
]

export default function AthleteSettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [athleteId, setAthleteId] = useState<string | null>(null)

  // Editable fields
  const [bodyweight, setBodyweight] = useState('')
  const [weightClass, setWeightClass] = useState('')
  const [trainingAge, setTrainingAge] = useState('')
  const [level, setLevel] = useState('')
  const [nutritionGoal, setNutritionGoal] = useState('')
  const [activityLevel, setActivityLevel] = useState(1.55)
  const [targetRatePct, setTargetRatePct] = useState('')
  const [goalDate, setGoalDate] = useState('')

  // Cycle tracking
  const [sex, setSex] = useState('')
  const [cycleEnabled, setCycleEnabled] = useState(false)
  const [cycleLength, setCycleLength] = useState('28')
  const [lastPeriodStart, setLastPeriodStart] = useState('')

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
    if (athleteData) {
      setAthleteId(athleteData.id)
      setSex(athleteData.sex || '')
      setBodyweight(athleteData.bodyweight_kg?.toString() || '')
      setWeightClass(athleteData.weight_class || '')
      setTrainingAge(athleteData.training_age_years?.toString() || '')
      setLevel(athleteData.competition_level || '')
      setNutritionGoal(athleteData.nutrition_goal || '')
      setCycleEnabled(athleteData.cycle_tracking_enabled || false)
      setCycleLength(athleteData.cycle_length_days?.toString() || '28')
      setLastPeriodStart(athleteData.last_period_start || '')
    }

    // Load latest nutrition target for goal fields
    const today = new Date().toISOString().split('T')[0]
    const { data: targetData } = await supabase
      .from('ra_nutrition_targets').select('*').eq('athlete_id', athleteData?.id)
      .lte('effective_date', today).order('effective_date', { ascending: false }).limit(1).maybeSingle()
    if (targetData) {
      setTargetRatePct(targetData.cut_rate_pct?.toString() || '')
      setGoalDate(targetData.goal_date || '')
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!athleteId) return
    setSaving(true); setError(null)

    const { error: athleteError } = await supabase
      .from('ra_athletes')
      .update({
        bodyweight_kg: bodyweight ? parseFloat(bodyweight) : null,
        weight_class: weightClass || null,
        training_age_years: trainingAge ? parseFloat(trainingAge) : null,
        competition_level: level || null,
        nutrition_goal: nutritionGoal || null,
        cycle_tracking_enabled: cycleEnabled,
        cycle_length_days: cycleEnabled ? parseInt(cycleLength) : null,
        last_period_start: cycleEnabled && lastPeriodStart ? lastPeriodStart : null,
        updated_at: new Date().toISOString()
      }).eq('id', athleteId)

    if (athleteError) { setError(athleteError.message); setSaving(false); return }

    // Update goal date and cut rate on nutrition targets
    if (targetRatePct || goalDate) {
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('ra_nutrition_targets')
        .update({ cut_rate_pct: targetRatePct ? parseFloat(targetRatePct) : null, goal_date: goalDate || null })
        .eq('athlete_id', athleteId).lte('effective_date', today)
    }

    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); load()
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '12px', fontWeight: 600 as const, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const, marginBottom: '16px' }
  const cardHeader = { padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontSize: '14px', fontWeight: 700 as const, color: '#0F2044', background: '#FAFAFA' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ height: '100px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} />
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
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Your profile and training preferences</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saved && <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600 }}>✓ Saved</span>}
            <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626', marginBottom: '16px' }}>{error}</div>}

        {/* Account */}
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
          <div style={{ padding: '0 20px 16px', fontSize: '12px', color: '#94A3B8' }}>Contact your coach to update your name or email.</div>
        </div>

        {/* Physical Stats */}
        <div style={card}>
          <div style={cardHeader}>Physical Stats</div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Current Bodyweight (kg)</label>
              <input type="number" value={bodyweight} onChange={e => setBodyweight(e.target.value)} placeholder="e.g. 84.5" step="0.1" style={{ ...inp, fontSize: '18px', fontWeight: 700 }} />
            </div>
            <div>
              <label style={lbl}>Weight Class (kg)</label>
              <select value={weightClass} onChange={e => setWeightClass(e.target.value)} style={inp}>
                <option value="">Select...</option>
                {WEIGHT_CLASSES.map(w => <option key={w} value={w}>{w}kg</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Training Profile */}
        <div style={card}>
          <div style={cardHeader}>Training Profile</div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Training Age (years)</label>
              <input type="number" value={trainingAge} onChange={e => setTrainingAge(e.target.value)} placeholder="e.g. 3.5" step="0.5" style={inp} />
            </div>
            <div>
              <label style={lbl}>Competition Level</label>
              <select value={level} onChange={e => setLevel(e.target.value)} style={inp}>
                <option value="">Select...</option>
                {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Nutrition Goal</label>
              <select value={nutritionGoal} onChange={e => setNutritionGoal(e.target.value)} style={inp}>
                <option value="">Select...</option>
                {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Weight Goal */}
        {(nutritionGoal === 'cut' || nutritionGoal === 'bulk' || nutritionGoal === 'comp_prep') && (
          <div style={card}>
            <div style={cardHeader}>
              Weight Goal
              <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>Used to calculate weekly target rate and suggest macro changes</span>
            </div>
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={lbl}>
                  Target Rate (%BW/week)
                </label>
                <input type="number" value={targetRatePct} onChange={e => setTargetRatePct(e.target.value)}
                  placeholder={nutritionGoal === 'bulk' ? 'e.g. 0.20' : 'e.g. 0.75'} step="0.05" min="0.05" max="1.5" style={inp} />
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px' }}>
                  {nutritionGoal === 'bulk' ? 'Lean bulk: 0.1–0.25% · Max: 0.5%' : 'Safe range: 0.5–1.0% · Max: 1.5%'}
                </div>
                {targetRatePct && parseFloat(targetRatePct) > 1.5 && (
                  <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>
                    ⚠️ Above 1.5% — too aggressive. Muscle loss risk is high.
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Goal Date</label>
                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} style={inp} min={new Date().toISOString().split('T')[0]} />
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px' }}>
                  System will back-calculate required weekly rate
                </div>
              </div>
            </div>
            {targetRatePct && goalDate && (() => {
              const weeks = Math.ceil((new Date(goalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))
              const bw = parseFloat(bodyweight) || 80
              const weeklyKg = bw * parseFloat(targetRatePct) / 100
              const totalKg = weeklyKg * weeks
              return weeks > 0 ? (
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ padding: '12px 14px', background: parseFloat(targetRatePct) > 1.5 ? 'rgba(220,38,38,0.04)' : 'rgba(15,32,68,0.03)', borderRadius: '8px', fontSize: '12px', color: '#475569' }}>
                    At {targetRatePct}%/week over <strong>{weeks} weeks</strong>: {nutritionGoal === 'cut' ? 'lose' : 'gain'} ~<strong>{totalKg.toFixed(1)}kg</strong> total. End weight: ~<strong>{nutritionGoal === 'cut' ? (parseFloat(bodyweight) - totalKg).toFixed(1) : (parseFloat(bodyweight) + totalKg).toFixed(1)}kg</strong>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        )}

        {/* Activity Level */}
        <div style={card}>
          <div style={cardHeader}>
            Activity Level
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>Used for TDEE calculation</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {ACTIVITY_LEVELS.map(al => (
              <button key={al.value} onClick={() => setActivityLevel(al.value)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', border: `1.5px solid ${activityLevel === al.value ? '#0F2044' : '#E2E8F0'}`, borderRadius: '10px', background: activityLevel === al.value ? 'rgba(15,32,68,0.04)' : '#FFFFFF', cursor: 'pointer', textAlign: 'left' as const, width: '100%' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${activityLevel === al.value ? '#0F2044' : '#CBD5E1'}`, background: activityLevel === al.value ? '#0F2044' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {activityLevel === al.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFFFFF' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: activityLevel === al.value ? 700 : 500, color: '#0F2044' }}>{al.label}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>{al.sub}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>×{al.value}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cycle Tracking — private, opt-in — female athletes only */}
        {(athleteId && (() => { return true })()) && false || true ? null : null}<div style={card}>
          <div style={cardHeader}>
            Cycle Tracking
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>Private — only you can see this data</span>
          </div>
          <div style={{ padding: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '14px 16px', background: cycleEnabled ? 'rgba(15,32,68,0.03)' : '#F8FAFC', border: `1.5px solid ${cycleEnabled ? '#0F2044' : '#E2E8F0'}`, borderRadius: '10px', marginBottom: cycleEnabled ? '16px' : 0 }}>
              <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: cycleEnabled ? '#0F2044' : '#CBD5E1', position: 'relative' as const, transition: 'background 0.2s', flexShrink: 0 }} onClick={() => setCycleEnabled(!cycleEnabled)}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#FFFFFF', position: 'absolute' as const, top: '2px', left: cycleEnabled ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F2044' }}>Enable cycle tracking</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  Personalizes nutrition and training recommendations by phase. Your data is private.
                </div>
              </div>
            </label>

            {cycleEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={lbl}>Cycle Length (days)</label>
                  <input type="number" value={cycleLength} onChange={e => setCycleLength(e.target.value)} placeholder="28" min="21" max="35" style={inp} />
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Average is 28 days (range: 21–35)</div>
                </div>
                <div>
                  <label style={lbl}>Last Period Start Date</label>
                  <input type="date" value={lastPeriodStart} onChange={e => setLastPeriodStart(e.target.value)} style={inp} max={new Date().toISOString().split('T')[0]} />
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Day 1 of your last period</div>
                </div>

                {cycleEnabled && lastPeriodStart && (() => {
                  const daysSince = Math.floor((Date.now() - new Date(lastPeriodStart).getTime()) / (1000 * 60 * 60 * 24))
                  const dayInCycle = ((daysSince % parseInt(cycleLength)) + parseInt(cycleLength)) % parseInt(cycleLength) + 1
                  const week = dayInCycle <= 7 ? 1 : dayInCycle <= 14 ? 2 : dayInCycle <= 21 ? 3 : 4
                  const colors: Record<number, string> = { 1: '#DC2626', 2: '#16A34A', 3: '#D97706', 4: '#059669' }
                  return (
                    <div style={{ gridColumn: '1 / -1', padding: '12px 14px', background: 'rgba(15,32,68,0.03)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors[week], flexShrink: 0 }} />
                      <div style={{ fontSize: '13px', color: '#475569' }}>
                        Currently in cycle day <strong>{dayInCycle}</strong> — <strong style={{ color: colors[week] }}>W{week}</strong>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>}
      </div>
    </div>
  )
}
