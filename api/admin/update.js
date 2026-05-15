// api/admin/update.js  POST /api/admin/update
import { sb, cors } from '../../lib/db.js'
import { checkSession } from './login.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { token, orderId, status, itemId, qty, itemStatus } = req.body ?? {}
  if (!checkSession(token))  return res.status(401).json({ error: 'unauthorized' })
  if (!orderId || !status)   return res.status(400).json({ error: 'missing_fields' })

  // 1. อัปเดต status ของ order
  const { error: oErr } = await sb
    .from('orders')
    .update({ status: String(status).slice(0, 100) })
    .eq('order_id', orderId)
  if (oErr) return res.status(500).json({ error: oErr.message })

  // 2. อัปเดต qty + item_status ของ item นั้น
  if (itemId) {
    const updates = {}
    if (qty !== undefined) updates.qty = Math.max(0, Math.min(10, Number(qty)))
    if (itemStatus)        updates.item_status = String(itemStatus).slice(0, 50)

    if (Object.keys(updates).length > 0) {
      const { error: iErr } = await sb
        .from('order_items')
        .update(updates)
        .eq('id', itemId)
      if (iErr) return res.status(500).json({ error: iErr.message })
    }
  }

  res.json({ status: 'success' })
}