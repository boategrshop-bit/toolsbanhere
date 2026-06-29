# Handoff: Google Flow Tools Course — เว็บขายคอร์สออนไลน์

## Overview
เว็บไซต์ขายคอร์สออนไลน์สอนสร้างเครื่องมือ (Tools) ด้วย Google Flow ราคา ฿999 ประกอบด้วย:
- หน้า Landing Page กระตุ้นการซื้อ (Sales Page)
- ระบบสมัครสมาชิก / เข้าสู่ระบบ
- หน้าชำระเงิน (QR พร้อมเพย์ + อัพโหลดสลิป)
- หน้าบทเรียน (ล็อกสำหรับผู้ที่ยังไม่ชำระ)
- หน้าแอดมิน (อนุมัติการชำระเงิน)

## About the Design Files
ไฟล์ใน bundle นี้ (`Google Flow Tools Course.dc.html`) คือ **design reference ที่สร้างด้วย HTML** — เป็น prototype แสดง look & behavior ที่ต้องการ **ไม่ใช่ production code** ที่จะ copy ตรงๆ ได้

งานของ developer คือ **นำ design นี้ไป implement ใน codebase จริง** โดยใช้ framework ที่เหมาะสม เช่น Next.js + Tailwind หรือ React + backend เช่น Firebase / Supabase สำหรับระบบ auth และฐานข้อมูล

## Fidelity
**High-fidelity** — ออกแบบครบถ้วนพร้อม final colors, typography, spacing, interactions และ copy text ภาษาไทย developer ควร recreate UI ให้ใกล้เคียงที่สุด

---

## Screens / Views

### 1. Landing Page (Sales Page)
**Purpose:** กระตุ้นให้ผู้เยี่ยมชมสมัครเรียน

**Layout:**
- Sticky top nav bar (logo ซ้าย, buttons ขวา)
- Hero section: 2-column grid (copy ซ้าย, dashboard image ขวา)
- Urgency bar: countdown timer สีส้ม, full-width
- Pain section: 3-column grid card
- Curriculum section: 2-column grid (6 cards — placeholder "..." รอเจ้าของใส่เนื้อหา)
- Sales proof section: dark bg, 2-column grid, image + stats
- Reviews section: 3-column grid (6 cards)
- Pricing/CTA section: single centered card
- Footer: dark bg

**Key components:**

| Element | Details |
|---|---|
| Hero H1 | Kanit Black 900, ~52px, white on #0E2A30 |
| Orange CTA button | #FF7A1A, Kanit 800, 19px, border-radius 14px, box-shadow |
| Countdown bar | bg #FF7A1A, 4 digit boxes bg rgba(0,0,0,0.22) |
| Stat numbers | Kanit 800, 26px white |
| Sales proof badge | bg #0FB5C5, absolute bottom, large font, float animation |
| Popup callout | White card, border #FF7A1A 2px, absolute above dashboard img, float animation |
| Review cards | White, border #E2F1F3, border-radius 18px, padding 24px |

### 2. Auth Screen (Register / Login)
**Purpose:** สมัครสมาชิกหรือเข้าสู่ระบบ

**Layout:** Centered single column, max-width 440px

**Fields:**
- Register: ชื่อ-นามสกุล + อีเมล + รหัสผ่าน
- Login: อีเมล + รหัสผ่าน
- Toggle ระหว่าง 2 modes
- Error message box (bg #FFF0E5, color #D24B00)

### 3. Payment Screen
**Purpose:** แสดง QR + บัญชี, รับ upload สลิป, ยืนยันการชำระ

**Layout:** 2-column grid (QR image ซ้าย, bank details + upload ขวา), max-width 920px

**QR Image:** `/assets/qr-payment.jpg` (โปสเตอร์กราฟฟิตี้พร้อมเพย์ที่เจ้าของให้มา)

**Bank details:**
- ธนาคารกสิกรไทย (KBANK)
- ชื่อบัญชี: พงศ์ปณต โกมลกนก
- เลขที่บัญชี: 573-2-30302-4 (copy button)

**Slip Upload:**
- `<input type="file" accept="image/*">`
- Preview thumbnail หลัง select
- Validation: ต้องแนบก่อน confirm
- Error message ถ้าไม่แนบ

**States:**
- `unpaid` → แสดง QR + upload form
- `pending` → แสดง "กำลังตรวจสอบ" (รอแอดมิน)
- `paid` → แสดง "ชำระแล้ว" + ปุ่มไปบทเรียน

### 4. Lessons Screen (ล็อก ถ้ายังไม่ชำระ/อนุมัติ)
**Purpose:** แสดงรายการบทเรียนพร้อม video player

**Access control:** เฉพาะ users ที่ status === 'paid'

**Layout:** Single column list, max-width 1000px

**Lesson row:** flex, number badge (Kanit 800 สีขาว bg #0FB5C5) + title + desc + duration + play button

**Video player:** Google Drive iframe embed (`https://drive.google.com/file/d/{DRIVE_FILE_ID}/preview`)
- Aspect ratio 16:9, position:absolute inside padding-top:56.25% wrapper
- ถ้าไม่มี Drive ID → แสดง placeholder ลายทแยงมุม

**ข้อมูลบทเรียน:** เจ้าของจะกรอก Google Drive File ID ภายหลัง (ตอนนี้ยัง placeholder ทั้งหมด)

### 5. Admin Panel
**Purpose:** อนุมัติ/ยกเลิกการชำระเงิน

**Access:** เฉพาะ role==='admin' (test account: `admin` / `admin123`)

**Layout:** Stats row (3 cards) + user table, max-width 1000px

**User row:** ชื่อ | อีเมล | thumbnail สลิป (ถ้ามี) | status badge | ปุ่ม อนุมัติ / ยกเลิก

**User statuses:**
- `unpaid` → ยังไม่ชำระ (orange)
- `pending` → รอตรวจสอบ (amber)
- `paid` → อนุมัติแล้ว (teal)

---

## Interactions & Behavior

### Navigation / Routing
- Single-page app, route ด้วย state: `landing | auth | payment | lessons | admin`
- หลัง register → ไป payment
- หลัง login → ถ้า paid ไป lessons, ถ้า admin ไป admin, ถ้าไม่ paid ไป payment
- ปุ่ม "เข้าเรียน" ใน nav → ถ้าไม่ login ไป auth, ถ้า paid ไป lessons, ไม่งั้น ไป payment

### Countdown Timer
- สร้าง deadline = now + 2 วัน + 11 ชม ครั้งแรก, เก็บใน localStorage `gfc_deadline`
- Tick ทุก 1 วินาที แสดง DD:HH:MM:SS

### Animations
- Hero CTA button: `pulse` 2.2s ease-in-out infinite (scale 1 → 1.04 → 1)
- Dashboard image card: `float` 4s ease-in-out infinite (translateY 0 → -6px → 0)
- Popup callout: `float` 3.6s phase offset
- Sales badge: `float` phase offset

### Copy account number
- `navigator.clipboard.writeText('5732303024')`
- Button label เปลี่ยนเป็น "คัดลอกแล้ว ✓" 1.8 วินาที แล้ว reset

---

## State Management (localStorage)

| Key | Format | Description |
|---|---|---|
| `gfc_users` | JSON array | รายชื่อ users ทั้งหมด |
| `gfc_session` | string (email) | session ปัจจุบัน |
| `gfc_deadline` | timestamp ms | วันหมดอายุโปรฯ |

### User object schema
```json
{
  "email": "user@example.com",
  "password": "plaintext",
  "name": "ชื่อผู้ใช้",
  "role": "user | admin",
  "status": "unpaid | pending | paid",
  "paidAt": 1234567890000,
  "slip": "data:image/jpeg;base64,..."
}
```

> ⚠️ Production: ใช้ backend จริง (Firebase Auth, Supabase, custom API) แทน localStorage password ต้อง hash, slip ควร upload ไป Storage แทนเก็บ base64

---

## Design Tokens

### Colors
```
Primary Turquoise:  #0FB5C5
Dark Teal:          #0A8D9B
Dark Ink:           #0E2A30
Orange Accent:      #FF7A1A
Orange Dark:        #F25C05
Light Bg:           #F2FBFC
Border Light:       #E2F1F3
Text Body:          #33484C
Text Muted:         #5E787C
Text Faint:         #9CB3B6
White:              #FFFFFF
```

### Typography
```
Headings:   Kanit (Google Fonts), weights 700/800/900
Body:       Sarabun (Google Fonts), weights 400/500/600/700
```

### Spacing / Radius
```
Card border-radius: 16–20px
Button border-radius: 12–14px
Pill badge: 999px
Card padding: 24–30px
Section padding: 44–64px vertical, 20px horizontal
Max content width: 1120px (main), 440px (auth), 920px (payment), 1000px (lessons/admin)
```

### Shadows
```
Button: 0 10px 26px rgba(255,122,26,0.40)
Card:   0 14px 40px rgba(14,42,48,0.06)
Nav:    backdrop-filter blur(10px), border-bottom 1px solid #DCEFF1
```

---

## Assets

| File | Description |
|---|---|
| `assets/qr-payment.jpg` | QR Code โปสเตอร์กราฟฟิตี้ พร้อมเพย์ ธนาคารกสิกรไทย |
| `assets/storypro-sales.jpg` | Screenshot ยอดขาย StoryPro dashboard (social proof) |

---

## Files in This Package
- `Google Flow Tools Course.dc.html` — Design prototype (HTML, ทุก screen ในไฟล์เดียว)
- `assets/qr-payment.jpg` — QR image
- `assets/storypro-sales.jpg` — Sales proof screenshot
- `README.md` — This handoff document

---

## Implementation Notes for Developer

1. **Authentication:** ใช้ Firebase Auth หรือ Supabase Auth แทน localStorage — เก็บ user profile ใน Firestore/Postgres
2. **Payment verification:** Admin dashboard ควรดึงข้อมูล real-time (Firestore listener / websocket)
3. **Slip storage:** Upload ไป Firebase Storage / S3 แล้วเก็บแค่ URL ใน DB
4. **Video:** Google Drive embed ใช้งานได้ แต่อาจ block บางอุปกรณ์ — พิจารณา Vimeo หรือ YouTube unlisted
5. **Lesson content:** เจ้าของคอร์สจะแจ้ง Google Drive File ID สำหรับแต่ละบทเรียน — ควรทำ admin UI ให้กรอก ID ได้
6. **Countdown:** ควรเก็บ deadline ใน DB แทน localStorage เพื่อไม่ให้ user reset ได้
