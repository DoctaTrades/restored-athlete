import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Restored Athlete',
  description: 'Olympic weightlifting coaching & nutrition platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
