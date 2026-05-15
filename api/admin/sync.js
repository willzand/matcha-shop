// api/admin/sync.js  POST /api/admin/sync
// ดึงข้อมูลจาก Google Sheets (public) → upsert catalog ใน Supabase
// ไม่ต้องใช้ Service Account — ใช้ Sheets ที่ตั้งเป็น "Anyone with the link can view"

import { sb, cors } from '../../lib/db.js'
import { checkSession } from './login.js'

// Column mapping — ตรงกับ header จริงใน "List Matcha" Sheet
// คอลัมน์จริง: Status | Image ID | Location | Brand | Product Name | Weight | Price_JPY | Price_THB | Recommended | Recommended2 | SourceURL | Rating
const COL = {
  status:       'Status',
  image_id:     'Image ID',
  location:     'Location',
  brand:        'Brand',
  product_name: 'Product Name',
  weight:       'Weight',
  price_jpy:    'Price_JPY',
  price_thb:    'Price_THB',
  recommended:  'Recommended',
  recommended2: 'Recommended2',
  source_url:   'SourceURL',
  rating:       'Rating',
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { token } = req.body ?? {}
  if (!checkSession(token))
    return res.status(401).json({ error: 'unauthorized' })

  const sheetId = process.env.CATALOG_SHEET_ID
  if (!sheetId)
    return res.status(500).json({ error: 'CATALOG_SHEET_ID not set' })

  // ── 1. Fetch sheet as CSV (no auth needed — sheet must be public) ──
  // gviz/tq endpoint returns JSON without needing API key
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Sheet1`

  let csvText
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Sheets returned ${r.status}`)
    csvText = await r.text()
  } catch (e) {
    return res.status(502).json({ error: 'sheets_fetch_failed', detail: e.message })
  }

  // ── 2. Parse CSV ───────────────────────────────────────────
  const rows = parseCSV(csvText)
  if (!rows.length)
    return res.status(400).json({ error: 'empty_sheet' })

  const headers = rows[0]
  const idx = {}
  for (const [key, colName] of Object.entries(COL)) {
    const i = headers.findIndex(h => h.trim() === colName)
    if (i >= 0) idx[key] = i
  }

  if (idx.product_name === undefined)
    return res.status(400).json({ error: 'missing_column', detail: `Column "${COL.product_name}" not found. Headers: ${headers.join(', ')}` })

  // ── 3. Build upsert records ────────────────────────────────
  const records = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = r[idx.product_name]?.trim()
    if (!name) continue    // skip empty rows

    records.push({
      brand:        get(r, idx.brand)        || null,
      product_name: name,
      weight:       get(r, idx.weight)       || null,
      price_jpy:    num(r, idx.price_jpy),
      price_thb:    num(r, idx.price_thb),
      image_id:     get(r, idx.image_id)     || null,
      location:     get(r, idx.location)     || null,
      recommended:  get(r, idx.recommended)  || null,
      recommended2: get(r, idx.recommended2) || null,
      source_url:   get(r, idx.source_url)   || null,
      rating:       parseRating(r, idx.rating),
      status:       get(r, idx.status)       || 'available',
    })
  }

  if (!records.length)
    return res.status(400).json({ error: 'no_valid_rows' })

  // ── 4. Upsert into Supabase ────────────────────────────────
  // upsert on (brand, product_name) — updates existing, inserts new
  // First: clear old rows that no longer exist in sheet
  const { error: delErr } = await sb
    .from('catalog')
    .delete()
    .not('product_name', 'in', `(${records.map(r => `"${r.product_name.replace(/"/g, '\\"')}"`).join(',')})`)

  if (delErr) console.warn('catalog cleanup warning:', delErr.message)

  const { error: upsertErr, count } = await sb
    .from('catalog')
    .upsert(records, { onConflict: 'product_name,brand', ignoreDuplicates: false })
    .select('id', { count: 'exact' })

  if (upsertErr)
    return res.status(500).json({ error: upsertErr.message })

  return res.json({
    status:  'success',
    synced:  records.length,
    message: `✅ Sync สำเร็จ — อัปเดต ${records.length} รายการครับ`
  })
}

// ── Helpers ───────────────────────────────────────────────────
function get(row, i) {
  return i !== undefined ? String(row[i] ?? '').trim() : ''
}
function num(row, i) {
  if (i === undefined) return 0
  const v = parseFloat(String(row[i] ?? '').replace(/,/g, ''))
  return isNaN(v) ? 0 : v
}

// Rating ใน Sheet เป็น ⭐️ emoji เช่น "⭐️⭐️⭐️⭐️⭐️" หรือ "⭐️⭐️⭐️🌟"
// นับ ⭐️ = 1 คะแนน, 🌟 = 0.5 คะแนน → scale เป็น /10
function parseRating(row, i) {
  if (i === undefined) return null
  const s = String(row[i] ?? '')
  if (!s.trim()) return null
  // ถ้าเป็นตัวเลขอยู่แล้ว ใช้เลยได้
  const n = parseFloat(s.replace(/,/g, ''))
  if (!isNaN(n)) return n
  // นับ emoji stars
  const full = (s.match(/⭐/g) || []).length
  const half = (s.match(/🌟/g) || []).length
  const raw  = full + half * 0.5   // เช่น 4.5 จาก 5
  return raw > 0 ? Math.round((raw / 5) * 10 * 10) / 10 : null  // scale เป็น /10
}

// Minimal CSV parser — handles quoted fields with commas and newlines
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQ = false
  const flush = () => { row.push(field); field = '' }
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i+1]
    if (inQ) {
      if (c === '"' && next === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') flush()
      else if (c === '\n') { flush(); if (row.some(Boolean)) rows.push(row); row = [] }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  flush()
  if (row.some(Boolean)) rows.push(row)
  return rows
}
