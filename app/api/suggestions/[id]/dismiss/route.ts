import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  await supabase.from('ra_program_suggestions')
    .update({ status: 'dismissed', reviewed_at: new Date().toISOString() })
    .eq('id', params.id)
  return NextResponse.redirect(new URL('/coach/suggestions', request.url))
}
