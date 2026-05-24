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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      const { data: profile } = await supabase
        .from('users').select('id, full_name')
        .eq('auth_id', user.id).single() as { data: any }
      setUser(profile)
      setUserId(profile?.id)
      const { data: walletData } = await supabase
        .from('wallets').select('balance')
        .eq('user_id', profile?.id).single() as { data: any }
      setWallet(walletData?.balance || 0)
    }
    load()
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('wallet-changes')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'wallets',
        filter: `user_id=eq.${userId}`
      }, (payload: any) => { setWallet(payload.new.balance) })
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
    //{ label: '📱 Quick Answer', href: '/dashboard/quick-answer' },
    { label: '📝 My TMAs', href: '/dashboard/my-tmas' },
    { label: '💰 Wallet', href: '/dashboard/wallet' },
    { label: '👤 Profile', href: '/dashboard/profile' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Navbar */}
      <nav className="bg-green-700 text-white px-4 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen(!open)}
            className="p-2 rounded-lg hover:bg-green-600 transition text-xl">
            {open ? '✕' : '☰'}
          </button>
          <span className="font-bold text-lg">📚 NOUN TMA</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-green-200 text-xs">Wallet</p>
            <p className="font-bold text-sm">₦{wallet.toLocaleString()}</p>
          </div>
          <button onClick={() => router.push('/dashboard/wallet')}
            className="text-xs bg-white text-green-700 px-3 py-1.5 rounded-full font-bold hover:bg-green-50">
            Top Up
          </button>
        </div>
      </nav>

      {/* Dark overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 45
          }}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        height: '100%',
        width: '260px',
        background: '#15803d',
        color: 'white',
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(-260px)',
        transition: 'transform 0.3s ease',
        overflowY: 'auto'
      }}>
        <div style={{ padding: '24px' }}>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'none', border: 'none', color: '#bbf7d0',
              fontSize: '14px', cursor: 'pointer', marginBottom: '24px',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
            ✕ Close menu
          </button>

          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', color: '#bbf7d0' }}>Logged in as</p>
            <p style={{ fontWeight: 700 }}>{user?.full_name || 'Student'}</p>
          </div>

          <div style={{
            background: '#16a34a', borderRadius: '12px',
            padding: '16px', marginBottom: '24px'
          }}>
            <p style={{ fontSize: '11px', color: '#bbf7d0', marginBottom: '4px' }}>Wallet Balance</p>
            <p style={{ fontSize: '24px', fontWeight: 700 }}>₦{wallet.toLocaleString()}</p>
            <button
              onClick={() => router.push('/dashboard/wallet')}
              style={{
                marginTop: '8px', fontSize: '11px', background: 'white',
                color: '#15803d', border: 'none', padding: '4px 12px',
                borderRadius: '999px', fontWeight: 600, cursor: 'pointer'
              }}>
              Top Up
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navLinks.map(link => (
              <a key={link.href} href={link.href}
                style={{
                  fontSize: '14px', padding: '10px 12px',
                  borderRadius: '8px', textDecoration: 'none',
                  background: pathname === link.href ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: pathname === link.href ? 'white' : '#dcfce7',
                  fontWeight: pathname === link.href ? 700 : 400,
                  transition: 'background 0.2s'
                }}>
                {link.label}
              </a>
            ))}
          </div>

          <div style={{
            marginTop: '24px', paddingTop: '24px',
            borderTop: '1px solid #16a34a'
          }}>
            <button onClick={handleLogout}
              style={{
                width: '100%', fontSize: '13px', background: '#14532d',
                color: 'white', border: 'none', padding: '10px 12px',
                borderRadius: '8px', cursor: 'pointer', textAlign: 'left'
              }}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-16 p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}