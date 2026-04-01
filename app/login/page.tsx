// app/login/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [nurseId, setNurseId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: dbError } = await supabase
      .from('nurses')
      .select('hashed_password')
      .eq('nurse_id', nurseId.trim())
      .single()

    if (dbError || !data) {
      setError('Invalid Nurse ID')
      setLoading(false)
      return
    }

    if (data.hashed_password === password) {
      // Force redirect - more reliable on Vercel
      window.location.href = '/dashboard'
    } else {
      setError('Incorrect password')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Nursing Competencies 2026</h1>
          <p className="text-gray-600">Sign in with your Nurse ID</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Nurse ID</label>
            <input
              type="text"
              value={nurseId}
              onChange={(e) => setNurseId(e.target.value)}
              className="w-full px-4 py-3 border rounded-2xl focus:outline-none focus:border-blue-500"
              placeholder="e.g. 3822293"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-2xl focus:outline-none focus:border-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-2xl disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-8">
          Contact your administrator if you forgot your password
        </p>
      </div>
    </div>
  )
}