'use client'
import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

const AMOUNTS = [500, 1000, 2000, 5000]

function WalletContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [amount, setAmount] = useState(1000)
  const [provider, setProvider] = useState<'paystack' | 'flutterwave'>('paystack')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadWallet()
    const verify = searchParams.get('verify')
    const reference = searchParams.get('reference') || searchParams.get('transaction_id')
    if (verify && reference) handleVerify(verify, reference)
  }, [])

  const loadWallet = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users').select('id').eq('auth_id', user.id).single() as { data: { id: string } | null }

    if (!profile) return

    const { data: w } = await supabase
      .from('wallets').select('balance').eq('user_id', profile.id).single()
    setBalance((w as any)?.balance || 0)

    const { data: t } = await supabase
      .from('transactions').select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setTransactions(t || [])
  }

  const handleVerify = async (provider: string, reference: string) => {
    const res = await fetch('/api/wallet/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, provider })
    })
    const data = await res.json()
    if (data.success) {
      setMessage(`✅ ₦${data.amount} added to your wallet!`)
      loadWallet()
    }
  }

  const handleTopUp = async () => {
    setLoading(true)
    const res = await fetch('/api/wallet/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, provider })
    })
    const data = await res.json()
    setLoading(false)
    if (data.url) window.location.href = data.url
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">My Wallet</h2>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl mb-6">
          {message}
        </div>
      )}

      <div className="bg-green-700 text-white rounded-2xl p-6 mb-6">
        <p className="text-green-200 text-sm">Available Balance</p>
        <p className="text-4xl font-bold mt-1">₦{balance.toLocaleString()}</p>
        <p className="text-green-300 text-xs mt-2">Each TMA session costs ₦400 – ₦500</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
        <h3 className="font-bold text-gray-700 mb-4">Top Up Wallet</h3>

        <div className="flex gap-3 mb-4 flex-wrap">
          {AMOUNTS.map(a => (
            <button key={a}
              onClick={() => setAmount(a)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                amount === a
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
              }`}>
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>

        <input
          type="number"
          placeholder="Or enter custom amount"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="w-full border rounded-lg p-3 text-sm mb-4"
        />

        <div className="flex gap-3 mb-4">
          {(['paystack'] as const).map(p => (
            <button key={p}
              onClick={() => setProvider(p)}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold capitalize transition ${
                provider === p
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
              }`}>
              {p === 'paystack' ? '💳 Paystack' : '🦋 Flutterwave'}
            </button>
          ))}
        </div>

        <button onClick={handleTopUp} disabled={loading || amount < 100}
          className="w-full bg-green-600 text-white rounded-xl p-4 font-bold hover:bg-green-700 disabled:opacity-50">
          {loading ? 'Redirecting...' : `Pay ₦${amount.toLocaleString()} via ${provider}`}
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-bold text-gray-700 mb-4">Transaction History</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t.description}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleDateString()} &nbsp;|&nbsp;
                    <span className={t.status === 'success' ? 'text-green-500' : 'text-red-400'}>
                      {t.status}
                    </span>
                  </p>
                </div>
                <span className={`font-bold text-sm ${
                  t.type === 'credit' ? 'text-green-600' : 'text-red-500'
                }`}>
                  {t.type === 'credit' ? '+' : '-'}₦{t.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading wallet...</div>}>
      <WalletContent />
    </Suspense>
  )
}