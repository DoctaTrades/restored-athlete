'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createAthlete(formData: {
  fullName: string
  email: string
  password: string
  sex?: string
  weightClass?: string
  bodyweight?: string
  height?: string
  trainingAge?: string
  level?: string
  nutritionGoal?: string
  notes?: string
}) {
  const cookieStore = await cookies()
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user: coach } } = await supabaseServer.auth.getUser()
  if (!coach) return { error: 'Not authenticated' }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  console.log('=== CREATE ATHLETE DEBUG ===')
  console.log('URL:', supabaseUrl)
  console.log('Service key present:', !!serviceKey)
  console.log('Service key prefix:', serviceKey?.slice(0, 20))
  console.log('Coach ID:', coach.id)

  if (!serviceKey) return { error: 'Service role key not configured' }

  const supabaseAdmin = createClient(
    supabaseUrl!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log('Attempting to create user:', formData.email)

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    user_metadata: { full_name: formData.fullName, role: 'athlete' },
    email_confirm: true
  })

  console.log('Create user result:', JSON.stringify({ newUser: newUser?.user?.id, createError }))

  if (createError) return { error: `Auth error: ${createError.message}` }
  if (!newUser.user) return { error: 'Failed to create user - no user returned' }

  const athleteId = newUser.user.id

  const { error: profileError } = await supabaseAdmin
    .from('ra_profiles')
    .upsert({
      id: athleteId,
      email: formData.email,
      full_name: formData.fullName,
      role: 'athlete'
    })

  console.log('Profile upsert error:', profileError)
  if (profileError) return { error: `Profile error: ${profileError.message}` }

  const { error: athleteError } = await supabaseAdmin
    .from('ra_athletes')
    .insert({
      profile_id: athleteId,
      coach_id: coach.id,
      sex: formData.sex || null,
      weight_class: formData.weightClass || null,
      bodyweight_kg: formData.bodyweight ? parseFloat(formData.bodyweight) : null,
      height_cm: formData.height ? parseFloat(formData.height) : null,
      training_age_years: formData.trainingAge ? parseFloat(formData.trainingAge) : null,
      competition_level: formData.level || null,
      nutrition_goal: formData.nutritionGoal || null,
      notes: formData.notes || null,
      is_active: true
    })

  console.log('Athlete insert error:', athleteError)
  if (athleteError) return { error: `Athlete error: ${athleteError.message}` }

  return { success: true }
}
