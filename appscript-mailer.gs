/**
 * FLOW TOOLS — ตัวส่งเมลผ่าน Google Apps Script
 *
 * วิธีใช้:
 * 1. ไปที่ https://script.google.com → New project
 * 2. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้แทน
 * 3. แก้ค่า MAIL_SECRET ด้านล่างให้ตรงกับที่จะตั้งใน Railway (ตั้งเป็นอะไรก็ได้ที่เดายาก)
 * 4. กด Deploy → New deployment → เลือก type "Web app"
 *      - Execute as: Me (อีเมลคุณ)
 *      - Who has access: Anyone
 * 5. กด Deploy → อนุญาตสิทธิ์ (Authorize) → copy "Web app URL" ที่ได้
 * 6. เอา URL นั้นไปใส่ใน Railway Variables ชื่อ APPSCRIPT_MAIL_URL
 *    และตั้ง MAIL_SECRET ใน Railway ให้ตรงกับค่าด้านล่าง
 */

// ⚠️ ตั้งให้ตรงกับ MAIL_SECRET ใน Railway Variables
var MAIL_SECRET = 'flowtools-mail-7x9k2p';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (MAIL_SECRET && body.secret !== MAIL_SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }
    if (!body.to || !body.subject) {
      return json({ ok: false, error: 'missing to/subject' });
    }

    MailApp.sendEmail({
      to: body.to,
      subject: body.subject,
      htmlBody: body.html || '',
      name: body.fromName || 'FLOW TOOLS'
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ให้เปิด URL ตรงๆ แล้วเช็คได้ว่า deploy แล้ว
function doGet() {
  return json({ ok: true, service: 'FLOW TOOLS mailer', ready: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
