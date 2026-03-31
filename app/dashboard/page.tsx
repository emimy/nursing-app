// app/dashboard/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import SignaturePad from 'signature_pad'

const DOCUMENT_NAME = "Nursing General Competencies 2026-compressed.pdf"

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<any>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // Simple public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(DOCUMENT_NAME)

      setDocumentUrl(publicUrl)
      setLoading(false)

      if (canvasRef.current) {
        signaturePadRef.current = new SignaturePad(canvasRef.current, {
          backgroundColor: '#fff',
          penColor: '#000',
        })
      }
    }
    init()
  }, [router])

  const handleSign = () => {
    if (!signaturePadRef.current) return
    alert(`✅ Signed successfully by ${user?.email}!`)
    signaturePadRef.current.clear()
  }

  const clearSignature = () => {
    signaturePadRef.current?.clear()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-bold">Nursing General Competencies 2026</h1>
          <div className="flex items-center gap-4">
            <span>{user?.email}</span>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="px-6 py-2 bg-red-600 text-white rounded-xl">
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl shadow p-8">
            <h2 className="text-2xl font-semibold mb-6">Document Preview</h2>
            {documentUrl ? (
              <iframe src={documentUrl} className="w-full h-[650px] border rounded-2xl" />
            ) : (
              <p className="text-red-500">Could not load document</p>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow p-8">
            <h2 className="text-2xl font-semibold mb-6">Draw Your Signature</h2>
            <canvas ref={canvasRef} width={600} height={280} className="border rounded-2xl" />
            <div className="flex gap-4 mt-6">
              <button onClick={clearSignature} className="flex-1 py-3 border rounded-xl">Clear</button>
              <button onClick={handleSign} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Sign Document</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}