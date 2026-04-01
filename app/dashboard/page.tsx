import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  console.log('=== DASHBOARD DEBUG ===')
  console.log('user:', user?.id, user?.email)
  console.log('userError:', userError)

  if (!user) {
    console.log('No user — redirecting to login')
    redirect('/auth/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('ra_profiles')
    .select('id, email, role')
    .eq('id', user!.id)
    .maybeSingle()

  console.log('profile:', JSON.stringify(profile))
  console.log('profileError:', JSON.stringify(profileError))

  if (!profile) {
    return (
      <div style={{ padding: '40px', color: 'white', background: '#0D1B2A', minHeight: '100vh', fontFamily: 'monospace' }}>
        <h1 style={{ marginBottom: '20px' }}>Debug: No profile found</h1>
        <p>User ID: {user!.id}</p>
        <p>User Email: {user!.email}</p>
        <p>Profile Error: {JSON.stringify(profileError)}</p>
      </div>
    )
  }

  if (profile.role === 'coach') {
    redirect('/coach/dashboard')
  } else {
    redirect('/athlete/dashboard')
  }
}
