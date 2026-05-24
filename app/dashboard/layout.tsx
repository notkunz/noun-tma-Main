'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [wallet, setWallet] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: profile } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('auth_id', user.id)
        .single() as { data: any }

      setUser(profile)
      setUserId(profile?.id)

      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', profile?.id)
        .single() as { data: any }

      setWallet(walletData?.balance || 0)
    }
    load()
  }, [])

  // Auto-close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Live wallet subscription
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('wallet-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${userId}`
      }, (payload: any) => {
        setWallet(payload.new.balance)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinks = [
    { label: '🏠 Dashboard', href: '/dashboard' },
    { label: '📖 All Courses', href: '/dashboard/courses' },
    { label: '📱 Quick Answer', href: '/dashboard/quick-answer' },
    { label: '📝 My TMAs', href: '/dashboard/my-tmas' },
    { label: '💰 Wallet', href: '/dashboard/wallet' },
    { label: '👤 Profile', href: '/dashboard/profile' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Navbar */}
      <nav className="bg-green-700 text-white px-4 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-green-600 transition">
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <span className="font-bold text-lg">📚 NOUN TMA</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-green-200 text-xs">Wallet</p>
            <p className="font-bold text-sm">₦{wallet.toLocaleString()}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/wallet')}
            className="text-xs bg-white text-green-700 px-3 py-1.5 rounded-full font-bold hover:bg-green-50">
            Top Up
          </button>
        </div>
      </nav>

      {/* Overlay when sidebar open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

{/* Sidebar — slides in from left */}
<aside style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
  className="fixed top-0 left-0 h-full w-64 bg-green-700 text-white z-50 transition-transform duration-300">
  <div className="p-6 pt-4">
    {/* Close button */}
    <button
      onClick={() => setSidebarOpen(false)}
      className="mb-6 text-green-200 hover:text-white text-sm flex items-center gap-2">
      ✕ Close menu
    </button>

    {/* User info */}
    <div className="mb-6">
      <p className="text-green-200 text-xs">Logged in as</p>
      <p className="font-bold">{user?.full_name || 'Student'}</p>
    </div>

    {/* Wallet */}
    <div className="bg-green-600 rounded-xl p-4 mb-6">
      <p className="text-green-200 text-xs mb-1">Wallet Balance</p>
      <p className="text-2xl font-bold">₦{wallet.toLocaleString()}</p>
      <button
        onClick={() => router.push('/dashboard/wallet')}
        className="mt-2 text-xs bg-white text-green-700 px-3 py-1 rounded-full font-semibold hover:bg-green-50">
        Top Up
      </button>
    </div>

   {/* Nav Links */}
<nav className="flex flex-col gap-1">
  {navLinks.map(link => (
    <a
      key={link.href}
      href={link.href}
      className="text-sm px-3 py-2.5 rounded-lg transition text-green-100 hover:bg-green-600"
      style={{
        background: pathname === link.href ? 'rgba(255,255,255,0.2)' : undefined,
        fontWeight: pathname === link.href ? '700' : undefined
      }}>
      {link.label}
    </a>
  ))}
</nav>

    {/* Logout */}
    <div className="mt-6 pt-6 border-t border-green-600">
      <button onClick={handleLogout}
        className="w-full text-sm bg-green-800 hover:bg-green-900 px-3 py-2 rounded-lg text-left">
        🚪 Logout
      </button>
    </div>
  </div>
</aside>

      {/* Main Content */}
      <main className="pt-16 p-6">
        {children}
      </main>
    </div>
  )
}