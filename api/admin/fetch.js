// api/admin/fetch.js  GET /api/admin/fetch?token=xxx
import { sb, cors } from '../../lib/db.js'
import { checkSession } from './login.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!checkSession(req.query.token))
    return res.status(401).json({ error: 'unauthorized' })

  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) return res.status(500).json({ error: error.message })

  // Flatten to shape admin panel table expects
  const rows = []
  for (const order of data) {
    for (const item of (order.order_items ?? [])) {
      rows.push({
        row:      item.id,
        orderId:  order.order_id,
        date:     new Date(order.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
        name:     order.customer_name,
        brand:    item.brand ?? '',
        itemName: item.product_name,
        qty:      item.qty,
        status:   order.status,
        imageUrl: item.image_url ?? 'https://via.placeholder.com/60?text=No+Img'
      })
    }
  }
  res.json(rows)
}
