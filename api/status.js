// api/status.js  GET /api/status?orderId=xxx&name=xxx&idToken=xxx
import { sb, verifyLineToken, cors } from '../lib/db.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { orderId, name, idToken } = req.query

  const lineUserId  = idToken ? await verifyLineToken(idToken) : null
  const safeOrderId = String(orderId ?? '').slice(0, 50).trim().toUpperCase()
  const safeName    = String(name    ?? '').slice(0, 100).trim()

  if (!lineUserId && !(safeName && safeOrderId))
    return res.status(401).json({ error: 'auth_required' })

  let query = sb
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (lineUserId) {
    query = query.eq('line_user_id', lineUserId)
  } else {
    query = query
      .ilike('customer_name', `%${safeName}%`)
      .eq('order_id', safeOrderId)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Flatten to shape frontend renderStatusTbl() expects
  const result = []
  for (const order of (data ?? [])) {
    for (const item of (order.order_items ?? [])) {
      const qty       = Number(item.qty) || 0
      const itemSt    = item.item_status || ''
      const soldOut   = itemSt.includes('หมด') || qty === 0
      result.push({
        orderId:      order.order_id,
        date:         new Date(order.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
        name:         order.customer_name,
        brand:        item.brand,
        itemName:     item.product_name,
        qty:          qty,
        priceJPY:     item.price_jpy,
        priceTHB:     item.price_thb,
        subTotalJPY:  soldOut ? 0 : item.price_jpy * qty,
        subTotalTHB:  soldOut ? 0 : item.price_thb * qty,
        status:       order.status,
        itemStatus:   itemSt,
        imageUrl:     item.image_url ?? ''
      })
    }
  }

  res.json(result)
}