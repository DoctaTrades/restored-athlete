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

