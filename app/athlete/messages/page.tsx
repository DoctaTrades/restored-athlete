'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import AthleteNav from '@/components/AthleteNav'

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

export default function AthleteMessages() {
  const [profile, setProfile] = useState<any>(null)
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase.from('ra_profiles').select('*').eq('id', user.id).maybeSingle()
    const { data: athleteData } = await supabase.from('ra_athletes').select('id, coach_id').eq('profile_id', user.id).maybeSingle()

    setProfile(profileData)
    if (!athleteData) { setLoading(false); return }
    setAthleteId(athleteData.id)
    setCoachId(athleteData.coach_id)

    // Load messages between this athlete and their coach
    const { data: msgs } = await supabase
      .from('ra_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${athleteData.coach_id}),and(sender_id.eq.${athleteData.coach_id},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    setMessages(msgs || [])

    // Mark unread messages from coach as read
    const unreadFromCoach = (msgs || []).filter(m => m.sender_id === athleteData.coach_id && !m.read_at)
    if (unreadFromCoach.length > 0) {
      await supabase.from('ra_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadFromCoach.map((m: Message) => m.id))
    }

    setUnread(0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-scroll to bottom when messages load/update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('athlete-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ra_messages' }, () => {
        load()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  async function send() {
    if (!body.trim() || !coachId || !profile) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }

    await supabase.from('ra_messages').insert({
      sender_id: user.id,
      recipient_id: coachId,
      body: body.trim(),
      category,
      sender_role: 'athlete',
    })

    setBody('')
    setSending(false)
    load()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#0F2044', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ height: '100px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} />
      <div style={{ padding: '60px', textAlign: 'center' as const, color: '#94A3B8' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9', display: 'flex', flexDirection: 'column' }}>
      <AthleteNav active="messages" athleteName={profile?.full_name || profile?.email} />

      <div style={{ maxWidth: '720px', margin: '0 auto', width: '100%', padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F2044' }}>Messages</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Communicate directly with your coach — injuries, questions, life updates</p>
        </div>

        {/* Message thread */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', flex: 1 }}>
          {/* Thread header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#B8891A', fontWeight: 700 }}>C</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044' }}>Your Coach</div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Messages are private between you and your coach</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ padding: '16px 20px', minHeight: '300px', maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#94A3B8' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#CBD5E1', marginBottom: '4px' }}>No messages yet</div>
                <div style={{ fontSize: '12px', color: '#CBD5E1', textAlign: 'center' }}>Send your coach a message below — questions, injury updates, or anything on your mind</div>
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.sender_role === 'athlete'
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
                  {!isMe && (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#B8891A', fontWeight: 700, flexShrink: 0 }}>C</div>
                  )}
                  <div style={{ maxWidth: '70%' }}>
                    {msg.category && msg.category !== 'general' && (
                      <div style={{ fontSize: '10px', fontWeight: 700, color: categoryColor(msg.category), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>
                        {categoryLabel(msg.category)}
                      </div>
                    )}
                    <div style={{
                      padding: '10px 14px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMe ? '#0F2044' : '#F1F5F9',
                      color: isMe ? '#FFFFFF' : '#0F2044',
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
          <div style={{ padding: '16px 20px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
            {/* Category selector */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
              {CATEGORIES.map(cat => (
                <button key={cat.value} onClick={() => setCategory(cat.value)} style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${category === cat.value ? cat.color : '#E2E8F0'}`,
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
                placeholder="Message your coach... (Enter to send, Shift+Enter for new line)"
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
        </div>
      </div>
    </div>
  )
}
