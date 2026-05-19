'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function UsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*, wallets(balance)')
      .order('created_at', { ascending: false })
    setUsers(data || [])
  }

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.matric_number.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Users ({users.length})</h2>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Search by name, matric or email..."
        className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 mb-6" />

      <div className="space-y-3">
        {filtered.map(u => (
          <div key={u.id} className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{u.full_name}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {u.matric_number} &nbsp;|&nbsp; {u.email}
                </p>
                <p className="text-gray-400 text-xs">
                  {u.department} &nbsp;|&nbsp; {u.level} Level
                </p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold">
                  ₦{u.wallets?.balance?.toLocaleString() || '0'}
                </p>
                <p className="text-gray-500 text-xs">wallet</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}