'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  const navLinks = [
    { label: '📊 Overview', href: '/admin' },
    { label: '🏛️ Faculties', href: '/admin/faculties' },
    { label: '📂 Departments', href: '/admin/departments' },
    { label: '📖 Courses', href: '/admin/courses' },
    { label: '👥 Users', href: '/admin/users' },
    { label: '🏦 Question Bank', href: '/admin/question-bank' },
    { label: '📝 Sessions', href: '/admin/sessions' },
    { label: '📊 Analytics', href: '/admin/analytics' },
    { label: '📚 Shared Materials', href: '/admin/shared-materials' },
  ]

  return (
    <div className="min-h-screen bg-gray-900">

      {/* Top Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: '#1f2937', color: 'white',
        padding: '12px 16px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        zIndex: 40
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setOpen(!open)}
            style={{
              background: 'none', border: 'none', color: 'white',
              fontSize: '20px', cursor: 'pointer', padding: '4px 8px',
              borderRadius: '6px'
            }}>
            {open ? '✕' : '☰'}
          </button>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>⚙️ Admin Panel</span>
        </div>
        <button onClick={() => router.push('/dashboard')}
          style={{
            fontSize: '12px', background: 'none',
            border: '1px solid #374151', padding: '6px 12px',
            borderRadius: '6px', cursor: 'pointer', color: '#d1d5db'
          }}>
          ← Back to App
        </button>
      </nav>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 45
          }}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        height: '100%',
        width: '240px',
        background: '#111827',
        color: 'white',
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(-240px)',
        transition: 'transform 0.3s ease',
        overflowY: 'auto',
        paddingTop: '24px'
      }}>
        <div style={{ padding: '24px' }}>
          <button onClick={() => setOpen(false)}
            style={{
              background: 'none', border: 'none', color: '#9ca3af',
              fontSize: '13px', cursor: 'pointer', marginBottom: '24px',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
            ✕ Close
          </button>

          <div style={{ marginBottom: '8px' }}>
            <p style={{ fontWeight: 700, fontSize: '16px' }}>⚙️ Admin Panel</p>
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>NOUN TMA Assistant</p>
          </div>

          <div style={{
            height: '1px', background: '#374151',
            margin: '16px 0'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navLinks.map(link => (
              <a key={link.href} href={link.href}
                style={{
                  fontSize: '13px', padding: '10px 12px',
                  borderRadius: '8px', textDecoration: 'none',
                  background: pathname === link.href ? '#374151' : 'transparent',
                  color: pathname === link.href ? 'white' : '#9ca3af',
                  fontWeight: pathname === link.href ? 600 : 400,
                  transition: 'background 0.2s'
                }}>
                {link.label}
              </a>
            ))}
          </div>

          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #374151' }}>
            <button onClick={() => router.push('/dashboard')}
              style={{
                width: '100%', fontSize: '12px', color: '#6b7280',
                background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', padding: '8px 0'
              }}>
              ← Back to App
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ paddingTop: '56px', padding: '72px 32px 32px', color: 'white' }}>
        {children}
      </main>
    </div>
  )
}