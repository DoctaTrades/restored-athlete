'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const WEIGHT_CLASSES = ['55', '61', '67', '73', '81', '89', '96', '102', '109', '109+']
const LEVELS = ['beginner', 'intermediate', 'advanced', 'elite']
const GOALS = [
  { value: 'recomp', label: 'Recomposition' },
  { value: 'bulk', label: 'Lean Bulk' },
  { value: 'cut', label: 'Fat Loss / Cut' },
  { value: 'comp_prep', label: 'Competition Prep' },
]

export default function EditAthletePage({ params }: { params: { id: string } }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [sex, setSex] = useState('')
  const [dob, setDob] = useState('')
  const [weightClass, setWeightClass] = useState('')
  const [bodyweight, setBodyweight] = useState('')
  const [height, setHeight] = useState('')
  const [trainingAge, setTrainingAge] = useState('')
  const [level, setLevel] = useState('')
  const [nutritionGoal, setNutritionGoal] = useState('')
  const [targetBodyweight, setTargetBodyweight] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ra_athletes')
      .select('*, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
      .eq('id', params.id)
      .maybeSingle()

    if (data) {
      setFullName((data as any).profile?.full_name || '')
      setEmail((data as any).profile?.email || '')
      setSex(data.sex || '')
      setDob(data.date_of_birth || '')
      setWeightClass(data.weight_class || '')
      setBodyweight(data.bodyweight_kg?.toString() || '')
      setHeight(data.height_cm?.toString() || '')
      setTrainingAge(data.training_age_years?.toString() || '')
      setLevel(data.competition_level || '')
      setNutritionGoal(data.nutrition_goal || '')
      setTargetBodyweight(data.target_bodyweight_kg?.toString() || '')
      setNotes(data.notes || '')
    }
    setLoading(false)
  }, [params.id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)

    // Update athlete record
    const { error: athleteError } = await supabase
      .from('ra_athletes')
      .update({
        sex: sex || null,
        date_of_birth: dob || null,
        weight_class: weightClass || null,
        bodyweight_kg: bodyweight ? parseFloat(bodyweight) : null,
        height_cm: height ? parseFloat(height) : null,
        training_age_years: trainingAge ? parseFloat(trainingAge) : null,
        competition_level: level || null,
        nutrition_goal: nutritionGoal || null,
        target_bodyweight_kg: targetBodyweight ? parseFloat(targetBodyweight) : null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (athleteError) { setError(athleteError.message); setSaving(false); return }

    // Update profile name
    const { data: athleteData } = await supabase
      .from('ra_athletes')
      .select('profile_id')
      .eq('id', params.id)
      .single()

    if (athleteData && fullName) {
      await supabase
        .from('ra_profiles')
        .update({ full_name: fullName })
        .eq('id', athleteData.profile_id)
    }

    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const inp = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0',
    borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF'
  } as React.CSSProperties

  const lbl = {
    display: 'block', fontSize: '12px', fontWeight: 600 as const,
    color: '#475569', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em'
  }

  const section = {
    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const, marginBottom: '20px'
  }

  const sectionHeader = {
    padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
    fontSize: '13px', fontWeight: 700 as const, color: '#0F2044',
    background: '#FAFAFA'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9', display: 'flex' }}>
      <div style={{ marginLeft: '240px', padding: '60px', color: '#94A3B8' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9', display: 'flex' }}>
      {/* Simple sidebar */}
      <div style={{ width: '240px', background: '#0F2044', minHeight: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column' as const }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: '#B8891A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#0F2044' }}>R</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>Restored Athlete</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Coach Portal</div>
            </div>
          </div>
        </div>
        <nav style={{ padding: '12px' }}>
          {[
            { label: 'Athletes', href: '/coach/dashboard', icon: '👥' },
            { label: 'Programming', href: '/coach/programming', icon: '📅' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', marginBottom: '2px', color: 'rgba(255,255,255,0.4)' }}>
              <span>{link.icon}</span>
              <span style={{ fontSize: '13px' }}>{link.label}</span>
            </a>
          ))}
          <div style={{ margin: '8px 0 4px', padding: '0 12px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '6px' }}>{fullName.split(' ')[0] || 'Athlete'}</div>
          </div>
          {[
            { label: 'Edit Profile', href: `/coach/athletes/${params.id}/edit`, active: true },
            { label: 'Max Board', href: `/coach/athletes/${params.id}/maxboard`, active: false },
            { label: 'Nutrition', href: `/coach/athletes/${params.id}/nutrition`, active: false },
          ].map(link => (
            <a key={link.href} href={link.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', marginBottom: '2px', background: link.active ? 'rgba(184,137,26,0.15)' : 'transparent', color: link.active ? '#B8891A' : 'rgba(255,255,255,0.5)' }}>
              <span style={{ fontSize: '13px', fontWeight: link.active ? 600 : 400 }}>{link.label}</span>
            </a>
          ))}
        </nav>
      </div>

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
          <a href="/coach/dashboard" style={{ color: '#94A3B8', textDecoration: 'none' }}>Athletes</a>
          {' / '}<span style={{ color: '#94A3B8' }}>{fullName || 'Athlete'}</span>
          {' / '}<span style={{ color: '#0F2044', fontWeight: 600 }}>Edit Profile</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>Edit Athlete Profile</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {success && (
              <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600 }}>✓ Saved successfully</span>
            )}
            <a href="/coach/dashboard" style={{ padding: '9px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', textDecoration: 'none' }}>Cancel</a>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626', marginBottom: '20px' }}>{error}</div>
        )}

        {/* Account */}
        <div style={section}>
          <div style={sectionHeader}>Account</div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input value={email} disabled style={{ ...inp, background: '#F8FAFC', color: '#94A3B8', cursor: 'not-allowed' }} />
            </div>
          </div>
        </div>

        {/* Physical Stats — TDEE fields */}
        <div style={section}>
          <div style={sectionHeader}>
            Physical Stats
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>Required for TDEE calculation</span>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Sex *</label>
              <select value={sex} onChange={e => setSex(e.target.value)} style={inp}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Date of Birth *</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Height (cm) *</label>
              <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 175" style={inp} />
            </div>
            <div>
              <label style={lbl}>Current Bodyweight (kg) *</label>
              <input type="number" value={bodyweight} onChange={e => setBodyweight(e.target.value)} placeholder="e.g. 84.5" step="0.1" style={inp} />
            </div>
            <div>
              <label style={lbl}>Weight Class (kg)</label>
              <select value={weightClass} onChange={e => setWeightClass(e.target.value)} style={inp}>
                <option value="">Select...</option>
                {WEIGHT_CLASSES.map(w => <option key={w} value={w}>{w}kg</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Target Bodyweight (kg)</label>
              <input type="number" value={targetBodyweight} onChange={e => setTargetBodyweight(e.target.value)} placeholder="e.g. 81.0" step="0.1" style={inp} />
            </div>
          </div>
        </div>

        {/* Training Background */}
        <div style={section}>
          <div style={sectionHeader}>Training Background</div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
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
            <div>
              <label style={lbl}>Nutrition Goal</label>
              <select value={nutritionGoal} onChange={e => setNutritionGoal(e.target.value)} style={inp}>
                <option value="">Select...</option>
                {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={section}>
          <div style={sectionHeader}>Notes</div>
          <div style={{ padding: '20px' }}>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Injuries, history, relevant context..." rows={4} style={{ ...inp, resize: 'vertical' as const }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <a href="/coach/dashboard" style={{ padding: '11px 20px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', textDecoration: 'none' }}>Cancel</a>
          <button onClick={handleSave} disabled={saving} style={{ padding: '11px 24px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Changes →'}
          </button>
        </div>
      </div>
    </div>
  )
}
