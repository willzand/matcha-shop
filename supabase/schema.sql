-- ============================================================
-- 🍵 Matcha Shop — Supabase Schema (Fresh Start)
-- Supabase Dashboard → SQL Editor → วาง → Run
-- ============================================================

-- ── 1. CATALOG ───────────────────────────────────────────────
create table catalog (
  id            serial primary key,
  brand         text not null,
  product_name  text not null,
  weight        text,
  price_jpy     integer default 0,
  price_thb     numeric(10,2) default 0,
  image_id      text,          -- Google Drive file ID เช่น 1u5tlylqz3...
  recommended   text,          -- tag สั้นๆ เช่น "เข้มข้น"
  recommended2  text,          -- คำบรรยายรสชาติ
  source_url    text,          -- ลิ้งค์สินค้าต้นทาง
  location      text,          -- แหล่งผลิต เช่น Nishio, Kyoto
  rating        numeric(3,1),  -- คะแนน /10 (แปลงจาก ⭐ emoji)
  status        text default 'available',  -- 'available' | 'หมด'
  created_at    timestamptz default now()
);

-- ── 2. ORDERS ────────────────────────────────────────────────
create table orders (
  id              serial primary key,
  order_id        text unique not null,
  created_at      timestamptz default now(),
  customer_name   text not null,
  line_user_id    text,
  total_jpy       integer default 0,
  total_thb       numeric(10,2) default 0,
  status          text default '⏳ กำลังตามหา'
);

-- ── 3. ORDER ITEMS ────────────────────────────────────────────
create table order_items (
  id            serial primary key,
  order_id      text not null references orders(order_id) on delete cascade,
  brand         text,
  product_name  text not null,
  qty           integer not null check (qty between 1 and 10),
  price_jpy     integer default 0,
  price_thb     numeric(10,2) default 0,
  image_url     text
);

-- ── INDEXES ──────────────────────────────────────────────────
create index idx_orders_line_user on orders(line_user_id);
create index idx_items_order_id   on order_items(order_id);
create index idx_catalog_brand    on catalog(brand);

-- unique constraint needed for upsert onConflict
alter table catalog add constraint catalog_name_brand_unique unique (product_name, brand);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table catalog     enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- Catalog: public read (anon key), write = service_role only
create policy "catalog_public_read"
  on catalog for select using (true);

-- Orders: public insert + read (filtered server-side)
create policy "orders_public_insert"
  on orders for insert with check (true);
create policy "orders_public_read"
  on orders for select using (true);

-- Order items: public insert + read
create policy "items_public_insert"
  on order_items for insert with check (true);
create policy "items_public_read"
  on order_items for select using (true);

-- ⚠️ Admin routes ใช้ service_role key → bypass RLS ทั้งหมดอัตโนมัติ

-- ── ตัวอย่างข้อมูล (จาก List Matcha Sheet จริง — ลบออกได้หลัง Sync ครั้งแรก) ──
insert into catalog (brand, product_name, weight, price_jpy, price_thb, image_id, location, recommended, recommended2, rating, status)
values
  ('AOI Seicha', 'Shiou (紫風)',       '30g', 13410, 3220, '13NpeFynxfBnEBj6kJKtWBycA9HPpkqc5', 'Nishio', 'Koicha', 'ตัวท็อปที่สุด: รสชาติหวานนุ่มนวลแบบขีดสุด มีความครีมมี่สูงมาก ไร้ความขม', 10.0, 'available'),
  ('AOI Seicha', 'Miou (碧風)',        '30g',  7160, 1720, '11U2bynDLAVHZmGuoe3O2QOmGK7ZYgNkm', 'Nishio', 'Koicha', 'หรูหราสมดุล: อูมามิชัดเจน บอดี้แน่น มีความสดชื่นของยอดใบชาแทรก', 9.0, 'available'),
  ('AOI Seicha', 'Nishinomori (西の杜)','30g',  3300,  795, '1Wc3kNWEuHPNrVkS0KJZTVSBGAbliiA-w', 'Nishio', 'Usucha', 'สดชื่นสไตล์ Nishio: บอดี้โปร่ง มีความขมเล็กน้อยช่วยให้รสมีมิติ',  7.0, 'available');
