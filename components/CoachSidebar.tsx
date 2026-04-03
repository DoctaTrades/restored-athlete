'use client'

interface CoachSidebarProps {
  active: string
  athleteId?: string
  athleteName?: string
}

export default function CoachSidebar({ active, athleteId, athleteName }: CoachSidebarProps) {
  const mainLinks = [
    { label: 'Athletes', href: '/coach/dashboard', icon: '👥' },
    { label: 'Programming', href: '/coach/programming', icon: '📅' },
    { label: 'Nutrition', href: '/coach/nutrition-overview', icon: '🥗' },
    { label: 'Messages', href: '/coach/messages', icon: '💬' },
    { label: 'Suggestions', href: '/coach/suggestions', icon: '🤖' },
    { label: 'Settings', href: '/coach/settings', icon: '⚙️' },
  ]

  const athleteLinks = athleteId ? [
    { label: 'Edit Profile', href: `/coach/athletes/${athleteId}/edit`, icon: '✏️' },
    { label: 'Max Board', href: `/coach/athletes/${athleteId}/maxboard`, icon: '🏆' },
    { label: 'Nutrition', href: `/coach/athletes/${athleteId}/nutrition`, icon: '🥗' },
    { label: 'Messages', href: `/coach/messages`, icon: '💬' },
  ] : []

  return (
    <div style={{
      width: '240px', background: '#0F2044', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      flexShrink: 0, position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40
    }}>
      <div>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <a href="/coach/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', background: '#B8891A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#0F2044', flexShrink: 0 }}>R</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>Restored Athlete</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coach Portal</div>
            </div>
          </a>
        </div>

        {/* Main nav */}
        <nav style={{ padding: '12px' }}>
          {mainLinks.map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
              borderRadius: '8px', textDecoration: 'none', marginBottom: '2px',
              background: active === link.label ? 'rgba(184,137,26,0.15)' : 'transparent',
              color: active === link.label ? '#B8891A' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s'
            }}>
              <span style={{ fontSize: '16px' }}>{link.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: active === link.label ? 600 : 400 }}>{link.label}</span>
            </a>
          ))}

          {/* Per-athlete section */}
          {athleteId && athleteName && (
            <>
              <div style={{ margin: '12px 0 6px', padding: '0 12px' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {athleteName.split(' ')[0]}
                </div>
              </div>
              {athleteLinks.map(link => (
                <a key={link.href} href={link.href} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderRadius: '8px', textDecoration: 'none', marginBottom: '2px',
                  background: active === link.label ? 'rgba(184,137,26,0.15)' : 'transparent',
                  color: active === link.label ? '#B8891A' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.15s'
                }}>
                  <span style={{ fontSize: '16px' }}>{link.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: active === link.label ? 600 : 400 }}>{link.label}</span>
                </a>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Viewing As</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ padding: '6px 14px', background: '#B8891A', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#0F2044' }}>Coach</div>
          <a href="/athlete/dashboard" style={{ padding: '6px 14px', background: 'transparent', borderRadius: '6px', fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Athlete</a>
        </div>
        <a href="/auth/signout" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Sign out</a>
      </div>
    </div>
  )
}
