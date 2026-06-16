/**
 * app.js — ỨNG DỤNG CHÍNH (form engine + danh sách + duyệt)
 * ------------------------------------------------------------------
 * Sau khi đăng nhập, nạp 'bootstrap' (user + cấu hình engine + danh mục), rồi:
 *  - Dựng menu theo vai trò.
 *  - Render form ĐỘNG từ CONFIG_TRUONG (thêm quy trình = thêm dòng config, không sửa JS).
 *  - Danh sách lọc sẵn theo người phụ trách (backend đã lọc theo nspt/vai trò).
 *  - Màn Duyệt cho QLTM (Duyệt/Không duyệt/Tìm thêm) — ghi vết trên server.
 */

let BOOT = null;           // dữ liệu bootstrap
let VIEW = 'yeucau';       // màn đang xem
let LOC_YEUCAU = null;     // lọc khảo sát theo 1 mã yêu cầu (nếu có)
let CACHE_YEUCAU = null;   // cache danh sách yêu cầu cho dropdown
let CACHE_DONMUA = null;   // cache danh sách đơn mua (lọc client cho nhanh)

// Map nguồn dropdown (CONFIG_TRUONG.nguon_dropdown) -> khoá trong BOOT.master
const MAP_MASTER = {
  MD_NCC: 'ncc', MD_HANG: 'hang', MD_BRAND: 'brand', MD_PHAPNHAN: 'phapnhan',
  MD_KHO: 'kho', MD_DVVC: 'dvvc', MD_DVT: 'dvt', MD_VAT: 'vat',
  MD_PHANLOAI: 'phanloai', MD_TRANGTHAI: 'trangthai', USERS: 'nspt'
};
// Dropdown danh sách cứng theo tên trường (chỉ các trường đặc biệt; còn lại lấy từ ghi_chu).
const LIST_CUNG = {
  muc_tin_cay: ['Cao', 'TB', 'Thấp'],
  ket_qua_duyet: ['Duyệt', 'Không duyệt', 'Tìm thêm']
};

// Khoá chính mỗi bảng (khớp PRIMARY_KEY backend) — để biết tạo mới hay cập nhật.
const PK_MAP = {
  DL_YEUCAU: 'ma_yeu_cau', DL_DONMUA: 'ma_don', DL_SUCO: 'ma_su_co',
  DL_HOPDONG: 'ma_hd', DL_DIEUPHOI: 'ma_dp', USERS: 'email'
};
function pkCua(tab) { return PK_MAP[tab] || 'id'; }

// ===== Tiện ích DOM =====
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  (children || []).forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  setTimeout(() => t.classList.add('hidden'), 3500);
}
function spinner() { return el('div', { class: 'spinner' }); }

// ===== Định dạng hiển thị (ngày dd/mm/yyyy, số có dấu chấm phân cách nghìn) =====
const COT_TIEN = new Set(['so_tien', 'don_gia', 'thanh_tien', 'gia', 'gia_de_xuat', 'dau_ky',
  'ps_tang', 'ps_giam', 'cuoi_ky_misa', 'cuoi_ky_bb_ncc', 'nk_gia_usd', 'nk_gia_von',
  'moq', 'sl_yeu_cau', 'sl_dat_ncc', 'sl_nhan', 'so_luong_ton', 'gia_tam_tinh',
  'don_gia_vc', 'thanh_tien_vc', 'sl_gui_vc']);
const COT_NGAY = new Set(['ngay', 'ngay_tiep_nhan', 'ngay_yc_tra_kq', 'ngay_lien_he', 'ngay_bao_gia',
  'ngay_tra_kq', 'ngay_dat_ncc', 'ngay_yeu_cau', 'ngay_dk_nhan', 'ngay_nhan_tt', 'ngay_phat_sinh',
  'deadline', 'ngay_bat_dau', 'ngay_ket_thuc', 'ngay_lay_mau', 'nk_ngay_dk_thong_quan', 'nk_ngay_tt_thong_quan', 'ngay_dat']);
function fmtNgay(v) {
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(v);
}
function fmtSo(v) {
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString('vi-VN');
}
function dinhDangO(col, v) {
  if (v === '' || v === null || v === undefined) return '';
  if (COT_TIEN.has(col)) return fmtSo(v);
  if (COT_NGAY.has(col)) return fmtNgay(v);
  if (col === 'ky') return fmtNgay(String(v).replace(/\.0$/, '')); // kỳ: bỏ ".0", nếu là ngày thì format
  if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(String(v))) return fmtNgay(v); // tự nhận diện ngày ISO
  return String(v);
}

// ===== Khởi động =====
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnLogout').addEventListener('click', () => AppAuth.logout());
  document.getElementById('modalClose').addEventListener('click', dongModal);
  AppAuth.init(sauDangNhap);
});

async function sauDangNhap() {
  try {
    BOOT = await Api.bootstrap();
    AppAuth.user = BOOT.user;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userbox').classList.remove('hidden');
    document.getElementById('userInfo').textContent =
      BOOT.user.ho_ten + ' · ' + BOOT.user.vai_tro + (BOOT.user.nspt_code ? ' (' + BOOT.user.nspt_code + ')' : '');
    dungMenu();
    moView('yeucau');
    // LƯU Ý: Widget khai bằng `const` nên KHÔNG nằm trên window — tham chiếu trực tiếp.
    if (typeof Widget !== 'undefined') Widget.onLogin(); // bật widget hỗ trợ (góc phải dưới)
  } catch (e) {
    toast(e.message, true);
    document.getElementById('loginNote').textContent = 'Lỗi: ' + e.message;
  }
}

// ===== Menu theo vai trò (chia nhóm) =====
function dungMenu() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  const qltm = BOOT.user.toan_doi || BOOT.user.vai_tro === 'QLTM';
  const groups = [
    { ten: 'Khảo sát', items: [
      { id: 'yeucau', label: '📋 Yêu cầu' },
      { id: 'khaosat', label: '🔍 Đánh giá NCC' }
    ].concat(qltm ? [{ id: 'duyet', label: '✅ Duyệt' }] : []) },
    { ten: 'Mua hàng', items: [
      { id: 'donmua', label: '📦 Đơn mua' },
      { id: 'vanchuyen', label: '🚚 Vận chuyển' },
      { id: 'chi', label: '💵 Chi NCC' },
      { id: 'congno', label: '📒 Công nợ' }
    ] },
    { ten: 'Kho / VTBB', items: [
      { id: 'tonkho', label: '📦 Tồn kho' },
      { id: 'dutru', label: '📝 Dự trù' }
    ] },
    { ten: 'Khác', items: [
      { id: 'suco', label: '⚠️ Sự cố' },
      { id: 'hopdong', label: '📄 Hợp đồng' },
      { id: 'dieuphoi', label: '🔀 Điều phối' }
    ] },
    { ten: 'Trợ giúp', items: [
      { id: 'hdsd', label: '📖 Hướng dẫn' }
    ] }
  ];
  if (qltm) groups.push({ ten: 'Quản lý', items: [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'nguoidung', label: '👥 Người dùng' }
  ] });

  groups.forEach(gr => {
    nav.appendChild(el('div', { class: 'navgroup' }, [gr.ten]));
    gr.items.forEach(it => nav.appendChild(el('button', {
      class: 'navbtn' + (VIEW === it.id ? ' active' : ''),
      onclick: () => moView(it.id)
    }, [it.label])));
  });
}

const VIEW_FN = {
  yeucau: () => viewYeuCau(),
  khaosat: () => viewKhaoSat(),
  donmua: () => viewDonMua(),
  duyet: () => viewDuyet(),
  vanchuyen: () => viewVanChuyen(),
  chi: () => viewBangEntity('DL_CHI', ['ma_misa', 'loai_chi', 'ma_chi_phi', 'so_tien', 'ngay', 'nspt'], 'Chi NCC'),
  congno: () => viewBangEntity('DL_CONGNO', ['ma_ncc', 'ky', 'cuoi_ky_misa', 'ket_luan', 'nspt'], 'Đối chiếu công nợ'),
  suco: () => viewBangEntity('DL_SUCO', ['ma_su_co', 'ngay_phat_sinh', 'phan_loai_loi', 'muc_do', 'trang_thai', 'nspt'], 'Sự cố thu mua'),
  hopdong: () => viewBangEntity('DL_HOPDONG', ['ma_hd', 'so_ky_hieu', 'ma_ncc', 'phan_loai', 'ngay_ket_thuc', 'nspt'], 'Hợp đồng NCC'),
  dieuphoi: () => viewBangEntity('DL_DIEUPHOI', ['ma_dp', 'ngay', 'khach_hang', 'ncc_thuc_te', 'trang_thai'], 'Điều phối đơn hàng'),
  dashboard: () => viewDashboard(),
  nguoidung: () => viewUsers(),
  hdsd: () => { if (window.HDSDView) HDSDView.render(); },
  tonkho: () => viewBangLoc('DL_TONKHO',
    ['nha_may', 'phan_loai', 'ma_vtbb', 'ten_vtbb', 'so_luong_ton', 'gia_tam_tinh', 'ky'], 'Tồn kho VTBB'),
  dutru: () => viewBangLoc('DL_DUTRU',
    ['ma_don_dutru', 'ngay_dat', 'ncc', 'kho_nhan', 'ma_vtbb', 'ten_vtbb', 'muc_dich', 'tien_do'], 'Dự trù VTBB', { them: true })
};

// Màn danh sách CÓ Ô LỌC (cho bảng nhiều dòng: tồn kho, dự trù).
async function viewBangLoc(tab, cols, tieu, opts) {
  opts = opts || {};
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe(tieu, opts.them ? '+ Thêm' : null, opts.them ? () => formEntity(tab, null, opts) : null));
  const box = el('input', { class: 'inp', placeholder: 'Lọc theo mã / tên / NCC…' });
  box.style.maxWidth = '340px'; box.style.marginBottom = '12px';
  c.appendChild(box);
  const holder = el('div'); c.appendChild(holder); holder.appendChild(spinner());
  let all = [];
  try { all = await Api.list(tab, {}); }
  catch (e) { holder.innerHTML = ''; holder.appendChild(el('p', { class: 'err' }, [e.message])); return; }
  function render(rows) {
    holder.innerHTML = '';
    holder.appendChild(el('div', { class: 'muted small' }, [rows.length + ' dòng']));
    holder.appendChild(bangDuLieu(rows.slice(0, 300), cols,
      opts.them ? (r) => el('button', { class: 'btn btn-sm', onclick: () => formEntity(tab, r, opts) }, ['Sửa']) : null));
    if (rows.length > 300) holder.appendChild(el('p', { class: 'muted small' },
      ['Hiển thị 300/' + rows.length + ' — gõ ô lọc để thu hẹp.']));
  }
  render(all);
  box.addEventListener('input', () => {
    const q = box.value.toLowerCase().trim();
    render(!q ? all : all.filter(r => cols.some(c => String(r[c] || '').toLowerCase().includes(q))));
  });
}

// ===== Module QUẢN LÝ NGƯỜI DÙNG (QLTM/Admin) — cấp/sửa/khoá/xoá quyền =====
const USER_FIELDS = [
  { ma_truong: 'email', nhan: 'Email Google', kieu: 'text', bat_buoc: true, ghi_chu: 'Email đăng nhập của nhân sự' },
  { ma_truong: 'ho_ten', nhan: 'Họ tên', kieu: 'text', bat_buoc: true },
  { ma_truong: 'vai_tro', nhan: 'Vai trò', kieu: 'dropdown', bat_buoc: true, ghi_chu: 'NSTM/Admin/QLTM/BPYC/DieuPhoi/Lab/KeToan' },
  { ma_truong: 'nspt_code', nhan: 'Mã NSPT', kieu: 'text', bat_buoc: false, ghi_chu: 'Khớp tên người phụ trách trong dữ liệu, vd "Mr Hậu" — để NSTM lọc đúng việc' },
  { ma_truong: 'brand_phu_trach', nhan: 'Nhóm/Brand phụ trách', kieu: 'text', bat_buoc: false },
  { ma_truong: 'trang_thai', nhan: 'Trạng thái', kieu: 'dropdown', bat_buoc: true, ghi_chu: 'active/nghi' },
  { ma_truong: 'ghi_chu', nhan: 'Ghi chú', kieu: 'text', bat_buoc: false }
];

async function viewUsers() {
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe('Người dùng & phân quyền', '+ Cấp quyền', () => formUser(null)));
  c.appendChild(el('p', { class: 'muted small' },
    ['Cấp quyền = thêm email + vai trò. "Khoá" đổi trạng thái sang nghi (không xoá). "Xóa" thu hồi hoàn toàn.']));
  const sp = spinner(); c.appendChild(sp);
  try {
    const rows = await Api.goi('users.list', {});
    sp.remove();
    const tbl = el('table', { class: 'tbl' });
    tbl.appendChild(el('tr', {}, ['Email', 'Họ tên', 'Vai trò', 'Mã NSPT', 'Trạng thái', 'Hành động']
      .map(h => el('th', {}, [h]))));
    rows.forEach(u => {
      const act = el('td', { class: 'actions' });
      act.appendChild(el('button', { class: 'btn btn-sm', onclick: () => formUser(u) }, ['Sửa']));
      // Khoá/Mở
      const dangActive = String(u.trang_thai).toLowerCase() !== 'nghi';
      act.appendChild(el('button', { class: 'btn btn-sm', onclick: () => toggleKhoa(u) },
        [dangActive ? 'Khoá' : 'Mở khoá']));
      act.appendChild(el('button', { class: 'btn btn-sm btn-danger', onclick: () => xoaUser(u) }, ['Xóa']));
      tbl.appendChild(el('tr', {}, [
        el('td', {}, [String(u.email || '')]),
        el('td', {}, [String(u.ho_ten || '')]),
        el('td', {}, [el('span', { class: 'pill' }, [String(u.vai_tro || '')])]),
        el('td', {}, [String(u.nspt_code || '')]),
        el('td', {}, [el('span', { class: dangActive ? 'badge ok' : 'badge warn' }, [dangActive ? 'active' : 'nghi'])]),
        act
      ]));
    });
    c.appendChild(tbl);
  } catch (e) { sp.remove(); c.appendChild(el('p', { class: 'err' }, [e.message])); }
}

function formUser(record) {
  moModal(record ? ('Sửa quyền — ' + record.email) : 'Cấp quyền người dùng', 'USERS', USER_FIELDS,
    record || { trang_thai: 'active' },
    { saveFn: (rec) => Api.goi('users.save', { record: rec }) });
}

async function toggleKhoa(u) {
  const moi = Object.assign({}, u);
  moi.trang_thai = (String(u.trang_thai).toLowerCase() === 'nghi') ? 'active' : 'nghi';
  delete moi._row;
  try { await Api.goi('users.save', { record: moi }); toast('Đã cập nhật.'); viewUsers(); }
  catch (e) { toast(e.message, true); }
}

async function xoaUser(u) {
  if (!confirm('Xóa quyền của ' + u.email + '? Người này sẽ không đăng nhập được nữa.')) return;
  try { await Api.goi('users.delete', { email: u.email }); toast('Đã xóa.'); viewUsers(); }
  catch (e) { toast(e.message, true); }
}

function moView(v) {
  VIEW = v;
  LOC_YEUCAU = (v === 'khaosat') ? LOC_YEUCAU : null;
  dungMenu();
  (VIEW_FN[v] || VIEW_FN.yeucau)();
}

// ===== Màn danh sách CHUNG cho 1 bảng (list + tạo mới qua form engine) =====
async function viewBangEntity(tab, cols, tieu, opts) {
  opts = opts || {};
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe(tieu, '+ Thêm', () => formEntity(tab, null, opts)));
  const sp = spinner(); c.appendChild(sp);
  try {
    const rows = await Api.list(tab, opts.filters || {});
    sp.remove();
    c.appendChild(bangDuLieu(rows, cols,
      (r) => el('button', { class: 'btn btn-sm', onclick: () => formEntity(tab, r, opts) }, ['Sửa'])));
  } catch (e) { sp.remove(); c.appendChild(el('p', { class: 'err' }, [e.message])); }
}

// Mở form engine cho 1 bảng bất kỳ (record=null là tạo mới).
function formEntity(tab, record, opts) {
  opts = opts || {};
  const loai_qt = (record && record.loai_qt) || opts.loai_qt || 'MUA_TN';
  const fields = truongCua(tab, loai_qt);
  const rec = record || Object.assign({}, opts.preset || {});
  moModal((record ? 'Sửa — ' : 'Thêm — ') + tieuBang(tab), tab, fields, rec, opts.modalOpts || {});
}

function tieuBang(tab) {
  const m = { DL_CHI: 'Chi NCC', DL_CONGNO: 'Công nợ', DL_SUCO: 'Sự cố', DL_HOPDONG: 'Hợp đồng',
    DL_DIEUPHOI: 'Điều phối', DL_DONMUA: 'Đơn mua', DL_DONGHANG: 'Dòng hàng', DL_NHANHANG: 'Lần nhận' };
  return m[tab] || tab;
}

// ===== Màn Theo dõi vận chuyển (lần nhận + đơn chờ giao) =====
async function viewVanChuyen() {
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe('Theo dõi vận chuyển & nhận hàng', null, null));
  try {
    const nhan = await Api.list('DL_NHANHANG', {});
    c.appendChild(el('div', { class: 'muted small' }, [nhan.length + ' lần nhận hàng']));
    c.appendChild(bangDuLieu(nhan,
      ['ma_don', 'lan_nhan', 'ngay_nhan_tt', 'sl_nhan', 'so_hoa_don', 'nspt'], null));
  } catch (e) { c.appendChild(el('p', { class: 'err' }, [e.message])); }
}

// ===== VIEW: Đơn mua (đầu đơn + dòng hàng) =====
async function viewDonMua() {
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe('Đơn mua', '+ Tạo đơn',
    () => formEntity('DL_DONMUA', null, { modalOpts: { themLoaiQt: true } })));

  const box = el('input', { class: 'inp', placeholder: 'Lọc theo mã đơn / NCC / NSPT…' });
  box.style.maxWidth = '340px'; box.style.marginBottom = '12px';
  c.appendChild(box);
  const holder = el('div'); c.appendChild(holder);
  holder.appendChild(spinner());

  // Nạp sẵn danh sách yêu cầu cho dropdown "Phiếu yêu cầu nguồn" trong form tạo đơn.
  if (!CACHE_YEUCAU) { try { CACHE_YEUCAU = await Api.list('DL_YEUCAU', {}); } catch (e) { CACHE_YEUCAU = []; } }

  try {
    CACHE_DONMUA = await Api.list('DL_DONMUA', {});
  } catch (e) { holder.innerHTML = ''; holder.appendChild(el('p', { class: 'err' }, [e.message])); return; }

  function render(rows) {
    holder.innerHTML = '';
    holder.appendChild(el('div', { class: 'muted small' }, [rows.length + ' đơn']));
    holder.appendChild(bangDuLieu(rows.slice(0, 300),
      ['ma_don', 'ma_ncc', 'phap_nhan_hd', 'nspt', 'trang_thai', 'ngay_dat_ncc'],
      (r) => el('button', { class: 'btn btn-sm', onclick: () => viewDongHang(r.ma_don) }, ['Dòng hàng ▸'])
    ));
    if (rows.length > 300) holder.appendChild(el('p', { class: 'muted small' },
      ['Hiển thị 300/' + rows.length + ' — gõ ô lọc để thu hẹp.']));
  }
  render(CACHE_DONMUA);
  box.addEventListener('input', () => {
    const q = box.value.toLowerCase().trim();
    render(!q ? CACHE_DONMUA : CACHE_DONMUA.filter(r =>
      (String(r.ma_don) + ' ' + String(r.ma_ncc) + ' ' + String(r.nspt)).toLowerCase().includes(q)));
  });
}

async function viewDongHang(ma_don) {
  const c = document.getElementById('content');
  c.innerHTML = '';
  // Lấy loại quy trình của đơn (để form dòng hàng hiện đúng trường, vd NK).
  let loai_qt = 'MUA_TN';
  try { const d = await Api.get('DL_DONMUA', ma_don); loai_qt = d.loai_qt || 'MUA_TN'; } catch (e) {}

  const head = thanhTieuDe('Đơn ' + ma_don, '+ Thêm dòng hàng',
    () => formEntity('DL_DONGHANG', null, { loai_qt: loai_qt, preset: { ma_don: ma_don, loai_qt: loai_qt } }));
  c.appendChild(head);
  c.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => moView('donmua') }, ['◂ Về danh sách đơn']));

  try {
    const rows = await Api.list('DL_DONGHANG', { ma_don: ma_don });
    c.appendChild(el('h3', { class: 'sub' }, ['Dòng hàng']));
    c.appendChild(bangDuLieu(rows,
      ['ma_hang', 'ten_hang', 'phan_loai', 'sl_yeu_cau', 'sl_dat_ncc', 'don_gia', 'vat', 'thanh_tien', 'kho_nhan'],
      (r) => el('button', { class: 'btn btn-sm', onclick: () => formNhanHang(ma_don, r.id) }, ['+ Nhận'])
    ));
    // Lần nhận của đơn
    const nhan = await Api.list('DL_NHANHANG', { ma_don: ma_don });
    c.appendChild(el('h3', { class: 'sub' }, ['Lần nhận hàng (' + nhan.length + ')']));
    c.appendChild(bangDuLieu(nhan,
      ['lan_nhan', 'ngay_nhan_tt', 'sl_nhan', 'so_hoa_don'], null));
  } catch (e) { c.appendChild(el('p', { class: 'err' }, [e.message])); }
}

// Thêm 1 lần nhận cho 1 dòng hàng
function formNhanHang(ma_don, id_dong_hang) {
  formEntity('DL_NHANHANG', null, { preset: { ma_don: ma_don, id_dong_hang: id_dong_hang } });
}

// ===== Dashboard QLTM (có lọc thời gian) =====
let DASH_TU = '', DASH_DEN = '';
function _ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

async function viewDashboard() {
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe('Dashboard — Tổng quan thu mua', null, null));

  const bar = el('div', { class: 'filterbar' });
  const wrap = el('div');
  const inpTu = el('input', { type: 'date', class: 'inp' }); inpTu.style.maxWidth = '155px';
  const inpDen = el('input', { type: 'date', class: 'inp' }); inpDen.style.maxWidth = '155px';

  function chonPreset(days, chip) {
    Array.from(bar.querySelectorAll('.chip')).forEach(x => x.classList.remove('active'));
    if (chip) chip.classList.add('active');
    if (!days) { DASH_TU = ''; DASH_DEN = ''; }
    else { const den = new Date(); const tu = new Date(); tu.setDate(tu.getDate() - days); DASH_TU = _ymd(tu); DASH_DEN = _ymd(den); }
    inpTu.value = DASH_TU; inpDen.value = DASH_DEN;
    taiDashboard(wrap, DASH_TU, DASH_DEN);
  }
  [['Tất cả', 0], ['7 ngày', 7], ['14 ngày', 14], ['30 ngày', 30], ['90 ngày', 90], ['1 năm', 365]]
    .forEach(([label, days]) => {
      const ch = el('button', { class: 'chip', onclick: () => chonPreset(days, ch) }, [label]);
      bar.appendChild(ch);
    });
  bar.appendChild(el('span', { class: 'muted small' }, ['Từ']));
  bar.appendChild(inpTu);
  bar.appendChild(el('span', { class: 'muted small' }, ['đến']));
  bar.appendChild(inpDen);
  bar.appendChild(el('button', { class: 'btn btn-sm btn-primary', onclick: () => {
    DASH_TU = inpTu.value; DASH_DEN = inpDen.value;
    Array.from(bar.querySelectorAll('.chip')).forEach(x => x.classList.remove('active'));
    taiDashboard(wrap, DASH_TU, DASH_DEN);
  } }, ['Áp dụng']));
  c.appendChild(bar);
  c.appendChild(wrap);

  inpTu.value = DASH_TU; inpDen.value = DASH_DEN;
  taiDashboard(wrap, DASH_TU, DASH_DEN);
}

async function taiDashboard(wrap, tu, den) {
  wrap.innerHTML = ''; wrap.appendChild(spinner());
  let d;
  try { d = await Api.goi('report', { tu_ngay: tu || '', den_ngay: den || '' }); }
  catch (e) { wrap.innerHTML = ''; wrap.appendChild(el('p', { class: 'err' }, [e.message])); return; }
  wrap.innerHTML = '';
  if (tu || den) wrap.appendChild(el('div', { class: 'muted small' }, ['Khoảng: ' + (tu || '…') + ' → ' + (den || '…')]));

  // Thẻ số tổng
  const cards = el('div', { class: 'cards' });
  const tien = (n) => (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
  [['Tổng đơn', d.tong_don], ['Dòng hàng', d.tong_dong_hang], ['Lần nhận', d.tong_lan_nhan],
   ['Khảo sát NCC', d.tong_khao_sat], ['Tổng giá trị mua', tien(d.tong_gia_tri)],
   ['Công nợ lệch', d.cong_no_le + '/' + d.cong_no_tong]
  ].forEach(([t, v]) => cards.appendChild(
    el('div', { class: 'card-stat' }, [el('div', { class: 'cs-num' }, [String(v)]), el('div', { class: 'cs-lbl' }, [t])])));
  wrap.appendChild(cards);

  wrap.appendChild(bangTuObject('Đơn theo trạng thái', d.don_theo_trang_thai));
  wrap.appendChild(bangTuObject('Đơn theo NSPT', d.don_theo_nspt));
  wrap.appendChild(bangTuObject('Giá trị mua theo NSPT (đ)', d.gia_tri_theo_nspt, true));
  wrap.appendChild(bangTuObject('Chi theo loại (đ)', d.chi_theo_loai, true));

  // Top NCC
  const tbl = el('table', { class: 'tbl' });
  tbl.appendChild(el('tr', {}, [el('th', {}, ['NCC']), el('th', {}, ['Số đơn'])]));
  (d.top_ncc || []).forEach(x => tbl.appendChild(el('tr', {}, [el('td', {}, [String(x.ncc)]), el('td', {}, [String(x.so_don)])])));
  wrap.appendChild(el('h3', { class: 'sub' }, ['Top 10 NCC theo số đơn']));
  wrap.appendChild(tbl);
}

// Bảng 2 cột từ object {khoá: số}
function bangTuObject(tieu, obj, laTien) {
  const box = el('div');
  box.appendChild(el('h3', { class: 'sub' }, [tieu]));
  const tbl = el('table', { class: 'tbl' });
  const keys = Object.keys(obj || {}).sort((a, b) => (obj[b] || 0) - (obj[a] || 0));
  if (!keys.length) { box.appendChild(el('p', { class: 'muted' }, ['(không có dữ liệu)'])); return box; }
  keys.forEach(k => {
    const v = laTien ? (Number(obj[k]) || 0).toLocaleString('vi-VN') : obj[k];
    tbl.appendChild(el('tr', {}, [el('td', {}, [String(k)]), el('td', {}, [String(v)])]));
  });
  box.appendChild(tbl);
  return box;
}

// ===== VIEW 1: Yêu cầu khảo sát =====
async function viewYeuCau() {
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe('Yêu cầu khảo sát', '+ Tạo yêu cầu', () => formYeuCau()));
  try {
    const rows = await Api.list('DL_YEUCAU', {});
    CACHE_YEUCAU = rows;
    c.appendChild(bangDuLieu(rows,
      ['ma_yeu_cau', 'loai_qt', 'ngay_tiep_nhan', 'bp_yeu_cau', 'phan_loai', 'nspt', 'trang_thai'],
      (r) => el('button', { class: 'btn btn-sm', onclick: () => { LOC_YEUCAU = r.ma_yeu_cau; moView('khaosat'); } }, ['Khảo sát NCC ▸'])
    ));
  } catch (e) { c.appendChild(el('p', { class: 'err' }, [e.message])); }
}

// ===== VIEW 2: Đánh giá NCC =====
async function viewKhaoSat() {
  const c = document.getElementById('content');
  c.innerHTML = '';
  const tieu = LOC_YEUCAU ? ('Đánh giá NCC — yêu cầu ' + LOC_YEUCAU) : 'Đánh giá NCC';
  c.appendChild(thanhTieuDe(tieu, '+ Thêm NCC', () => formKhaoSat()));
  if (LOC_YEUCAU) {
    c.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { LOC_YEUCAU = null; viewKhaoSat(); } }, ['✕ Bỏ lọc theo yêu cầu']));
    // Cảnh báo ≥2 NCC
    try {
      const d = await Api.kiemDuNcc(LOC_YEUCAU);
      c.appendChild(el('div', { class: 'badge ' + (d.du ? 'ok' : 'warn') },
        [d.du ? ('✓ Đã có ' + d.so_ncc + ' NCC (đủ ≥2)') : ('⚠ Mới ' + d.so_ncc + ' NCC — cần ≥2 để duyệt')]));
    } catch (e) {}
  }
  try {
    const filters = LOC_YEUCAU ? { ma_yeu_cau: LOC_YEUCAU } : {};
    const rows = await Api.list('DL_KHAOSAT_NCC', filters);
    c.appendChild(bangDuLieu(rows,
      ['ma_yeu_cau', 'ma_ncc', 'muc_tin_cay', 'chinh_sach_cong_no', 'nhan_xet_nspt', 'ket_qua_duyet'],
      (r) => el('button', { class: 'btn btn-sm', onclick: () => formKhaoSat(r) }, ['Sửa'])
    ));
  } catch (e) { c.appendChild(el('p', { class: 'err' }, [e.message])); }
}

// ===== VIEW 3: Duyệt (QLTM) =====
async function viewDuyet() {
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.appendChild(thanhTieuDe('Duyệt NCC (QLTM)', null, null));
  try {
    const rows = await Api.list('DL_KHAOSAT_NCC', {});
    if (!rows.length) { c.appendChild(el('p', { class: 'muted' }, ['Chưa có dòng khảo sát nào.'])); return; }
    const tbl = el('table', { class: 'tbl' });
    tbl.appendChild(el('tr', {}, ['Mã YC', 'NCC', 'Tin cậy', 'Nhận xét', 'Kết quả', 'Hành động'].map(h => el('th', {}, [h]))));
    rows.forEach(r => {
      const tr = el('tr', {}, [
        el('td', {}, [String(r.ma_yeu_cau || '')]),
        el('td', {}, [String(r.ma_ncc || '')]),
        el('td', {}, [String(r.muc_tin_cay || '')]),
        el('td', {}, [String(r.nhan_xet_nspt || '')]),
        el('td', {}, [el('span', { class: 'pill' }, [String(r.ket_qua_duyet || '—')])])
      ]);
      const act = el('td', { class: 'actions' });
      ['Duyệt', 'Không duyệt', 'Tìm thêm'].forEach(kq => {
        act.appendChild(el('button', {
          class: 'btn btn-sm ' + (kq === 'Duyệt' ? 'btn-primary' : 'btn-ghost'),
          onclick: () => duyet(r.id, kq)
        }, [kq]));
      });
      tr.appendChild(act);
      tbl.appendChild(tr);
    });
    c.appendChild(tbl);
  } catch (e) { c.appendChild(el('p', { class: 'err' }, [e.message])); }
}

async function duyet(id, ketQua) {
  try {
    await Api.duyet({
      entity: 'khao_sat_ncc', loai_tab: 'DL_KHAOSAT_NCC', key: id,
      cot_ket_qua: 'ket_qua_duyet', ket_qua: ketQua, buoc: 'Duyệt NCC'
    });
    toast('Đã ghi: ' + ketQua);
    viewDuyet();
  } catch (e) { toast(e.message, true); }
}

// ===== Thành phần dùng lại =====
function thanhTieuDe(tieu, nutLabel, onNut) {
  const head = el('div', { class: 'view-head' }, [el('h2', {}, [tieu])]);
  if (nutLabel) head.appendChild(el('button', { class: 'btn btn-primary', onclick: onNut }, [nutLabel]));
  return head;
}

function bangDuLieu(rows, cols, actionFn) {
  if (!rows || !rows.length) return el('p', { class: 'muted' }, ['Chưa có dữ liệu.']);
  const tbl = el('table', { class: 'tbl' });
  const head = cols.map(c => el('th', {}, [nhanCot(c)]));
  if (actionFn) head.push(el('th', {}, ['']));
  tbl.appendChild(el('tr', {}, head));
  rows.forEach(r => {
    const tds = cols.map(c => el('td', {}, [dinhDangO(c, r[c])]));
    if (actionFn) { const td = el('td', { class: 'actions' }); td.appendChild(actionFn(r)); tds.push(td); }
    tbl.appendChild(el('tr', {}, tds));
  });
  return tbl;
}

// Nhãn cột thân thiện
function nhanCot(ma) {
  const m = {
    ma_yeu_cau: 'Mã YC', loai_qt: 'Quy trình', ngay_tiep_nhan: 'Ngày nhận',
    bp_yeu_cau: 'Bộ phận', phan_loai: 'Phân loại', nspt: 'NSPT', trang_thai: 'Trạng thái',
    ma_ncc: 'NCC', muc_tin_cay: 'Tin cậy', chinh_sach_cong_no: 'Công nợ',
    nhan_xet_nspt: 'Nhận xét', ket_qua_duyet: 'Kết quả duyệt',
    ma_don: 'Mã đơn', ma_misa: 'Mã Misa', phap_nhan_hd: 'Pháp nhân HĐ', ngay_dat_ncc: 'Ngày đặt',
    ma_hang: 'Mã hàng', ten_hang: 'Tên hàng', sl_yeu_cau: 'SL yêu cầu', sl_dat_ncc: 'SL đặt',
    don_gia: 'Đơn giá', vat: 'VAT', thanh_tien: 'Thành tiền', kho_nhan: 'Kho nhận',
    loai_chi: 'Loại chi', ma_chi_phi: 'Mã CP', so_tien: 'Số tiền', ngay: 'Ngày',
    ky: 'Kỳ', cuoi_ky_misa: 'Cuối kỳ Misa', ket_luan: 'Kết luận',
    ma_su_co: 'Mã sự cố', ngay_phat_sinh: 'Ngày phát sinh', phan_loai_loi: 'Loại lỗi', muc_do: 'Mức độ',
    ma_hd: 'Mã HĐ', so_ky_hieu: 'Số ký hiệu', ngay_ket_thuc: 'Hết hạn',
    ma_dp: 'Mã ĐP', khach_hang: 'Khách hàng', ncc_thuc_te: 'NCC thực tế',
    lan_nhan: 'Lần nhận', ngay_nhan_tt: 'Ngày nhận', sl_nhan: 'SL nhận', so_hoa_don: 'Số HĐ',
    nha_may: 'Nhà máy/Kho', ma_vtbb: 'Mã VTBB', ten_vtbb: 'Tên VTBB', so_luong_ton: 'SL tồn',
    gia_tam_tinh: 'Giá tạm tính', ky: 'Kỳ', ma_don_dutru: 'Mã dự trù', ngay_dat: 'Ngày đặt',
    ncc: 'NCC', muc_dich: 'Mục đích', tien_do: 'Tiến độ'
  };
  return m[ma] || ma;
}

// ===== FORM ENGINE — render từ CONFIG_TRUONG =====
function truongCua(loai_tab, loai_qt) {
  return BOOT.truong
    .filter(t => t.loai_tab === loai_tab && (t.ma_qt === '*' || t.ma_qt === loai_qt))
    .filter(t => String(t.hien_thi).toUpperCase() !== 'FALSE')
    .sort((a, b) => (Number(a.thu_tu) || 0) - (Number(b.thu_tu) || 0));
}

function formYeuCau(record) {
  const dangSua = !!record;
  // Chọn loại quy trình (chỉ khi tạo mới)
  const fields = truongCua('DL_YEUCAU', record ? record.loai_qt : (BOOT.quytrinh[0] && BOOT.quytrinh[0].ma_qt));
  moModal(dangSua ? 'Sửa yêu cầu' : 'Tạo yêu cầu khảo sát', 'DL_YEUCAU', fields, record, { themLoaiQt: !dangSua });
}

async function formKhaoSat(record) {
  // Đảm bảo có cache danh sách yêu cầu cho dropdown ma_yeu_cau
  if (!CACHE_YEUCAU) { try { CACHE_YEUCAU = await Api.list('DL_YEUCAU', {}); } catch (e) { CACHE_YEUCAU = []; } }
  const loai = record ? record.loai_qt : 'MUA_TN';
  const fields = truongCua('DL_KHAOSAT_NCC', loai);
  const rec = record || (LOC_YEUCAU ? { ma_yeu_cau: LOC_YEUCAU } : {});
  moModal(record ? 'Sửa đánh giá NCC' : 'Thêm NCC khảo sát', 'DL_KHAOSAT_NCC', fields, rec, {});
}

// Mở modal + dựng form động
function moModal(tieu, loai_tab, fields, record, opts) {
  record = record || {};
  opts = opts || {};
  document.getElementById('modalTitle').textContent = tieu;
  const form = document.getElementById('dynForm');
  form.innerHTML = '';
  document.getElementById('formMsg').textContent = '';

  // Trường chọn loại quy trình (cho DL_YEUCAU khi tạo mới)
  if (opts.themLoaiQt) {
    const sel = el('select', { id: 'f_loai_qt', class: 'inp' },
      BOOT.quytrinh.map(q => el('option', { value: q.ma_qt }, [q.ten_qt])));
    form.appendChild(nhomTruong('Loại quy trình', sel));
  }

  fields.forEach(t => {
    const inp = dungInput(t, record[t.ma_truong]);
    form.appendChild(nhomTruong(t.nhan + (String(t.bat_buoc).toUpperCase() === 'TRUE' ? ' *' : ''), inp, t.ghi_chu));
  });

  // Nút lưu
  const btn = document.getElementById('btnSave');
  btn.onclick = () => luuForm(loai_tab, fields, record, opts);
  document.getElementById('modal').classList.remove('hidden');
}

function nhomTruong(nhan, inp, ghichu) {
  const wrap = el('div', { class: 'frow' }, [el('label', {}, [nhan])]);
  wrap.appendChild(inp);
  if (ghichu) wrap.appendChild(el('div', { class: 'hint' }, [ghichu]));
  return wrap;
}

// Tạo input theo kiểu trường
function dungInput(t, giaTri) {
  const id = 'f_' + t.ma_truong;
  const kieu = String(t.kieu || 'text');
  if (kieu === 'dropdown') {
    const opts = optionsCho(t);
    const sel = el('select', { id, class: 'inp' }, [el('option', { value: '' }, ['— chọn —'])]);
    opts.forEach(o => {
      const op = el('option', { value: o.value }, [o.label]);
      if (String(giaTri) === String(o.value)) op.selected = true;
      sel.appendChild(op);
    });
    return sel;
  }
  if (kieu === 'checkbox') {
    const cb = el('input', { id, type: 'checkbox', class: 'chk' });
    if (giaTri === true || String(giaTri).toUpperCase() === 'TRUE') cb.checked = true;
    return cb;
  }
  const type = (kieu === 'date') ? 'date' : (kieu === 'number') ? 'number' : 'text';
  const inp = el('input', { id, type, class: 'inp' });
  if (giaTri !== undefined && giaTri !== null) inp.value = giaTri;
  if (kieu === 'file') inp.placeholder = 'Dán link Drive (ảnh/PDF)';
  return inp;
}

// Lấy danh sách option cho 1 trường dropdown
function optionsCho(t) {
  const ma = t.ma_truong;
  if (!t.nguon_dropdown && LIST_CUNG[ma]) return LIST_CUNG[ma].map(x => ({ value: x, label: x }));
  if (t.nguon_dropdown === 'DL_YEUCAU') {
    return (CACHE_YEUCAU || []).map(y => ({ value: y.ma_yeu_cau, label: y.ma_yeu_cau + ' · ' + (y.bp_yeu_cau || '') }));
  }
  const key = MAP_MASTER[t.nguon_dropdown];
  if (key && BOOT.master[key]) {
    return BOOT.master[key].map(o => ({ value: o.ma, label: o.ma + (o.ten && o.ten !== o.ma ? ' · ' + o.ten : '') }));
  }
  // Không có nguồn master: lấy lựa chọn từ ghi_chu dạng "A/B/C".
  if (!t.nguon_dropdown && t.ghi_chu && t.ghi_chu.indexOf('/') >= 0) {
    return t.ghi_chu.split('/').map(s => s.trim()).filter(Boolean).map(x => ({ value: x, label: x }));
  }
  return [];
}

// Thu thập giá trị form -> record và lưu
async function luuForm(loai_tab, fields, recordCu, opts) {
  const pk = pkCua(loai_tab);
  // Bắt đầu từ bản ghi cũ / giá trị preset (ma_don, id_dong_hang, loai_qt…) để không mất khi lưu.
  const rec = Object.assign({}, recordCu);
  delete rec._row;

  if (opts.themLoaiQt) {
    const s = document.getElementById('f_loai_qt');
    if (s) rec.loai_qt = s.value;
  }

  let thieu = [];
  fields.forEach(t => {
    const e = document.getElementById('f_' + t.ma_truong);
    if (!e) return;
    let v = (t.kieu === 'checkbox') ? e.checked : e.value;
    if (String(t.bat_buoc).toUpperCase() === 'TRUE' && (v === '' || v === null || v === undefined)) {
      thieu.push(t.nhan);
    }
    rec[t.ma_truong] = v;
  });

  if (thieu.length) { document.getElementById('formMsg').textContent = 'Thiếu: ' + thieu.join(', '); return; }

  const mode = recordCu[pk] ? 'update' : 'create';
  try {
    document.getElementById('btnSave').disabled = true;
    if (opts.saveFn) await opts.saveFn(rec, mode);   // lưu tuỳ biến (vd USERS)
    else await Api.save(loai_tab, rec, mode);
    toast('Đã lưu.');
    dongModal();
    moView(VIEW); // refresh
  } catch (e) {
    document.getElementById('formMsg').textContent = e.message;
  } finally {
    document.getElementById('btnSave').disabled = false;
  }
}

function dongModal() { document.getElementById('modal').classList.add('hidden'); }
