/**
 * auth.js — ĐĂNG NHẬP GOOGLE (Google Identity Services)
 * ------------------------------------------------------------------
 * Hiện nút "Sign in with Google". Khi user đăng nhập, GIS trả về 1 ID token (JWT);
 * ta lưu lại và gửi kèm mỗi request để backend xác minh (Auth.gs).
 */
const AppAuth = {
  token: null,
  user: null,

  /** Khởi tạo nút đăng nhập. onLogin = hàm gọi sau khi có token. */
  init(onLogin) {
    const note = document.getElementById('loginNote');
    if (!APP_CONFIG.GOOGLE_CLIENT_ID) {
      note.textContent = '⚠️ Chưa cấu hình GOOGLE_CLIENT_ID trong config.js — chưa đăng nhập được. ' +
        '(Tạo OAuth Client ID rồi dán vào config.js.)';
      return;
    }
    // Chờ thư viện GIS tải xong.
    const choGIS = setInterval(() => {
      if (window.google && google.accounts && google.accounts.id) {
        clearInterval(choGIS);
        google.accounts.id.initialize({
          client_id: APP_CONFIG.GOOGLE_CLIENT_ID,
          callback: (resp) => {
            AppAuth.token = resp.credential; // đây là ID token (JWT)
            onLogin();
          }
        });
        google.accounts.id.renderButton(
          document.getElementById('gbtn'),
          { theme: 'filled_blue', size: 'large', text: 'signin_with', locale: 'vi' }
        );
      }
    }, 200);
  },

  /** Đăng xuất: xoá token + nạp lại trang. */
  logout() {
    AppAuth.token = null;
    AppAuth.user = null;
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    location.reload();
  }
};
