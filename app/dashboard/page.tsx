// app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const DOCUMENT_NAME = "fire-electrical-radiation-safety.pdf"

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)

  const router = useRouter()

  // Initialize user and document URL
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(DOCUMENT_NAME)

      setDocumentUrl(publicUrl)
      setLoading(false)
    }
    init()
  }, [router])

  // Listen for signature from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SIGNED') {
        console.log('Signature received!')
        setShowSuccess(true)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Open the signing popup
  const openSignaturePopup = () => {
    if (!documentUrl) return alert('Document not loaded yet.')

    const popupWidth = Math.floor(window.innerWidth * 0.92)
    const popupHeight = Math.floor(window.innerHeight * 0.92)
    const left = window.screenX + (window.innerWidth - popupWidth) / 2
    const top = window.screenY + (window.innerHeight - popupHeight) / 2

    const popup = window.open(
      '',
      'Sign Document',
      `width=${popupWidth},height=${popupHeight},top=${top},left=${left},resizable=yes,scrollbars=yes`
    )

    if (!popup) return alert('Popup blocked! Please allow popups.')

    popup.document.write(`
      <html>
        <head>
          <title>Sign Document</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin:0; display:flex; flex-direction:column; align-items:center; font-family:sans-serif; background:#f0f0f0; }
            h2 { margin:20px 0 10px; text-align:center; font-size:1.4rem; }
            iframe { width:94%; height:48%; border:1px solid #ddd; border-radius:12px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
            canvas { width:94%; max-width:720px; height:320px; border:3px solid #444; border-radius:12px; touch-action:none; background:white; }
            button { margin:8px; padding:14px 28px; font-size:18px; border-radius:12px; cursor:pointer; }
          </style>
        </head>
        <body>
          <h2>Review Document & Draw Your Signature</h2>
          <iframe src="${documentUrl}" title="Document PDF"></iframe>
          <canvas id="canvas"></canvas>
          <div>
            <button id="clear">Clear</button>
            <button id="complete">Complete Signing</button>
          </div>
          <script>
            const canvas = document.getElementById('canvas')
            const ctx = canvas.getContext('2d')
            ctx.lineWidth = 8
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.strokeStyle = '#1f2937'
            let drawing = false

            const resizeCanvas = () => {
              canvas.width = canvas.offsetWidth
              canvas.height = 320
            }
            window.addEventListener('resize', resizeCanvas)
            window.addEventListener('orientationchange', resizeCanvas)
            resizeCanvas()

            const getPos = e => {
              const rect = canvas.getBoundingClientRect()
              let x = e.clientX - rect.left
              let y = e.clientY - rect.top
              if (e.touches) { x = e.touches[0].clientX - rect.left; y = e.touches[0].clientY - rect.top }
              return {x, y}
            }

            canvas.addEventListener('mousedown', () => drawing = true)
            canvas.addEventListener('mouseup', () => drawing = false)
            canvas.addEventListener('mousemove', e => { 
              if(!drawing) return; 
              const p = getPos(e); 
              ctx.lineTo(p.x, p.y); 
              ctx.stroke(); 
              ctx.beginPath(); 
              ctx.moveTo(p.x, p.y) 
            })
            canvas.addEventListener('mouseleave', () => drawing = false)

            canvas.addEventListener('touchstart', () => drawing = true)
            canvas.addEventListener('touchend', () => drawing = false)
            canvas.addEventListener('touchmove', e => { 
              if(!drawing) return; 
              const p = getPos(e); 
              ctx.lineTo(p.x, p.y); 
              ctx.stroke(); 
              ctx.beginPath(); 
              ctx.moveTo(p.x, p.y); 
              e.preventDefault() 
            })

            document.getElementById('clear').onclick = () => ctx.clearRect(0,0,canvas.width,canvas.height)
            document.getElementById('complete').onclick = () => {
              const dataUrl = canvas.toDataURL()
              window.opener.postMessage({ type:'SIGNED', data:dataUrl }, '*')
              window.close()
            }
          </script>
        </body>
      </html>
    `)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xl">Loading document...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Nursing General Competencies 2026</h1>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Large & Wide PDF Preview */}
          <div className="bg-white rounded-3xl shadow-lg p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4">Review Document</h2>
            {documentUrl ? (
              <iframe
                src={documentUrl}
                className="w-full"
                style={{ height: "920px" }}
                title="Document"
              />
            ) : (
              <p className="text-red-500 p-8 text-center">Could not load document</p>
            )}
          </div>

          {/* Sign Button */}
          <div className="bg-white rounded-3xl shadow-lg p-12 flex flex-col items-center justify-center">
            <div className="text-center mb-10">
              <div className="text-6xl mb-6">✍️</div>
              <h2 className="text-2xl font-semibold mb-3">Ready to Sign?</h2>
              <p className="text-gray-600">Click below to open a full signing popup</p>
            </div>

            <button
              onClick={openSignaturePopup}
              className="w-full max-w-xs py-5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-2xl active:scale-95"
            >
              Sign Document
            </button>
          </div>
        </div>
      </div>

      {/* Nice Success Confirmation Screen */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
            <div className="text-8xl mb-6">✅</div>
            <h2 className="text-3xl font-bold text-green-700 mb-4">Document Signed Successfully!</h2>
            <p className="text-gray-600 mb-8">
              Your signature has been recorded.<br />
              Signed on {new Date().toLocaleDateString()}
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-4 bg-green-600 text-white rounded-2xl font-medium hover:bg-green-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}