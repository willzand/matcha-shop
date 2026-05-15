// api/admin/sendline.js  POST /api/admin/sendline
import { sb, lineMessage, cors } from '../../lib/db.js'
import { checkSession } from './login.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { token, orderId } = req.body ?? {}
  if (!checkSession(token))  return res.status(401).json({ error: 'unauthorized' })
  if (!orderId)              return res.status(400).json({ error: 'missing_orderId' })

  const { data: order, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_id', orderId)
    .single()

  if (error || !order) return res.status(404).json({ error: 'order_not_found' })
  if (!order.line_user_id) return res.status(400).json({ error: 'no_line_user' })

  let msg = `📦 อัปเดตออเดอร์ ${order.order_id}\n`
  msg += `📋 สถานะ: ${order.status}\n\n🍵 รายการ:\n`
  for (const item of order.order_items)
    msg += `• ${item.product_name} ×${item.qty}\n`
  msg += `\n💴 รวม: ${Number(order.total_jpy).toLocaleString()} JPY`

  await lineMessage(order.line_user_id, msg)
  res.json({ status: 'success' })
}
