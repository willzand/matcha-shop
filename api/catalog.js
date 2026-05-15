// api/catalog.js  GET /api/catalog
import { sb, cors } from '../lib/db.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { data, error } = await sb
    .from('catalog')
    .select('*')
    .order('brand').order('product_name')

  if (error) return res.status(500).json({ error: error.message })

  // Map to same field names the frontend already uses (no HTML changes needed)
  res.json(data.map(r => ({
    'Brand':        r.brand         ?? '',
    'Product Name': r.product_name  ?? '',
    'Weight':       r.weight        ?? '',
    'Price_JPY':    r.price_jpy     ?? 0,
    'Price_THB':    r.price_thb     ?? 0,
    'Image ID':     r.image_id      ?? '',
    'Location':     r.location      ?? '',
    'Recommended':  r.recommended   ?? '',
    'Recommended2': r.recommended2  ?? '',
    'SourceURL':    r.source_url    ?? '',
    'Rating':       r.rating        ?? '',
    'Status':       r.status        ?? 'available',
  })))
}
