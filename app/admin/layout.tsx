'use client'
import { useRouter } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-800 text-white flex flex-col p-6 fixed h-full">
        <div className="mb-8">
          <h1 className="text-lg font-bold text-white">⚙️ Admin Panel</h1>
          <p className="text-gray-400 text-xs mt-1">NOUN TMA Assistant</p>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { label: '📊 Overview', href: '/admin' },
            { label: '🏛️ Faculties', href: '/admin/faculties' },
            { label: '📂 Departments', href: '/admin/departments' },
            { label: '📖 Courses', href: '/admin/courses' },
            { label: '👥 Users', href: '/admin/users' },
            { label: '🏦 Question Bank', href: '/admin/question-bank' },
            { label: '📝 Sessions', href: '/admin/sessions' },
            { label: '📊 Analytics', href: '/admin/analytics' },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="text-sm text-gray-300 hover:bg-gray-700 px-3 py-2 rounded-lg transition">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="mt-auto">
          <button onClick={() => router.push('/dashboard')}
            className="w-full text-xs text-gray-400 hover:text-white py-2">
            ← Back to App
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-8 text-white">
        {children}
      </main>
    </div>
  )
}