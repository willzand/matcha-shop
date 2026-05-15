// api/order.js  POST /api/order
import { sb, verifyLineToken, lineMessage, genOrderId, cors } from '../lib/db.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { customerName, cart, idToken } = req.body ?? {}

  // ── Basic validation ──────────────────────────────────────
  if (!customerName?.trim())
    return res.status(400).json({ status: 'error', error: 'missing_name' })
  if (!Array.isArray(cart) || !cart.length)
    return res.status(400).json({ status: 'error', error: 'empty_cart' })

  // ── Verify LINE token (optional, but enables LINE confirmation) ──
  const lineUserId = idToken ? await verifyLineToken(idToken) : null

  // ── Load catalog & validate cart prices server-side ───────
  const { data: catalogRows, error: catErr } = await sb
    .from('catalog')
    .select('product_name, brand, price_jpy, price_thb, image_id, status')

  if (catErr) return res.status(500).json({ status: 'error', error: 'catalog_load_failed' })

  const priceMap = {}
  for (const r of catalogRows) {
    const st = String(r.status ?? '').trim().toLowerCase()
    priceMap[`${r.product_name}||${r.brand ?? ''}`] = {
      jpy:     Number(r.price_jpy) || 0,
      thb:     Number(r.price_thb) || 0,
      imageId: r.image_id ?? '',
      soldOut: ['หมด', 'out of stock', 'sold out'].includes(st)
    }
  }

  const validated = []
  let totalJPY = 0, totalTHB = 0

  for (const ci of cart) {
    const name  = String(ci.name  ?? '').slice(0, 200).trim()
    const brand = String(ci.brand ?? '').slice(0, 100).trim()
    const qty   = Number(ci.qty)

    if (!Number.isFinite(qty) || qty < 1 || qty > 10)
      return res.status(400).json({ status: 'error', error: 'bad_qty', item: name })

    const truth = priceMap[`${name}||${brand}`]
    if (!truth)
      return res.status(400).json({ status: 'error', error: 'unknown_item', item: name })
    if (truth.soldOut)
      return res.status(400).json({ status: 'error', error: 'sold_out', item: name })

    const imageUrl = truth.imageId
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(truth.imageId)}&sz=w400`
      : ''

    validated.push({ name, brand, qty, jpy: truth.jpy, thb: truth.thb, imageUrl })
    totalJPY += truth.jpy * qty
    totalTHB += truth.thb * qty
  }

  // ── Save order ────────────────────────────────────────────
  const orderId = genOrderId()

  const { error: oErr } = await sb.from('orders').insert({
    order_id:      orderId,
    customer_name: customerName.trim(),
    line_user_id:  lineUserId,
    total_jpy:     totalJPY,
    total_thb:     totalTHB,
    status:        '⏳ กำลังตามหา'
  })
  if (oErr) return res.status(500).json({ status: 'error', error: oErr.message })

  const { error: iErr } = await sb.from('order_items').insert(
    validated.map(v => ({
      order_id:     orderId,
      brand:        v.brand,
      product_name: v.name,
      qty:          v.qty,
      price_jpy:    v.jpy,
      price_thb:    v.thb,
      image_url:    v.imageUrl
    }))
  )
  if (iErr) return res.status(500).json({ status: 'error', error: iErr.message })

  // ── LINE confirmation to customer ─────────────────────────
  if (lineUserId) {
    let msg = `✅ รับออเดอร์ ${orderId} แล้วครับ!\n\n🍵 รายการ:\n`
    for (const v of validated)
      msg += `• ${v.name} ×${v.qty}  (${(v.jpy * v.qty).toLocaleString()} ¥)\n`
    msg += `\n💴 รวม: ${totalJPY.toLocaleString()} JPY`
    msg += `\n💵 รวม: ${totalTHB.toLocaleString()} THB`
    msg += `\n\nแอดมินจะดำเนินการโดยเร็วครับ 🍵`
    await lineMessage(lineUserId, msg)
  }

  return res.status(200).json({ status: 'success', orderId, totalJPY, totalTHB })
}
