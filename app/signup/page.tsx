'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', matric_number: '',
    phone: '', faculty: '', department: '', level: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    const data = await res.json()
    setLoading(false)

    if (data.error) return setError(data.error)
    router.push('/login?registered=true')
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-green-700 mb-2">Create Account</h1>
        <p className="text-gray-500 text-sm mb-6">NOUN TMA Assistant</p>

        {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="full_name" placeholder="Full Name" required
            onChange={handleChange} className="w-full border rounded-lg p-3 text-sm" />
          <input name="matric_number" placeholder="Matric Number (e.g. NOU123456789)" required
            onChange={handleChange} className="w-full border rounded-lg p-3 text-sm uppercase" />
          <input name="email" type="email" placeholder="Email Address" required
            onChange={handleChange} className="w-full border rounded-lg p-3 text-sm" />
          <input name="phone" placeholder="Phone Number" required
            onChange={handleChange} className="w-full border rounded-lg p-3 text-sm" />
          <input name="password" type="password" placeholder="Password (min 8 chars)" required minLength={8}
            onChange={handleChange} className="w-full border rounded-lg p-3 text-sm" />
          <input name="faculty" placeholder="Faculty (e.g. Science & Technology)" required
            onChange={handleChange} className="w-full border rounded-lg p-3 text-sm" />
          <input name="department" placeholder="Department (e.g. Computer Science)" required
            onChange={handleChange} className="w-full border rounded-lg p-3 text-sm" />
          <select name="level" required onChange={handleChange}
            className="w-full border rounded-lg p-3 text-sm text-gray-600">
            <option value="">Select Level</option>
            {['100','200','300','400'].map(l => (
              <option key={l} value={l}>{l} Level</option>
            ))}
          </select>

          <button type="submit" disabled={loading}
            className="w-full bg-green-600 text-white rounded-lg p-3 font-semibold hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account? <a href="/login" className="text-green-600 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  )
}