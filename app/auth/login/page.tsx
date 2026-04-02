'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { window.location.href = '/dashboard' }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F4F6F9' }}>
      {/* Left sidebar */}
      <div style={{
        width: '420px', background: '#0F2044', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '48px 40px', flexShrink: 0
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '64px' }}>
            <div style={{ width: '40px', height: '40px', background: '#B8891A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#0F2044' }}>R</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#FFFFFF' }}>Restored Athlete</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1px' }}>Coach Portal</div>
            </div>
          </div>

          <div style={{ color: '#FFFFFF' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.2, marginBottom: '16px' }}>
              Olympic Weightlifting<br />
              <span style={{ color: '#B8891A' }}>Coaching Platform</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>
              Precision programming, RPE-first training, and macro-based nutrition management — all in one place.
            </p>
          </div>

          <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { icon: '🏋️', text: 'RPE-first session programming' },
              { icon: '📊', text: '1RM tracking with auto-calculated percentages' },
              { icon: '🥗', text: 'Training vs rest day macro splits' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', background: 'rgba(184,137,26,0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{item.icon}</div>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>
          by Restored Performance
        </div>
      </div>

      {/* Right — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: '36px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044', marginBottom: '8px' }}>Sign In</h1>
            <p style={{ fontSize: '14px', color: '#64748B' }}>Enter your credentials to access your portal</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#B8891A'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#B8891A'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading || !email || !password}
              style={{ width: '100%', padding: '13px', background: (loading || !email || !password) ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, color: (loading || !email || !password) ? '#94A3B8' : '#FFFFFF', cursor: (loading || !email || !password) ? 'not-allowed' : 'pointer', marginTop: '4px', transition: 'all 0.15s' }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: '#94A3B8' }}>
            Contact your coach to get access
          </p>
        </div>
      </div>
    </div>
  )
}
