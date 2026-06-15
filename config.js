/**
 * config.js — CẤU HÌNH FRONTEND
 * ------------------------------------------------------------------
 * Sửa 1 chỗ duy nhất: GOOGLE_CLIENT_ID (sau khi DX Lead tạo OAuth Client ID).
 * API_URL đã điền sẵn = URL web app Apps Script đã deploy (M1).
 */
window.APP_CONFIG = {
  // URL web app backend (đã deploy ở M1) — KHÔNG sửa trừ khi deploy lại bản mới.
  API_URL: 'https://script.google.com/macros/s/AKfycbx43XXTGIFYVqLs8JSTm_EuyBni7X3qC6oFpK03amEDfzEYp3vd_tr079obmFo-L8VROg/exec',

  // ⬇️ DÁN OAuth Client ID vào đây sau khi tạo (dạng ....apps.googleusercontent.com)
  // Trước khi có, trang vẫn mở được nhưng chưa đăng nhập Google được.
  GOOGLE_CLIENT_ID: '689653860455-lu5s36i8oac12au0oeh5c4r59fr5e440.apps.googleusercontent.com'
};
