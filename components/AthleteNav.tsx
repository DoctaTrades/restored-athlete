'use client'

interface AthleteNavProps {
  active: 'today' | 'nutrition' | 'maxes' | 'settings'
  athleteName?: string
}

export default function AthleteNav({ active, athleteName }: AthleteNavProps) {
  const links = [
    { label: 'Today', href: '/athlete/dashboard', key: 'today', icon: '🏠' },
    { label: 'Nutrition', href: '/athlete/nutrition', key: 'nutrition', icon: '🥗' },
    { label: 'My Maxes', href: '/athlete/maxes', key: 'maxes', icon: '🏆' },
    { label: 'Settings', href: '/athlete/settings', key: 'settings', icon: '⚙️' },
  ]

  return (
    <nav style={{
      background: '#FFFFFF', borderBottom: '1px solid #E2E8F0',
      position: 'sticky' as const, top: 0, zIndex: 50
    }}>
      {/* Top bar */}
      <div style={{ height: '52px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: '#0F2044', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#B8891A' }}>RA</div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Restored Athlete</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#94A3B8' }}>{athleteName}</span>
          <a href="/auth/signout" style={{ fontSize: '12px', color: '#94A3B8', textDecoration: 'none', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px' }}>Sign out</a>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', padding: '0 20px' }}>
        {links.map(link => (
          <a key={link.key} href={link.href} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '12px 16px', textDecoration: 'none', fontSize: '13px', fontWeight: active === link.key ? 700 : 500,
            color: active === link.key ? '#0F2044' : '#94A3B8',
            borderBottom: active === link.key ? '2px solid #0F2044' : '2px solid transparent',
            transition: 'all 0.15s'
          }}>
            <span style={{ fontSize: '14px' }}>{link.icon}</span>
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
