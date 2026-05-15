// api/admin/login.js  POST /api/admin/login
import { createHash, randomUUID } from 'crypto'
import { cors } from '../../lib/db.js'

const TTL      = 30 * 60 * 1000   // 30 min sliding
const sessions = new Map()         // token → expiry ms
const lockouts = new Map()         // ip   → { count, until }

export function checkSession(token) {
  if (!token) return false
  const exp = sessions.get(token)
  if (!exp || Date.now() > exp) { sessions.delete(token); return false }
  sessions.set(token, Date.now() + TTL)  // slide
  return true
}

function hash(s) {
  return createHash('sha256')
    .update(s + (process.env.PASS_SALT ?? ''))
    .digest('hex')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { action, token, password } = req.body ?? {}

  // ── Logout ────────────────────────────────────────────────
  if (action === 'adminLogout') {
    if (token) sessions.delete(token)
    return res.status(200).json({ success: true })
  }

  // ── Login ─────────────────────────────────────────────────
  const ip   = (req.headers['x-forwarded-for'] ?? 'local').split(',')[0].trim()
  const lock = lockouts.get(ip) ?? { count: 0, until: 0 }

  if (Date.now() < lock.until)
    return res.status(429).json({ locked: true, waitMin: Math.ceil((lock.until - Date.now()) / 60000) })

  if (!process.env.ADMIN_PASS_HASH)
    return res.status(500).json({ error: 'admin_not_configured' })

  if (hash(password ?? '') !== process.env.ADMIN_PASS_HASH) {
    lock.count++
    if (lock.count >= 5) lock.until = Date.now() + 15 * 60 * 1000
    lockouts.set(ip, lock)
    return res.status(401).json({ success: false, remaining: Math.max(0, 5 - lock.count) })
  }

  // ── Success ───────────────────────────────────────────────
  lockouts.delete(ip)
  const t = randomUUID()
  sessions.set(t, Date.now() + TTL)
  return res.status(200).json({ success: true, token: t })
}
