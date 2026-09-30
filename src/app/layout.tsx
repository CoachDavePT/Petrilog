import type { Metadata, Viewport } from 'next'
import { Barlow, IBM_Plex_Mono, Zilla_Slab } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})

const zillaSlab = Zilla_Slab({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-zilla-slab',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Petrilog',
  description: 'Dein digitales Fangbuch: Fänge, Angelzeit, Fangort und Wetter.',
}

export const viewport: Viewport = {
  // PROJ-2 shell: lets the tab bar and the active-session bar reach under the iPhone home indicator
  // (their padding uses env(safe-area-inset-*), which is 0 without this).
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E6E2D6' },
    { media: '(prefers-color-scheme: dark)', color: '#141B12' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="de"
      className={`${barlow.variable} ${zillaSlab.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" duration={2000} />
        </ThemeProvider>
      </body>
    </html>
  )
}
