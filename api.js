/**
 * api.js — GỌI BACKEND APPS SCRIPT
 * ------------------------------------------------------------------
 * Gửi POST với Content-Type 'text/plain' để né preflight CORS (xem KICKOFF mục 1).
 * Mỗi request kèm token đăng nhập (ID token Google). Trả về data hoặc ném lỗi.
 */
const Api = {
  /** Gọi 1 action tới backend. */
  async goi(action, payload) {
    // LƯU Ý: AppAuth khai bằng `const` nên KHÔNG nằm trên window — phải tham chiếu trực tiếp.
    const token = (typeof AppAuth !== 'undefined' && AppAuth.token) ? AppAuth.token : '';
    const body = JSON.stringify({
      action: action,
      token: token,
      payload: payload || {}
    });
    Api._busy(true); // bật thanh loading trên cùng
    let res, json;
    try {
      res = await fetch(APP_CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow'
      });
      json = await res.json();
    } catch (e) {
      throw new Error('Không kết nối được máy chủ. Kiểm tra mạng / URL API.');
    } finally {
      Api._busy(false);
    }
    if (!json.ok) throw new Error(json.error || 'Lỗi không xác định từ máy chủ.');
    return json.data;
  },

  // Đếm số request đang chạy -> hiện/ẩn thanh loading.
  _dem: 0,
  _busy(on) {
    this._dem += on ? 1 : -1;
    const b = document.getElementById('loadbar');
    if (b) b.classList.toggle('hidden', this._dem <= 0);
  },

  // Các lối tắt hay dùng
  ping() { return this.goi('ping', {}); },
  bootstrap() { return this.goi('bootstrap', {}); },
  list(loai_tab, filters) { return this.goi('list', { loai_tab, filters }); },
  get(loai_tab, key) { return this.goi('get', { loai_tab, key }); },
  save(loai_tab, record, mode) { return this.goi('save', { loai_tab, record, mode }); },
  duyet(payload) { return this.goi('duyet', payload); },
  kiemDuNcc(ma_yeu_cau) { return this.goi('khaosat.kiemDu', { ma_yeu_cau }); }
};
