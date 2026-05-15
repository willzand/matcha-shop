import { createHash, randomUUID } from 'crypto'
import { sb, cors } from '../../lib/db.js'

const TTL_MIN = 60

function hash(s) {
  return createHash('sha256')
    .update(s + (process.env.PASS_SALT ?? ''))
    .digest('hex')
}

export async function checkSession(token) {
  if (!token) return false
  try {
    const { data } = await sb
      .from('admin_sessions')
      .select('expires_at')
      .eq('token', token)
      .single()
    if (!data) return false
    if (new Date(data.expires_at) < new Date()) {
      await sb.from('admin_sessions').delete().eq('token', token)
      return false
    }
    const newExp = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString()
    await sb.from('admin_sessions').update({ expires_at: newExp }).eq('token', token)
    return true
  } catch { return false }
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { action, token, password } = req.body ?? {}

  if (action === 'adminLogout') {
    if (token) await sb.from('admin_sessions').delete().eq('token', token)
    return res.status(200).json({ success: true })
  }

  if (!process.env.ADMIN_PASS_HASH)
    return res.status(500).json({ error: 'admin_not_configured' })

  if (hash(password ?? '') !== process.env.ADMIN_PASS_HASH)
    return res.status(401).json({ success: false })

  const t = randomUUID()
  const exp = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString()
  await sb.from('admin_sessions').insert({ token: t, expires_at: exp })

  return res.status(200).json({ success: true, token: t })
}