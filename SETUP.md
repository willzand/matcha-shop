# 🍵 Matcha Shop — คู่มือ Deploy (Vercel + Supabase)

## ขั้นตอนทั้งหมด ~30 นาที

---

## STEP 1 — Supabase (10 นาที)

1. **supabase.com** → New project → ตั้งชื่อ `matcha-shop` → Region: Singapore
2. รอ project ready (~2 นาที)
3. **SQL Editor** → New query → วางทั้งหมดจาก `supabase/schema.sql` → **Run**
4. ไป **Table Editor → catalog** → กด **Insert rows** เพิ่มสินค้าได้เลย

### เก็บ credentials:
**Settings → API**
- `Project URL` → `SUPABASE_URL`
- `service_role` (secret) → `SUPABASE_SERVICE_KEY`  ⚠️ ห้ามใช้ anon key

---

## STEP 2 — Admin Password Hash (2 นาที)

รันใน terminal เครื่องคุณ:
```bash
node -e "
  const {createHash} = require('crypto');
  const salt = 'ตั้งค่า PASS_SALT ของคุณ';
  const pass = 'รหัสผ่านที่ต้องการ';
  console.log(createHash('sha256').update(pass+salt).digest('hex'));
"
```
คัดลอก output → ใส่ใน `ADMIN_PASS_HASH`

---

## STEP 3 — Vercel (10 นาที)

### วิธี A: GitHub (แนะนำ)
```bash
git init && git add . && git commit -m "init"
# push ขึ้น GitHub repo
```
vercel.com → New Project → Import repo → **Other** framework → Deploy

### วิธี B: Vercel CLI
```bash
npx vercel
# ตอบ: No framework, deploy as-is
```

### ใส่ Environment Variables ใน Vercel Dashboard:
Settings → Environment Variables → เพิ่มทุกตัวจาก `.env.example`

---

## STEP 4 — LIFF (3 นาที)

1. **developers.line.biz** → Channel **2009818831** → แท็บ **LIFF**
2. เลือก LIFF App → **Endpoint URL** → ใส่ Vercel URL
   เช่น `https://matcha-shop.vercel.app`
3. Save

---

## STEP 5 — ทดสอบ ✅

| สิ่งที่ทดสอบ | วิธี |
|-------------|------|
| สินค้าโหลด | เปิด vercel URL |
| Login LINE | กดปุ่ม Login ใน app |
| สั่งซื้อ | เพิ่มสินค้า checkout |
| ดูออเดอร์ | Supabase → Table Editor → orders |
| Admin panel | tab Admin → ใส่รหัสผ่าน |

---

## โครงสร้างไฟล์

```
matcha-shop/
├── index.html              ← frontend (LIFF + shop UI)
├── vercel.json             ← CORS config
├── package.json
├── .env.example
│
├── lib/db.js               ← Supabase client + LINE helpers
│
├── api/
│   ├── catalog.js          ← GET  สินค้าทั้งหมด
│   ├── order.js            ← POST สั่งซื้อ
│   ├── status.js           ← GET  เช็คออเดอร์
│   └── admin/
│       ├── login.js        ← POST login/logout admin
│       ├── fetch.js        ← GET  ดูออเดอร์ทั้งหมด
│       ├── update.js       ← POST อัปเดตสถานะ
│       └── sendline.js     ← POST ส่ง LINE ให้ลูกค้า
│
└── supabase/
    └── schema.sql          ← SQL สร้าง tables + ตัวอย่างข้อมูล
```
