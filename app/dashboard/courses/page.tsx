'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CoursesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [materials, setMaterials] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [wallet, setWallet] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users').select('id')
        .eq('auth_id', user.id).single() as { data: any }
      setUserId(profile?.id)

      const { data: w } = await supabase
        .from('wallets').select('balance')
        .eq('user_id', profile?.id).single() as { data: any }
      setWallet(w?.balance || 0)

      const { data } = await supabase
        .from('shared_materials')
        .select('*')
        .eq('material_indexed', true)
        .order('course_code')
      setMaterials(data || [])
      setFiltered(data || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(materials)
    } else {
      setFiltered(
        materials.filter(m =>
          m.course_code.toLowerCase().includes(search.toLowerCase())
        )
      )
    }
  }, [search, materials])

  const startTMA = async (courseCode: string) => {
    setStarting(courseCode)
    setError('')

    // Find or create a course entry for this course code
    const res = await fetch('/api/tma/start-by-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_code: courseCode })
    })
    const data = await res.json()
    setStarting(null)

    if (data.error) return setError(data.error)
    router.push(`/dashboard/tma/${data.course_id}`)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">All Courses</h2>
      <p className="text-gray-500 text-sm mb-6">
        Search for your course and begin your TMA
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Wallet warning */}
      {wallet < 400 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
          <p className="text-yellow-800 text-sm font-semibold">
            Low wallet balance — ₦{wallet.toLocaleString()}
          </p>
          <button
            onClick={() => router.push('/dashboard/wallet')}
            className="text-xs text-yellow-700 underline mt-1">
            Top up to start a TMA
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by course code e.g. GST101, MAC212..."
          value={search}
          onChange={e => setSearch(e.target.value.toUpperCase())}
          className="w-full border border-gray-200 rounded-xl p-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400 text-black"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-gray-500 text-sm">
            {search ? `No course found for "${search}"` : 'No courses available yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id}
              className="bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 text-lg">{m.course_code}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Ready
                  </span>
                  <span className="text-xs text-gray-400">Cost:400</span>
                </div>
              </div>
              <button
                onClick={() => startTMA(m.course_code)}
                disabled={starting === m.course_code}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 shrink-0">
                {starting === m.course_code ? 'Starting...' : 'Start TMA'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}