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

    const cleanedId = nurseId.trim()
    const email = `jhn.nursing.department+${cleanedId}@gmail.com`

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Invalid Nurse ID or password')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* FABULOUS CAT HEADER - RESIZED FOR MOBILE */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 sm:p-8 flex justify-center">
          <img 
            src="/fabulous-cat.jpg" 
            alt="Fabulous Cat" 
            className="w-40 h-40 sm:w-48 sm:h-48 object-contain drop-shadow-2xl mx-auto"
          />
        </div>

        <div className="p-8">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
            Nursing Competencies 2026
          </h1>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Nurse ID</label>
              <input
                type="text"
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-2xl disabled:opacity-50 transition"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-8">
            Contact your administrator if you forgot your password
          </p>
        </div>
      </div>
    </div>
  )
}