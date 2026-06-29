require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const multer     = require('multer');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');
const fs         = require('fs');
const path       = require('path');

const app      = express();
const PORT     = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ─── Packages & Prices ───────────────────────────────────
const PACKAGES = {
  course: { label: 'คอร์สวิดีโอ 9 บทเรียน',      price: 999  },
  ebook:  { label: 'E-Book คู่มือ PDF',            price: 350  },
  combo:  { label: 'คอร์ส + E-Book (เซตแนะนำ)',   price: 1199 },
};
const DISCOUNT_CODES = {
  'STORYPRO': 100,
  'AFF':      300,
};

function calcPrice(pkg, code) {
  const base     = PACKAGES[pkg]?.price ?? 999;
  const discount = DISCOUNT_CODES[(code || '').toUpperCase()] ?? 0;
  return Math.max(0, base - discount);
}

// ─── Lesson titles (for email) ───────────────────────────
const LESSON_TITLES = [
  'บทที่ 1 · Google Flow Tools คืออะไร?',
  'บทที่ 2 · สิ่งที่ต้องมีในการสร้าง Google Flow Tools',
  'บทที่ 3 · เขียน Workflow ออกแบบโครงสร้างของ Tools',
  'บทที่ 4 · เรียบเรียงคำสั่งเพื่อสั่งงานในการออกแบบเครื่องมือ',
  'บทที่ 5 · ลงมือสร้างจริง Workshop',
  'บทที่ 6 · เริ่ม Run เครื่องมือจริง',
  'บทที่ 7 · เจอปัญหา และวิธีแก้ปัญหา',
  'บทที่ 8 · วิธีแก้ไข / รีมิกซ์เครื่องมือ',
  'บทที่ 9 · วิธีนำออกขาย แชร์ตัวขาย ไม่ให้โดนขโมยงาน',
];

// ─── Paths & Data ────────────────────────────────────────
const UPLOADS_DIR    = path.join(__dirname, 'uploads');
const USERS_FILE     = path.join(__dirname, 'users.json');
const LESSONS_FILE   = path.join(__dirname, 'lessons.json');
const SETTINGS_FILE  = path.join(__dirname, 'settings.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE))  fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(LESSONS_FILE)) fs.writeFileSync(LESSONS_FILE, '{}');
if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ autoApprove: true }));

function readUsers()     { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function saveUsers(u)    { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
function readLessons()   { try { return JSON.parse(fs.readFileSync(LESSONS_FILE, 'utf8')); } catch { return {}; } }
function saveLessons(l)  { fs.writeFileSync(LESSONS_FILE, JSON.stringify(l, null, 2)); }
function readSettings()  { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return { autoApprove: true }; } }
function saveSettings(s) { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); }

// ─── Password ────────────────────────────────────────────
function hashPass(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 10000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}
function checkPass(pw, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.pbkdf2Sync(pw, salt, 10000, 64, 'sha256').toString('hex') === hash;
}
function sanitize(u) { const { password, ...safe } = u; return safe; }

// ─── Email ───────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function buildLessonRows(lessons) {
  const ids = Object.entries(lessons).sort(([a],[b]) => Number(a)-Number(b));
  if (!ids.length) return '<p style="color:#666;text-align:center;padding:16px;">แอดมินจะอัพเดทลิงก์บทเรียนเร็วๆ นี้</p>';
  return ids.map(([num, driveId]) => {
    const title = LESSON_TITLES[Number(num)-1] || `บทที่ ${num}`;
    const url   = `https://drive.google.com/file/d/${driveId}/view`;
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #E2F1F3;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#0FB5C5;color:#fff;font-weight:800;font-size:13px;text-align:center;line-height:28px;margin-right:10px;">${num}</span>
        <strong style="color:#0E2A30;">${title}</strong>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #E2F1F3;text-align:right;">
        <a href="${url}" style="background:#FF7A1A;color:#fff;padding:7px 16px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">เข้าเรียน →</a>
      </td>
    </tr>`;
  }).join('');
}

async function sendApproveEmail(user) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️  SMTP not set — skipping email for', user.email); return;
  }
  const pkg         = user.package || 'course';
  const hasVideo    = pkg === 'course' || pkg === 'combo';
  const hasEbook    = pkg === 'ebook'  || pkg === 'combo';
  const lineLink    = process.env.LINE_GROUP_LINK || '';
  const ebookLink   = process.env.EBOOK_LINK || '';
  const masterLink  = process.env.MASTER_LINK || '';
  const lessons     = readLessons();

  const masterSection = hasVideo && masterLink ? `
    <div style="background:#EEF6FF;border:1px solid #BFDBFE;border-radius:14px;padding:20px 24px;margin-bottom:20px;">
      <h3 style="font-family:'Kanit',sans-serif;font-weight:700;color:#1D4ED8;font-size:16px;margin:0 0 6px;">📁 ลิงก์บทเรียนรวม (หากดูในเว็บไม่ได้) + MASTER PROMPT</h3>
      <p style="margin:0 0 14px;color:#1E40AF;font-size:14px;">โฟลเดอร์รวมทุกบทเรียนและ Master Prompt — ดาวน์โหลดหรือเปิดได้ตลอด</p>
      <a href="${masterLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:11px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">เปิดโฟลเดอร์รวม →</a>
    </div>` : '';

  const videoSection = hasVideo ? `
    <h3 style="font-family:'Kanit',sans-serif;font-weight:700;color:#0E2A30;font-size:17px;margin:0 0 12px;">🎬 บทเรียนวิดีโอของคุณ</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2F1F3;border-radius:14px;overflow:hidden;margin-bottom:20px;">
      ${buildLessonRows(lessons)}
    </table>
    ${masterSection}` : '';

  const ebookSection = hasEbook && ebookLink ? `
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <h3 style="font-family:'Kanit',sans-serif;font-weight:700;color:#C2410C;font-size:17px;margin:0 0 8px;">📖 E-Book ของคุณ</h3>
      <p style="margin:0 0 14px;color:#92400E;font-size:15px;">คู่มือ Google Flow Tools ฉบับสมบูรณ์ — ดาวน์โหลดได้ทันที</p>
      <a href="${ebookLink}" style="display:inline-block;background:#FF7A1A;color:#fff;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">ดาวน์โหลด E-Book →</a>
    </div>` : '';

  const lineSection = hasVideo && lineLink ? `
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:20px 24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-weight:700;color:#15803D;font-size:15px;">📣 เข้าร่วมกลุ่ม LINE รับอัพเดทและถามตอบ</p>
      <a href="${lineLink}" style="display:inline-block;background:#06C755;color:#fff;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-top:4px;">เข้ากลุ่ม LINE →</a>
    </div>` : '';

  const pkgLabel    = PACKAGES[pkg]?.label || 'คอร์ส';
  const finalPrice  = user.finalPrice || PACKAGES[pkg]?.price || 999;
  const discountCode = user.discountCode ? ` (โค้ด: ${user.discountCode})` : '';

  await mailer.sendMail({
    from: `"FLOW TOOLS Course" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: '✅ ยืนยันการชำระเงิน — รับของได้เลย!',
    html: `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2FBFC;font-family:'Sarabun',sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(14,42,48,0.08);">
  <div style="background:#0E2A30;padding:32px 36px;text-align:center;">
    <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:4px;">
      <div style="width:40px;height:40px;border-radius:11px;background:#0FB5C5;display:inline-flex;align-items:center;justify-content:center;">
        <span style="font-weight:900;color:#fff;font-size:22px;">F</span>
      </div>
      <span style="font-weight:900;color:#fff;font-size:22px;letter-spacing:1px;">FLOW TOOLS</span>
    </div>
    <p style="color:#9CBABE;margin:4px 0 0;font-size:14px;">คอร์สสร้างเครื่องมือ AI ด้วยตัวเอง</p>
  </div>
  <div style="padding:36px;">
    <h2 style="font-size:24px;color:#0E2A30;margin:0 0 6px;">สวัสดี, ${user.name} 👋</h2>
    <p style="color:#33484C;font-size:15px;line-height:1.6;margin:0 0 6px;">ยืนยันการชำระเงินเรียบร้อยแล้ว ขอบคุณที่สั่งซื้อกับเราครับ!</p>
    <div style="background:#E6F8FA;border-radius:10px;padding:12px 16px;margin-bottom:24px;display:inline-block;">
      <span style="font-size:14px;color:#0A8D9B;font-weight:700;">📦 ${pkgLabel} — ฿${finalPrice.toLocaleString()}${discountCode}</span>
    </div>
    ${videoSection}
    ${ebookSection}
    ${lineSection}
    <div style="border-top:1px solid #E2F1F3;padding-top:20px;color:#7A9498;font-size:13px;text-align:center;line-height:1.8;">
      <p style="margin:0;">หากมีปัญหา ติดต่อ <a href="mailto:${process.env.SMTP_USER}" style="color:#0FB5C5;">${process.env.SMTP_USER}</a></p>
      <p style="margin:4px 0 0;">© 2025 FLOW TOOLS · พงศ์ปณต โกมลกนก</p>
    </div>
  </div>
</div>
</body></html>`,
  });
  console.log(`📧 Email sent → ${user.email} [${pkg}]`);

  // แจ้งเตือนแอดมิน
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && adminEmail !== user.email) {
    const pkgLabel   = PACKAGES[pkg]?.label || pkg;
    const finalPrice = user.finalPrice || PACKAGES[pkg]?.price || 999;
    const discount   = user.discountCode ? ` (โค้ด: ${user.discountCode} ลด ฿${DISCOUNT_CODES[user.discountCode] || 0})` : '';
    mailer.sendMail({
      from: `"FLOW TOOLS Alert" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `💰 มีออเดอร์ใหม่! ${user.name} — ฿${finalPrice.toLocaleString()}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:20px auto;background:#fff;border:1px solid #E2F1F3;border-radius:16px;overflow:hidden;">
  <div style="background:#0E2A30;padding:18px 24px;color:#fff;font-size:18px;font-weight:700;">💰 ออเดอร์ใหม่ — FLOW TOOLS</div>
  <div style="padding:24px;">
    <table style="width:100%;font-size:15px;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#7A9498;width:120px;">ชื่อ</td><td style="padding:8px 0;font-weight:700;color:#0E2A30;">${user.name}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">อีเมล</td><td style="padding:8px 0;color:#0E2A30;">${user.email}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">แพ็กเกจ</td><td style="padding:8px 0;color:#0E2A30;">${pkgLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">ยอดชำระ</td><td style="padding:8px 0;font-weight:900;font-size:20px;color:#FF7A1A;">฿${finalPrice.toLocaleString()}${discount}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">เวลา</td><td style="padding:8px 0;color:#0E2A30;">${new Date().toLocaleString('th-TH')}</td></tr>
    </table>
  </div>
</div>`,
    }).catch(e => console.error('Admin notify error:', e.message));
  }
}

async function sendPendingNotify(user) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !process.env.SMTP_USER) return;
  const pkg = user.package || 'course';
  const pkgLabel = PACKAGES[pkg]?.label || pkg;
  const finalPrice = user.finalPrice || PACKAGES[pkg]?.price || 999;
  const discount = user.discountCode ? ` (โค้ด: ${user.discountCode})` : '';
  await mailer.sendMail({
    from: `"FLOW TOOLS Alert" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `🧾 สลิปใหม่! ${user.name} — รอ Approve`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:20px auto;background:#fff;border:1px solid #E2F1F3;border-radius:16px;overflow:hidden;">
  <div style="background:#B45309;padding:18px 24px;color:#fff;font-size:18px;font-weight:700;">🧾 มีสลิปใหม่ รอ Approve — FLOW TOOLS</div>
  <div style="padding:24px;">
    <table style="width:100%;font-size:15px;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#7A9498;width:120px;">ชื่อ</td><td style="padding:8px 0;font-weight:700;color:#0E2A30;">${user.name}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">อีเมล</td><td style="padding:8px 0;color:#0E2A30;">${user.email}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">แพ็กเกจ</td><td style="padding:8px 0;color:#0E2A30;">${pkgLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">ยอดชำระ</td><td style="padding:8px 0;font-weight:900;font-size:20px;color:#FF7A1A;">฿${finalPrice.toLocaleString()}${discount}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">เวลา</td><td style="padding:8px 0;color:#0E2A30;">${new Date().toLocaleString('th-TH')}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#7A9498;">กรุณาเข้าหลังบ้านเพื่ออนุมัติ: <a href="${BASE_URL}" style="color:#0FB5C5;">${BASE_URL}</a></p>
  </div>
</div>`,
  }).catch(e => console.error('Pending notify error:', e.message));
}

// ─── Middleware ───────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'flow-tools-2025',
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'assets')));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOADS_DIR),
    filename: (_, file, cb) => cb(null, `slip_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only')),
});

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
}
function requireAdmin(req, res, next) {
  if (req.session.masterAdmin) return next(); // master admin login
  if (!req.session.userId) return res.status(401).json({ success: false });
  const u = readUsers().find(x => x.id === req.session.userId);
  if (u?.role === 'admin') return next();
  res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
}

// ─── Auth API ─────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { name, email, password, package: pkg } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  const users = readUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(400).json({ success: false, message: 'อีเมลนี้มีผู้ใช้แล้ว ลองเข้าสู่ระบบแทน' });
  const isAdmin = email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase();
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(), email: email.toLowerCase().trim(),
    password: hashPass(password),
    role: isAdmin ? 'admin' : 'user',
    status: isAdmin ? 'paid' : 'unpaid',
    package: PACKAGES[pkg] ? pkg : 'course',
    createdAt: new Date().toISOString(),
    slip: null, approvedAt: null, discountCode: null, finalPrice: null,
  };
  users.push(user); saveUsers(users);
  req.session.userId = user.id;
  res.json({ success: true, user: sanitize(user) });
});

app.post('/api/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.masterAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  const users = readUsers();
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !checkPass(password, user.password))
    return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  req.session.userId = user.id;
  res.json({ success: true, user: sanitize(user) });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));

app.get('/api/me', (req, res) => {
  if (req.session.masterAdmin) return res.json({ loggedIn: true, user: { role: 'admin', name: 'Admin', email: '', masterAdmin: true } });
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = readUsers().find(u => u.id === req.session.userId);
  if (!user) { req.session.destroy(() => {}); return res.json({ loggedIn: false }); }
  res.json({ loggedIn: true, user: sanitize(user) });
});

// ─── Validate Discount Code ───────────────────────────────
app.post('/api/check-code', requireAuth, (req, res) => {
  const { code, package: pkg } = req.body;
  const upper    = (code || '').toUpperCase().trim();
  const discount = DISCOUNT_CODES[upper];
  if (!discount) return res.json({ success: false, message: 'โค้ดไม่ถูกต้อง' });
  const base  = PACKAGES[pkg]?.price ?? 999;
  const final = Math.max(0, base - discount);
  res.json({ success: true, discount, finalPrice: final, code: upper });
});

// ─── Submit Slip (auto-approve + email) ───────────────────
app.post('/api/submit-slip', requireAuth, upload.single('slip'), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, message: 'กรุณาแนบสลิป' });
  const users = readUsers();
  const user  = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ success: false });
  if (user.status === 'paid') return res.json({ success: true, user: sanitize(user) });

  const code        = (req.body.discountCode || '').toUpperCase().trim();
  const pkg         = req.body.package || user.package || 'course';
  user.slip         = req.file.filename;
  user.package      = PACKAGES[pkg] ? pkg : (user.package || 'course');
  user.discountCode = DISCOUNT_CODES[code] ? code : null;
  user.finalPrice   = calcPrice(user.package, user.discountCode);

  const settings = readSettings();
  if (settings.autoApprove) {
    user.status     = 'paid';
    user.approvedAt = new Date().toISOString();
    saveUsers(users);
    res.json({ success: true, user: sanitize(user) });
    sendApproveEmail(user).catch(e => console.error('Email error:', e.message));
  } else {
    user.status = 'pending';
    saveUsers(users);
    res.json({ success: true, user: sanitize(user) });
    sendPendingNotify(user).catch(e => console.error('Notify error:', e.message));
  }
});

// ─── Lessons (paid users only) ────────────────────────────
app.get('/api/lessons', requireAuth, (req, res) => {
  const user = readUsers().find(u => u.id === req.session.userId);
  if (!user || user.status !== 'paid')
    return res.status(403).json({ success: false, message: 'กรุณาชำระเงินก่อน' });
  // ebook only users don't get video lessons
  if (user.package === 'ebook')
    return res.json({ success: true, lessons: {}, ebookOnly: true });
  res.json({ success: true, lessons: readLessons() });
});

// ─── Admin API ────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json(readUsers().filter(u => u.role !== 'admin').map(sanitize));
});

app.post('/api/admin/approve/:id', requireAdmin, async (req, res) => {
  const users = readUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false });
  user.status = 'paid'; user.approvedAt = new Date().toISOString();
  saveUsers(users); res.json({ success: true });
  sendApproveEmail(user).catch(e => console.error('Email error:', e.message));
});

app.post('/api/submit-upgrade', requireAuth, upload.single('slip'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาแนบสลิป' });
  const users = readUsers();
  const user  = users.find(u => u.id === req.session.userId);
  if (!user || user.status !== 'paid') return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });

  const targetPkg = req.body.targetPackage;
  if (!PACKAGES[targetPkg]) return res.status(400).json({ success: false, message: 'แพ็กเกจไม่ถูกต้อง' });

  const UPGRADE_PRICES = {
    'ebook->combo': 849, 'ebook->course': 649, 'course->combo': 200,
  };
  const upgradeKey = `${user.package}->${targetPkg}`;
  const upgradePrice = UPGRADE_PRICES[upgradeKey];
  if (!upgradePrice) return res.status(400).json({ success: false, message: 'ไม่สามารถอัปเกรดได้' });

  user.upgradeRequest = {
    package: targetPkg,
    slip: req.file.filename,
    price: upgradePrice,
    createdAt: new Date().toISOString(),
  };
  saveUsers(users);
  res.json({ success: true });

  // แจ้งแอดมิน
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    mailer.sendMail({
      from: `"FLOW TOOLS Alert" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `⬆️ อัปเกรดใหม่! ${user.name} → ${PACKAGES[targetPkg].label}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:20px auto;background:#fff;border:1px solid #E2F1F3;border-radius:16px;overflow:hidden;">
  <div style="background:#7C3AED;padding:18px 24px;color:#fff;font-size:18px;font-weight:700;">⬆️ คำขออัปเกรด — FLOW TOOLS</div>
  <div style="padding:24px;">
    <table style="width:100%;font-size:15px;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#7A9498;width:140px;">ชื่อ</td><td style="padding:8px 0;font-weight:700;">${user.name}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">อีเมล</td><td style="padding:8px 0;">${user.email}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">อัปเกรดจาก</td><td style="padding:8px 0;">${PACKAGES[user.package].label}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">อัปเกรดไป</td><td style="padding:8px 0;font-weight:700;color:#7C3AED;">${PACKAGES[targetPkg].label}</td></tr>
      <tr><td style="padding:8px 0;color:#7A9498;">ยอดที่จ่าย</td><td style="padding:8px 0;font-weight:900;font-size:20px;color:#FF7A1A;">฿${upgradePrice.toLocaleString()}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#7A9498;">กรุณาเข้าหลังบ้านเพื่ออนุมัติ: <a href="${BASE_URL}">${BASE_URL}</a></p>
  </div>
</div>`,
    }).catch(e => console.error('Upgrade notify error:', e.message));
  }
});

app.post('/api/admin/approve-upgrade/:id', requireAdmin, async (req, res) => {
  const users = readUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user || !user.upgradeRequest) return res.status(404).json({ success: false });
  user.package      = user.upgradeRequest.package;
  user.approvedAt   = new Date().toISOString();
  user.upgradeRequest = null;
  saveUsers(users);
  res.json({ success: true });
  sendApproveEmail(user).catch(e => console.error('Email error:', e.message));
});

app.post('/api/admin/revoke/:id', requireAdmin, (req, res) => {
  const users = readUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false });
  user.status = 'unpaid'; saveUsers(users);
  res.json({ success: true });
});

app.delete('/api/admin/user/:id', requireAdmin, (req, res) => {
  let users = readUsers();
  users = users.filter(u => u.id !== req.params.id);
  saveUsers(users);
  res.json({ success: true });
});

app.post('/api/admin/reset-user/:id', requireAdmin, (req, res) => {
  const users = readUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false });
  user.status       = 'unpaid';
  user.slip         = null;
  user.approvedAt   = null;
  user.discountCode = null;
  user.finalPrice   = null;
  user.upgradeRequest = null;
  saveUsers(users);
  res.json({ success: true });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({ success: true, settings: readSettings() });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const current = readSettings();
  const updated = { ...current, ...req.body };
  saveSettings(updated);
  res.json({ success: true, settings: updated });
});

app.post('/api/admin/lessons', requireAdmin, (req, res) => {
  if (!req.body.lessons) return res.status(400).json({ success: false });
  saveLessons(req.body.lessons); res.json({ success: true });
});

app.get('/api/admin/lessons', requireAdmin, (req, res) => {
  res.json({ success: true, lessons: readLessons() });
});

// ─── Serve index.html ─────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 Flow Tools Course: ${BASE_URL}`);
  console.log(`👤 เข้าระบบด้วย ADMIN_EMAIL (${process.env.ADMIN_EMAIL || 'ยังไม่ได้ตั้งค่า'})\n`);
});
