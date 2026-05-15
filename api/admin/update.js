// api/admin/update.js  POST /api/admin/update
import { sb, cors } from '../../lib/db.js'
import { checkSession } from './login.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { token, orderId, status, itemId, qty } = req.body ?? {}
  if (!checkSession(token))  return res.status(401).json({ error: 'unauthorized' })
  if (!orderId || !status)   return res.status(400).json({ error: 'missing_fields' })

  // 1. อัปเดต status ของ order
  const { error: oErr } = await sb
    .from('orders')
    .update({ status: String(status).slice(0, 100) })
    .eq('order_id', orderId)
  if (oErr) return res.status(500).json({ error: oErr.message })

  // 2. ถ้าส่ง itemId + qty มาด้วย → อัปเดต qty ของ item นั้น
  if (itemId && qty !== undefined) {
    const newQty = Math.max(0, Math.min(10, Number(qty)))
    const { error: iErr } = await sb
      .from('order_items')
      .update({ qty: newQty })
      .eq('id', itemId)
    if (iErr) return res.status(500).json({ error: iErr.message })
  }

  res.json({ status: 'success' })
}