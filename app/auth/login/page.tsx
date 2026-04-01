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
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Hard redirect ensures session cookie is set before server reads it
      window.location.href = '/dashboard'
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    background: '#0D1B2A', border: '1px solid #1E3A5F',
    borderRadius: '8px', color: '#F0F4F8', fontSize: '15px',
    outline: 'none', display: 'block'
  } as React.CSSProperties

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '20px',
      background: 'linear-gradient(135deg, #0A1F4E 0%, #0D1B2A 60%, #0A1F4E 100%)'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        background: '#142236', border: '1px solid #1E3A5F',
        borderRadius: '16px', padding: '48px 40px'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '60px', height: '60px', borderRadius: '14px', marginBottom: '16px',
            background: 'linear-gradient(135deg, #C19B30, #D4AF37)',
            fontSize: '22px', fontWeight: '900', color: '#0A1F4E'
          }}>RA</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#F0F4F8', letterSpacing: '-0.3px' }}>
            Restored Athlete
          </div>
          <div style={{ fontSize: '13px', color: '#8BA3BF', marginTop: '4px' }}>
            by Restored Performance
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#8BA3BF', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#8BA3BF', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inputStyle} />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#FCA5A5',
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)'
            }}>{error}</div>
          )}

          <button onClick={handleLogin} disabled={loading || !email || !password} style={{
            width: '100%', padding: '13px', borderRadius: '8px', border: 'none',
            marginTop: '4px', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
            background: (loading || !email || !password) ? '#1E3A5F' : 'linear-gradient(135deg, #C19B30, #D4AF37)',
            color: (loading || !email || !password) ? '#8BA3BF' : '#0A1F4E'
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#4A6880' }}>
          Contact your coach to get access
        </p>
      </div>
    </div>
  )
}
