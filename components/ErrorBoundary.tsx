'use client'
import { useEffect } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border p-10 max-w-md text-center">
        <p className="text-5xl mb-4">😵</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-6">
          The AI might be temporarily unavailable. Your session and wallet are safe.
        </p>
        <button onClick={reset}
          className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700">
          Try Again
        </button>
      </div>
    </div>
  )
}