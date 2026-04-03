import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CoachSettingsClient from './CoachSettingsClient'

export default async function CoachSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('ra_profiles').select('*').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'coach') redirect('/athlete/dashboard')

  const { data: athletes } = await supabase
    .from('ra_athletes')
    .select('id, is_active, profile:ra_profiles!ra_athletes_profile_id_fkey(full_name, email)')
    .eq('coach_id', user.id)

  return <CoachSettingsClient profile={profile} athletes={athletes || []} />
}
