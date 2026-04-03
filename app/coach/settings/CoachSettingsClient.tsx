'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CoachSidebar from '@/components/CoachSidebar'

interface Profile {
  id: string
  full_name: string | null
  email: string
  role: string
}

interface Athlete {
  id: string
  is_active: boolean
  profile: { full_name: string | null; email: string }
}

export default function CoachSettingsClient({ profile, athletes }: { profile: Profile; athletes: Athlete[] }) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function saveProfile() {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('ra_profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id)
    setSaving(false)
    if (error) { setError(error.message) }
    else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  async function toggleAthleteStatus(athleteId: string, currentStatus: boolean) {
    await supabase.from('ra_athletes').update({ is_active: !currentStatus }).eq('id', athleteId)
    window.location.reload()
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF' } as React.CSSProperties
  const lbl = { display: 'block', fontSize: '12px', fontWeight: 600 as const, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' as const, marginBottom: '20px' }
  const cardHeader = { padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontSize: '14px', fontWeight: 700 as const, color: '#0F2044', background: '#FAFAFA' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <CoachSidebar active="Settings" />
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
      <div style={{ maxWidth: '720px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F2044' }}>Settings</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Coach profile and roster management</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saved && <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600 }}>✓ Saved</span>}
            <button onClick={saveProfile} disabled={saving} style={{ padding: '9px 20px', background: saving ? '#E2E8F0' : '#B8891A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: saving ? '#94A3B8' : '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '13px', color: '#DC2626', marginBottom: '20px' }}>{error}</div>}

        {/* Coach profile */}
        <div style={card}>
          <div style={cardHeader}>Coach Profile</div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. Patrick Rebadow" style={inp} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <div style={{ ...inp, background: '#F8FAFC', color: '#94A3B8' }}>{profile.email}</div>
            </div>
            <div>
              <label style={lbl}>Role</label>
              <div style={{ ...inp, background: '#F8FAFC', color: '#94A3B8', textTransform: 'capitalize' as const }}>{profile.role}</div>
            </div>
            <div>
              <label style={lbl}>Athletes</label>
              <div style={{ ...inp, background: '#F8FAFC', color: '#94A3B8' }}>{athletes.filter(a => a.is_active).length} active · {athletes.filter(a => !a.is_active).length} inactive</div>
            </div>
          </div>
        </div>

        {/* Credentials reminder */}
        <div style={card}>
          <div style={cardHeader}>Credentials</div>
          <div style={{ padding: '20px' }}>
            <div style={{ padding: '14px 16px', background: 'rgba(15,32,68,0.03)', border: '1px solid rgba(15,32,68,0.08)', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044', marginBottom: '4px' }}>Dr. Patrick Rebadow, DC, MS</div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>Sport Science and Rehabilitation · IVCA Certified Animal Chiropractor</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Gonstead method (human chiropractic) · Restored Chiropractic & Wellness PLLC</div>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '12px' }}>
              Credential display on athlete-facing materials is managed per-context. Contact support to update.
            </p>
          </div>
        </div>

        {/* Athlete roster */}
        <div style={card}>
          <div style={{ ...cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Athlete Roster</span>
            <a href="/coach/athletes/new" style={{ fontSize: '12px', color: '#B8891A', fontWeight: 600, textDecoration: 'none' }}>+ Add Athlete</a>
          </div>
          {athletes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' as const, color: '#94A3B8' }}>No athletes yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {['Athlete', 'Email', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {athletes.map((athlete, idx) => (
                  <tr key={athlete.id} style={{ borderBottom: idx < athletes.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#0F2044' }}>{athlete.profile?.full_name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>{athlete.profile?.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, background: athlete.is_active ? 'rgba(22,163,74,0.08)' : 'rgba(148,163,184,0.1)', color: athlete.is_active ? '#16A34A' : '#94A3B8', border: `1px solid ${athlete.is_active ? 'rgba(22,163,74,0.2)' : 'rgba(148,163,184,0.2)'}` }}>
                        {athlete.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: '12px' }}>
                      <a href={`/coach/athletes/${athlete.id}/edit`} style={{ fontSize: '12px', color: '#B8891A', fontWeight: 600, textDecoration: 'none' }}>Edit</a>
                      <button onClick={() => toggleAthleteStatus(athlete.id, athlete.is_active)} style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {athlete.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Danger zone */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(220,38,38,0.1)', fontSize: '14px', fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.02)' }}>Account</div>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F2044' }}>Sign out of all devices</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>You'll need to sign back in on each device.</div>
            </div>
            <a href="/auth/signout" style={{ padding: '8px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '7px', fontSize: '13px', fontWeight: 600, color: '#DC2626', textDecoration: 'none' }}>Sign Out</a>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
