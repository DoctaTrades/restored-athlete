'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import CoachSidebar from '@/components/CoachSidebar'

interface Message {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
  read_at: string | null
  sender_role: 'coach' | 'athlete'
  category: string | null
}

interface AthleteThread {
  athleteProfileId: string
  athleteName: string
  lastMessage: string
  lastAt: string
  unread: number
}

const CATEGORIES = [
  { value: 'general', label: 'General', color: '#64748B' },
  { value: 'injury', label: 'Injury / Pain', color: '#DC2626' },
  { value: 'life', label: 'Life Update', color: '#7C3AED' },
  { value: 'nutrition', label: 'Nutrition', color: '#059669' },
  { value: 'programming', label: 'Programming Q', color: '#0F2044' },
  { value: 'other', label: 'Other', color: '#B8891A' },
]

function categoryColor(cat: string | null) {
  return CATEGORIES.find(c => c.value === cat)?.color || '#64748B'
}
function categoryLabel(cat: string | null) {
  return CATEGORIES.find(c => c.value === cat)?.label || 'General'
}
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

: { active: string }) {
  const links = [
    { label: 'Athletes', href: '/coach/dashboard', icon: '👥' },
    { label: 'Programming', href: '/coach/programming', icon: '📅' },
    { label: 'Nutrition', href: '/coach/nutrition-overview', icon: '🥗' },
    { label: 'Messages', href: '/coach/messages', icon: '💬' },
    { label: 'Settings', href: '/coach/settings', icon: '⚙️' },
  ]
  return (
    <div style={{ width: '240px', background: '#0F2044', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0', flexShrink: 0, position: 'fixed', left: 0, top: 0, bottom: 0 }}>
      <div>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: '#B8891A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#0F2044', flexShrink: 0 }}>R</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>Restored Athlete</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coach Portal</div>
            </div>
          </div>
        </div>
        <nav style={{ padding: '12px 12px' }}>
          {links.map(link => (
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
        </nav>
      </div>
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Viewing As</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ padding: '6px 14px', background: '#B8891A', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#0F2044' }}>Coach</div>
          <a href="/athlete/dashboard" style={{ padding: '6px 14px', background: 'transparent', borderRadius: '6px', fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Athlete</a>
        </div>
      </div>
    </div>
  )
}

export default function CoachMessages() {
  const [coachProfileId, setCoachProfileId] = useState<string | null>(null)
  const [threads, setThreads] = useState<AthleteThread[]>([])
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)
  const [selectedAthleteName, setSelectedAthleteName] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalUnread, setTotalUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCoachProfileId(user.id)

    // Get all athletes for this coach
    const { data: athletes } = await supabase
      .from('ra_athletes')
      .select('id, profile_id, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
      .eq('coach_id', user.id)

    if (!athletes || athletes.length === 0) { setLoading(false); return }

    const athleteProfileIds = athletes.map((a: any) => a.profile_id)

    // Get all messages involving coach and any of their athletes
    const { data: allMsgs } = await supabase
      .from('ra_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const msgs = (allMsgs || []).filter((m: Message) =>
      athleteProfileIds.includes(m.sender_id) || athleteProfileIds.includes(m.recipient_id)
    )

    // Build thread list per athlete
    const threadMap: Record<string, AthleteThread> = {}
    let unreadTotal = 0

    for (const athlete of athletes as any[]) {
      const athleteMsgs = msgs.filter((m: Message) =>
        m.sender_id === athlete.profile_id || m.recipient_id === athlete.profile_id
      )
      const unread = athleteMsgs.filter((m: Message) => m.sender_id === athlete.profile_id && !m.read_at).length
      unreadTotal += unread
      threadMap[athlete.profile_id] = {
        athleteProfileId: athlete.profile_id,
        athleteName: athlete.profile?.full_name || athlete.profile?.email || 'Athlete',
        lastMessage: athleteMsgs[0]?.body || '',
        lastAt: athleteMsgs[0]?.created_at || '',
        unread,
      }
    }

    setTotalUnread(unreadTotal)
    setThreads(Object.values(threadMap).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()))
    setLoading(false)
  }, [])

  const loadThread = useCallback(async (athleteProfileId: string, athleteName: string) => {
    setSelectedAthleteId(athleteProfileId)
    setSelectedAthleteName(athleteName)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: msgs } = await supabase
      .from('ra_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${athleteProfileId}),and(sender_id.eq.${athleteProfileId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    setMessages(msgs || [])

    // Mark athlete messages as read
    const unread = (msgs || []).filter((m: Message) => m.sender_id === athleteProfileId && !m.read_at)
    if (unread.length > 0) {
      await supabase.from('ra_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread.map((m: Message) => m.id))
      load() // Refresh thread counts
    }
  }, [load])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('coach-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ra_messages' }, () => {
        load()
        if (selectedAthleteId) loadThread(selectedAthleteId, selectedAthleteName)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, loadThread, selectedAthleteId, selectedAthleteName])

  async function send() {
    if (!body.trim() || !selectedAthleteId || !coachProfileId) return
    setSending(true)
    await supabase.from('ra_messages').insert({
      sender_id: coachProfileId,
      recipient_id: selectedAthleteId,
      body: body.trim(),
      category,
      sender_role: 'coach',
    })
    setBody('')
    setSending(false)
    loadThread(selectedAthleteId, selectedAthleteName)
    load()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F9' }}>
      <CoachSidebar active="Messages" />

      <div style={{ marginLeft: '240px', flex: 1, display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Thread list */}
        <div style={{ width: '280px', background: '#FFFFFF', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F2044' }}>Messages</div>
            {totalUnread > 0 && <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600, marginTop: '2px' }}>{totalUnread} unread</div>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</div>}
            {!loading && threads.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#CBD5E1', fontSize: '13px' }}>No athletes with messages yet</div>
            )}
            {threads.map(t => (
              <button key={t.athleteProfileId} onClick={() => loadThread(t.athleteProfileId, t.athleteName)} style={{
                width: '100%', padding: '14px 20px', textAlign: 'left', border: 'none', borderBottom: '1px solid #F1F5F9',
                background: selectedAthleteId === t.athleteProfileId ? 'rgba(15,32,68,0.04)' : '#FFFFFF',
                cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'background 0.1s'
              }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#B8891A' }}>
                    {t.athleteName.charAt(0).toUpperCase()}
                  </div>
                  {t.unread > 0 && (
                    <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '16px', height: '16px', borderRadius: '50%', background: '#DC2626', color: '#FFFFFF', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.unread > 9 ? '9+' : t.unread}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ fontSize: '13px', fontWeight: t.unread > 0 ? 700 : 600, color: '#0F2044' }}>{t.athleteName}</div>
                    {t.lastAt && <div style={{ fontSize: '10px', color: '#94A3B8' }}>{timeAgo(t.lastAt)}</div>}
                  </div>
                  {t.lastMessage && (
                    <div style={{ fontSize: '12px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: t.unread > 0 ? 600 : 400 }}>
                      {t.lastMessage}
                    </div>
                  )}
                  {!t.lastMessage && <div style={{ fontSize: '12px', color: '#CBD5E1' }}>No messages yet</div>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread view */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedAthleteId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#CBD5E1' }}>Select an athlete to view messages</div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#B8891A' }}>
                  {selectedAthleteName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F2044' }}>{selectedAthleteName}</div>
                  <a href={`/coach/athletes/${selectedAthleteId}/edit`} style={{ fontSize: '11px', color: '#94A3B8', textDecoration: 'none' }}>View profile →</a>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#CBD5E1' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>✉️</div>
                    <div style={{ fontSize: '13px' }}>No messages yet — send the first one</div>
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.sender_role === 'coach'
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
                      {!isMe && (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#B8891A', fontWeight: 700, flexShrink: 0 }}>
                          {selectedAthleteName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth: '65%' }}>
                        {msg.category && msg.category !== 'general' && (
                          <div style={{ fontSize: '10px', fontWeight: 700, color: categoryColor(msg.category), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>
                            {categoryLabel(msg.category)}
                          </div>
                        )}
                        <div style={{
                          padding: '10px 14px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: isMe ? '#0F2044' : '#F1F5F9', color: isMe ? '#FFFFFF' : '#0F2044',
                          fontSize: '14px', lineHeight: '1.5'
                        }}>
                          {msg.body}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px', textAlign: isMe ? 'right' : 'left' }}>
                          {timeAgo(msg.created_at)}
                          {isMe && msg.read_at && <span style={{ marginLeft: '6px' }}>✓ Read</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Compose */}
              <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.value} onClick={() => setCategory(cat.value)} style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${category === cat.value ? cat.color : '#E2E8F0'}`,
                      background: category === cat.value ? cat.color : '#FFFFFF', color: category === cat.value ? '#FFFFFF' : '#64748B', transition: 'all 0.15s'
                    }}>
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                    placeholder={`Message ${selectedAthleteName}... (Enter to send)`}
                    rows={2}
                    style={{ ...inp, resize: 'none', flex: 1, fontFamily: 'inherit' }}
                  />
                  <button onClick={send} disabled={sending || !body.trim()} style={{
                    padding: '10px 20px', background: body.trim() ? '#0F2044' : '#E2E8F0', color: body.trim() ? '#FFFFFF' : '#94A3B8',
                    border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: body.trim() ? 'pointer' : 'default', transition: 'all 0.15s', flexShrink: 0
                  }}>
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
