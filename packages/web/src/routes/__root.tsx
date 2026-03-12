import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Sun, Moon, Menu, X, LogOut } from 'lucide-react'
import { cn } from '../lib/utils'
import { getCurrentUser } from '../auth/user'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Argus' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/logo-argus.svg' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  beforeLoad: async ({ location }) => {
    // Skip auth check for the upload page (used by CI)
    if (location.pathname === '/upload') return

    const user = await getCurrentUser()
    if (!user) {
      const returnTo = encodeURIComponent(location.pathname + location.search)
      throw new Response(null, {
        status: 302,
        headers: { Location: `/auth/github?returnTo=${returnTo}` },
      })
    }
  },
  loader: async () => {
    const user = await getCurrentUser()
    return { user }
  },
  component: RootComponent,
})

function RootComponent() {
  const { user } = Route.useLoaderData()
  const [darkMode, setDarkMode] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Check localStorage and system preference on mount
    const stored = localStorage.getItem('darkMode')
    if (stored !== null) {
      setDarkMode(stored === 'true')
    } else {
      setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }, [])

  useEffect(() => {
    // Update class and localStorage when darkMode changes
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  // Close mobile menu on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const navLinks = [
    { href: '/tests', label: 'Tests' },
    { href: '/branches', label: 'Branches' },
  ]

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              {/* Logo */}
              <div className="flex items-center">
                <a href="/" className="flex items-center gap-2.5">
                  <img src="/logo-argus.svg" alt="Argus" className="w-8 h-8" />
                  <div className="flex flex-col">
                    <span className="font-heading font-semibold text-gray-900 dark:text-white">
                      Argus
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 -mt-0.5 hidden sm:block">
                      Visual Regression Testing
                    </span>
                  </div>
                </a>
              </div>

              {/* Desktop navigation */}
              <div className="hidden md:flex items-center gap-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                {user && (
                  <div className="flex items-center gap-3 ml-2 pl-4 border-l border-gray-200 dark:border-gray-700">
                    {user.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt={user.name || ''}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user.name}
                    </span>
                    <form action="/auth/logout" method="POST">
                      <button
                        type="submit"
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Sign out"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <div className="flex items-center gap-2 md:hidden">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  {mobileMenuOpen ? (
                    <X className="w-6 h-6" />
                  ) : (
                    <Menu className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <div
            className={cn(
              'md:hidden overflow-hidden transition-all duration-300 ease-in-out',
              mobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="px-4 py-2 space-y-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-base font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  {link.label}
                </a>
              ))}
              {user && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 mt-1 pt-2">
                  <div className="flex items-center gap-2">
                    {user.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt={user.name || ''}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user.name}
                    </span>
                  </div>
                  <form action="/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </nav>
        <main>
          <Outlet />
        </main>
        <Scripts />
      </body>
    </html>
  )
}
