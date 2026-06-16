/**
 * hdsd.js — MÀN "📖 Hướng dẫn" (đọc HDSD ngay trong web)
 * ------------------------------------------------------------------
 * Dữ liệu HDSD đóng gói sẵn ở window.HDSD (sinh bởi migration/build_hdsd_data.py).
 * Render markdown bằng thư viện `marked` (nạp qua CDN ở index.html).
 * Bố cục 2 cột: mục lục trái (cây trang) + nội dung phải. Link .md giữa các trang
 * được bắt lại để chuyển trang NGAY trong màn (không rời app).
 *
 * app.js gọi: window.HDSDView.render(). Menu "📖 Hướng dẫn" hiện cho MỌI vai trò.
 */
window.HDSDView = (function () {
  let trangHienTai = 'index.md';

  // Nhãn ngắn cho mục lục (bỏ tiền tố số để gọn), giữ thứ tự window.HDSD.order.
  function nhanMuc(file, title) {
    if (file === 'index.md') return '🗂 Mục lục';
    if (file === '00_bat_dau.md') return '▶ Bắt đầu';
    // "04 — Đơn mua · Dòng hàng · Nhận hàng" -> "04 · Đơn mua…"
    const m = title.match(/^(\d{2})\s*—\s*(.+)$/);
    if (m) { let t = m[2].split('·')[0].split('(')[0].trim(); return m[1] + ' · ' + t; }
    return title;
  }

  function render() {
    const c = document.getElementById('content');
    c.innerHTML = '';
    if (!window.HDSD || !window.HDSD.order) {
      c.appendChild(el('p', { class: 'err' }, ['Chưa nạp được dữ liệu HDSD (hdsd-data.js).']));
      return;
    }
    const wrap = el('div', { class: 'hdsd-wrap' });
    const muc = el('div', { class: 'hdsd-toc' });
    const noi = el('div', { class: 'hdsd-content', id: 'hdsdContent' });

    window.HDSD.order.forEach(f => {
      const p = window.HDSD.pages[f];
      muc.appendChild(el('button', {
        class: 'hdsd-link' + (f === trangHienTai ? ' active' : ''),
        onclick: () => { trangHienTai = f; veNoiDung(noi, muc); }
      }, [nhanMuc(f, p.title)]));
    });

    wrap.appendChild(muc);
    wrap.appendChild(noi);
    c.appendChild(wrap);
    veNoiDung(noi, muc);
  }

  function veNoiDung(noi, muc) {
    const p = window.HDSD.pages[trangHienTai];
    if (!p) { noi.innerHTML = '<p class="muted">Không tìm thấy trang.</p>'; return; }
    // Render markdown (marked). Nếu thiếu marked, hiển thị text thô.
    if (window.marked && marked.parse) {
      noi.innerHTML = marked.parse(p.md);
    } else {
      noi.innerHTML = '';
      noi.appendChild(el('pre', { class: 'hdsd-raw' }, [p.md]));
    }
    // Cập nhật trạng thái active ở mục lục.
    if (muc) Array.from(muc.querySelectorAll('.hdsd-link')).forEach((b, i) => {
      b.classList.toggle('active', window.HDSD.order[i] === trangHienTai);
    });
    // Bắt link nội bộ *.md -> chuyển trang trong màn.
    Array.from(noi.querySelectorAll('a[href]')).forEach(a => {
      const href = a.getAttribute('href') || '';
      const m = href.match(/([^\/]+\.md)(#.*)?$/);
      if (m && window.HDSD.pages[m[1]]) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          trangHienTai = m[1];
          veNoiDung(noi, muc);
          noi.scrollTop = 0;
        });
      } else if (/^https?:/.test(href)) {
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      } else {
        // Link tới file ngoài cây (vd ../04_HDSD.md) — vô hiệu hoá để khỏi lạc.
        a.addEventListener('click', (e) => e.preventDefault());
        a.classList.add('hdsd-dead');
      }
    });
    noi.scrollTop = 0;
  }

  return { render: render };
})();
