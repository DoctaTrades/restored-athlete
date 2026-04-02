'use client'

import { useState } from 'react'
import { createAthlete } from './actions'

const WEIGHT_CLASSES = ['55', '61', '67', '73', '81', '89', '96', '102', '109', '109+']
const LEVELS = ['beginner', 'intermediate', 'advanced', 'elite']
const GOALS = [
  { value: 'recomp', label: 'Recomposition' },
  { value: 'bulk', label: 'Lean Bulk' },
  { value: 'cut', label: 'Fat Loss / Cut' },
  { value: 'comp_prep', label: 'Competition Prep' },
]

export default function NewAthletePage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sex, setSex] = useState('')
  const [weightClass, setWeightClass] = useState('')
  const [bodyweight, setBodyweight] = useState('')
  const [height, setHeight] = useState('')
  const [trainingAge, setTrainingAge] = useState('')
  const [level, setLevel] = useState('')
  const [nutritionGoal, setNutritionGoal] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!fullName || !email || !password) {
      setError('Name, email and password are required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setSaving(true)
    setError(null)

    const result = await createAthlete({
      fullName, email, password, sex, weightClass,
      bodyweight, height, trainingAge, level, nutritionGoal, notes
    })

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      window.location.href = '/coach/programming'
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', background: '#0D1B2A',
    border: '1px solid #1E3A5F', borderRadius: '8px', color: '#F0F4F8',
    fontSize: '14px', outline: 'none'
  } as React.CSSProperties

  const labelStyle = {
    display: 'block', fontSize: '12px', color: '#8BA3BF',
    marginBottom: '6px', fontWeight: '500'
  } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', color: '#F0F4F8' }}>
      <nav style={{
        padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #1E3A5F', background: '#0A1F4E'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/coach/programming" style={{ fontSize: '13px', color: '#8BA3BF', textDecoration: 'none' }}>← Back</a>
          <span style={{ color: '#1E3A5F' }}>|</span>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>Add Athlete</span>
        </div>
      </nav>

      <div style={{ padding: '32px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.3px' }}>New Athlete</h1>
          <p style={{ color: '#8BA3BF', marginTop: '4px', fontSize: '14px' }}>
            Creates a login account so your athlete can view their programming and log sessions.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#C19B30', marginBottom: '16px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Account</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Jane Smith" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="athlete@email.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Temporary Password *</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#C19B30', marginBottom: '16px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Physical Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Sex</label>
                <select value={sex} onChange={e => setSex(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Weight Class (kg)</label>
                <select value={weightClass} onChange={e => setWeightClass(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {WEIGHT_CLASSES.map(w => <option key={w} value={w}>{w}kg</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Current Bodyweight (kg)</label>
                <input type="number" value={bodyweight} onChange={e => setBodyweight(e.target.value)} placeholder="e.g. 78.5" step="0.1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Height (cm)</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 175" style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#C19B30', marginBottom: '16px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Training Background</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Training Age (years)</label>
                <input type="number" value={trainingAge} onChange={e => setTrainingAge(e.target.value)} placeholder="e.g. 2.5" step="0.5" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Competition Level</label>
                <select value={level} onChange={e => setLevel(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nutrition Goal</label>
                <select value={nutritionGoal} onChange={e => setNutritionGoal(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: '#142236', border: '1px solid #1E3A5F', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#C19B30', marginBottom: '16px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Notes</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Injuries, goals, anything relevant..."
              rows={4} style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', fontSize: '13px', color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="/coach/programming" style={{
              flex: 1, padding: '13px', border: '1px solid #1E3A5F', borderRadius: '8px',
              color: '#8BA3BF', textDecoration: 'none', textAlign: 'center' as const, fontSize: '14px'
            }}>Cancel</a>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: '13px',
              background: saving ? '#1E3A5F' : 'linear-gradient(135deg, #C19B30, #D4AF37)',
              border: 'none', borderRadius: '8px',
              color: saving ? '#8BA3BF' : '#0A1F4E',
              fontWeight: '700', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer'
            }}>
              {saving ? 'Creating athlete...' : 'Create Athlete →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
