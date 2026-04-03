'use client'

interface AthleteNavProps {
  active: 'today' | 'nutrition' | 'maxes' | 'messages' | 'settings'
  athleteName?: string
  unreadCount?: number
}

export default function AthleteNav({ active, athleteName, unreadCount = 0 }: AthleteNavProps) {
  const links = [
    { label: 'Today', href: '/athlete/dashboard', key: 'today', icon: '🏠' },
    { label: 'Nutrition', href: '/athlete/nutrition', key: 'nutrition', icon: '🥗' },
    { label: 'My Maxes', href: '/athlete/maxes', key: 'maxes', icon: '🏆' },
    { label: 'Messages', href: '/athlete/messages', key: 'messages', icon: '💬', badge: unreadCount },
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
      <div style={{ display: 'flex', padding: '0 20px', overflowX: 'auto' as const }}>
        {links.map(link => (
          <a key={link.key} href={link.href} style={{
            display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' as const,
            padding: '12px 14px', textDecoration: 'none', fontSize: '13px', fontWeight: active === link.key ? 700 : 500,
            color: active === link.key ? '#0F2044' : '#94A3B8', whiteSpace: 'nowrap' as const,
            borderBottom: active === link.key ? '2px solid #0F2044' : '2px solid transparent',
            transition: 'all 0.15s', flexShrink: 0
          }}>
            <span style={{ fontSize: '14px' }}>{link.icon}</span>
            {link.label}
            {(link as any).badge > 0 && (
              <span style={{ position: 'absolute' as const, top: '8px', right: '4px', width: '16px', height: '16px', borderRadius: '50%', background: '#DC2626', color: '#FFFFFF', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(link as any).badge > 9 ? '9+' : (link as any).badge}
              </span>
            )}
          </a>
        ))}
      </div>
    </nav>
  )
}
