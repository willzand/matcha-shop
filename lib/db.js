// lib/db.js — shared server-side helpers
import { createClient } from '@supabase/supabase-js'

// service_role key → bypasses RLS (server only, never expose to frontend)
export const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ── CORS ─────────────────────────────────────────────────────
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// ── LINE: verify id_token → userId or null ───────────────────
export async function verifyLineToken(idToken) {
  if (!idToken || !process.env.LINE_CHANNEL_ID) return null
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `id_token=${encodeURIComponent(idToken)}&client_id=${encodeURIComponent(process.env.LINE_CHANNEL_ID)}`
    })
    if (!res.ok) return null
    const { sub } = await res.json()
    return sub || null
  } catch { return null }
}

// ── LINE: push text message to a user ───────────────────────
export async function lineMessage(userId, text) {
  if (!userId || !process.env.LINE_TOKEN) return
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.LINE_TOKEN}`
    },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] })
  }).catch(e => console.error('LINE push error:', e))
}

// ── Generate order ID ─────────────────────────────────────────
export function genOrderId() {
  const d   = new Date()
  const pad = n => String(n).padStart(2, '0')
  const date = `${pad(d.getDate())}${pad(d.getMonth()+1)}${String(d.getFullYear()).slice(2)}`
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `ORD-${date}-${rand}`
}

// ── HTML escape ───────────────────────────────────────────────
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]
  )
}
