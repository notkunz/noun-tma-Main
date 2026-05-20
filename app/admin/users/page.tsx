'use client'
import { useEffect, useState } from 'react'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.matric_number?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Users ({users.length})</h2>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Search by name, matric or email..."
        className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 mb-6" />

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => (
            <div key={u.id} className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{u.full_name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {u.matric_number} | {u.email}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {u.department} | {u.level} Level
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
      )}
    </div>
  )
}