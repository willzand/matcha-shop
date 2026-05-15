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

  let actualJPY = 0, actualTHB = 0
  const lines = []

  for (const item of order.order_items) {
    const qty    = Number(item.qty) || 0
    const status = item.item_status || ''
    const subJPY = qty * Number(item.price_jpy)
    const subTHB = qty * Number(item.price_thb)

    let icon = qty === 0 ? '❌' : status.includes('หมด') ? '❌' : status.includes('บางส่วน') ? '⚠️' : '✅'

    if (qty > 0) {
      actualJPY += subJPY
      actualTHB += subTHB
      lines.push(`${icon} ${item.product_name} ×${qty}\n   ${subJPY.toLocaleString()} ¥ / ${subTHB.toLocaleString()} ฿`)
    } else {
      lines.push(`❌ ${item.product_name} — ของหมด`)
    }
  }

  let msg = `📦 อัปเดตออเดอร์ ${order.order_id}\n`
  msg += `📋 สถานะ: ${order.status}\n`
  msg += `━━━━━━━━━━━━━━━━\n`
  msg += lines.join('\n') + '\n'
  msg += `━━━━━━━━━━━━━━━━\n`
  msg += `💴 ยอดที่ต้องชำระ: ${actualJPY.toLocaleString()} JPY\n`
  msg += `💵 ยอดที่ต้องชำระ: ${actualTHB.toLocaleString()} THB`

  await lineMessage(order.line_user_id, msg)
  res.json({ status: 'success' })
}