// api/admin/update.js  POST /api/admin/update
import { sb, cors } from '../../lib/db.js'
import { checkSession } from './login.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { token, orderId, status } = req.body ?? {}
  if (!checkSession(token))    return res.status(401).json({ error: 'unauthorized' })
  if (!orderId || !status)     return res.status(400).json({ error: 'missing_fields' })

  const { error } = await sb
    .from('orders')
    .update({ status: String(status).slice(0, 100) })
    .eq('order_id', orderId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ status: 'success' })
}
