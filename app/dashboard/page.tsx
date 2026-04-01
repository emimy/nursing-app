// app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const DOCUMENT_NAME = "fire-electrical-radiation-safety.pdf"

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null)

  const router = useRouter()

  // Your nurse details (change these when testing different nurses)
  const nurseData = {
    name: "Lamees Almansour",
    nurseId: "3837830",
    department: "Nursing Services"
  }

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

  // Create filled PDF with auto-filled fields + signature
  const createFilledPdf = async (signatureDataUrl: string) => {
    try {
      // ✅ Use download() instead of fetch — this is the fix
      const { data: fileData, error } = await supabase.storage
        .from('documents')
        .download(DOCUMENT_NAME)

      if (error || !fileData) throw error || new Error("Failed to download PDF")

      const pdfDoc = await PDFDocument.load(fileData)
      const pages = pdfDoc.getPages()
      const firstPage = pages[0]

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      // Fill top fields
      firstPage.drawText(nurseData.name, { x: 180, y: 620, size: 14, font })
      firstPage.drawText(nurseData.nurseId, { x: 380, y: 620, size: 14, font })
      firstPage.drawText(nurseData.department, { x: 580, y: 620, size: 14, font })

      // Add signature image at the bottom
      const signatureImage = await pdfDoc.embedPng(signatureDataUrl.split(',')[1])
      firstPage.drawImage(signatureImage, {
        x: 420,
        y: 80,
        width: 180,
        height: 80,
      })

      const filledPdfBytes = await pdfDoc.save()

      // Upload the signed version
      const fileName = `signed/${nurseData.nurseId}-${Date.now()}.pdf`
      await supabase.storage.from('documents').upload(fileName, filledPdfBytes, {
        contentType: 'application/pdf',
      })

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (err: any) {
      console.error("PDF processing error:", err)
      alert("Failed to create signed PDF: " + err.message)
      return null
    }
  }

  // Listen for signature from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'SIGNED') {
        const signatureDataUrl = event.data.data
        const filledUrl = await createFilledPdf(signatureDataUrl)
        if (filledUrl) {
          setSignedPdfUrl(filledUrl)
          setShowSuccess(true)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const openSignaturePopup = () => {
    if (!documentUrl) return alert('Document not loaded yet.')

    const popupWidth = Math.floor(window.innerWidth * 0.9)
    const popupHeight = Math.floor(window.innerHeight * 0.9)
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
            h2 { margin:16px 0; text-align:center; }
            iframe { width:95%; height:48%; border:1px solid #ccc; border-radius:12px; margin-bottom:16px; }
            canvas { width:95%; max-width:700px; border:2px solid #444; border-radius:12px; touch-action:none; background:white; }
            button { margin:10px; padding:12px 24px; font-size:18px; border-radius:12px; cursor:pointer; }
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
      <div className="max-w-6xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Review Document</h2>
            {documentUrl ? (
              <iframe
                src={documentUrl}
                className="w-full h-[920px] border rounded-2xl"
                title="Document"
              />
            ) : (
              <p className="text-red-500 p-8 text-center">Could not load document</p>
            )}
          </div>

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

      {/* Success Screen */}
      {showSuccess && signedPdfUrl && (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md text-center">
            <div className="text-7xl mb-6">✅</div>
            <h2 className="text-3xl font-bold text-green-700 mb-4">Document Signed & Filled!</h2>
            <p className="text-gray-600 mb-8">Your details and signature have been added automatically.</p>

            <a
              href={signedPdfUrl}
              target="_blank"
              className="block w-full py-4 bg-green-600 text-white rounded-2xl font-medium mb-4 hover:bg-green-700"
            >
              📥 Download Signed PDF
            </a>

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-4 border border-gray-400 rounded-2xl font-medium"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}