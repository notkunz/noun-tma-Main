'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [wallet, setWallet] = useState<number>(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('auth_id', user.id)
        .single()

      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      setUser(profile)
      setWallet(walletData?.balance || 0)
    }
    load()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-green-700 text-white flex flex-col p-6 fixed h-full">
        <div className="mb-8">
          <h1 className="text-xl font-bold">📚 NOUN TMA</h1>
          <p className="text-green-200 text-sm mt-1">Assistant</p>
        </div>

        {/* Wallet Balance */}
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
        <nav className="flex flex-col gap-2 flex-1">
          {[
            { label: '🏠 Dashboard', href: '/dashboard' },
            { label: '📖 All Courses', href: '/dashboard/courses' },
            { label: '📝 My TMAs', href: '/dashboard/my-tmas' },
            { label: '💰 Wallet', href: '/dashboard/wallet' },
            { label: '👤 Profile', href: '/dashboard/profile' },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="text-sm text-green-100 hover:bg-green-600 px-3 py-2 rounded-lg transition">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="mt-auto">
          <p className="text-green-300 text-xs mb-2">
            {user?.full_name || 'Student'}
          </p>
          <button onClick={handleLogout}
            className="w-full text-sm bg-green-800 hover:bg-green-900 px-3 py-2 rounded-lg text-left">
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-8">
        {children}
      </main>
    </div>
  )
}