/**
 * widget.js — WIDGET HỖ TRỢ (góc phải dưới): tab Ticket [+ tab Trợ lý AI ở pha B]
 * ------------------------------------------------------------------
 * Nút tròn 💬 luôn nổi sau khi đăng nhập. Bấm mở panel có các TAB:
 *   - "Phản hồi" (Ticket): danh sách + tạo + chi tiết (bình luận, đổi trạng thái cho admin).
 *   - "Trợ lý AI" (Chat RAG): bổ sung ở pha B (đã chừa khung sẵn).
 *
 * Dùng lại tiện ích toàn cục của app.js: el(), toast(), Api, AppAuth, VIEW, BOOT.
 */
const Widget = (function () {
  let panelMo = false;     // panel đang mở?
  let tabHienTai = 'ticket';
  let locCuaToi = false;   // bộ lọc "Của tôi"
  let ticketDangXem = null; // id ticket đang mở chi tiết (null = danh sách)

  const TICKET_LOAI = ['Lỗi', 'Đề xuất', 'Câu hỏi'];
  const TICKET_TRANG_THAI = ['Mới', 'Đã tiếp nhận', 'Từ chối', 'Đang xử lý', 'Đã xong'];

  // Nhãn thân thiện cho mã màn hình (VIEW) — đính kèm ticket để biết user đang ở đâu.
  const TEN_MAN = {
    yeucau: 'Yêu cầu', khaosat: 'Đánh giá NCC', duyet: 'Duyệt', donmua: 'Đơn mua',
    vanchuyen: 'Vận chuyển', chi: 'Chi NCC', congno: 'Công nợ', tonkho: 'Tồn kho',
    dutru: 'Dự trù', suco: 'Sự cố', hopdong: 'Hợp đồng', dieuphoi: 'Điều phối',
    dashboard: 'Dashboard', nguoidung: 'Người dùng'
  };
  function tenMan(v) { return TEN_MAN[v] || v || ''; }
  function manHienTai() { return (typeof VIEW !== 'undefined') ? VIEW : ''; }
  function laAdmin() {
    const u = (typeof BOOT !== 'undefined' && BOOT && BOOT.user) ? BOOT.user : {};
    return u.vai_tro === 'QLTM' || u.vai_tro === 'Admin' || u.toan_doi;
  }

  // ===== Khởi tạo DOM (1 lần) =====
  function dung() {
    if (document.getElementById('wgBtn')) return;
    const btn = el('button', { id: 'wgBtn', class: 'wg-btn', title: 'Hỗ trợ & phản hồi',
      onclick: toggle }, ['💬']);
    const panel = el('div', { id: 'wgPanel', class: 'wg-panel hidden' });
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  function onLogin() { dung(); document.getElementById('wgBtn').classList.remove('hidden'); }

  function toggle() {
    panelMo = !panelMo;
    const p = document.getElementById('wgPanel');
    p.classList.toggle('hidden', !panelMo);
    if (panelMo) render();
  }

  // ===== Khung panel + tab =====
  function render() {
    const p = document.getElementById('wgPanel');
    p.innerHTML = '';
    // Đầu panel: các tab + nút đóng.
    const head = el('div', { class: 'wg-head' });
    const tabs = el('div', { class: 'wg-tabs' });
    const dsTab = [{ id: 'ticket', label: '📨 Phản hồi' }];
    if (window.WidgetChat) dsTab.push({ id: 'chat', label: '🤖 Trợ lý AI' }); // bật ở pha B
    dsTab.forEach(t => tabs.appendChild(el('button', {
      class: 'wg-tab' + (tabHienTai === t.id ? ' active' : ''),
      onclick: () => { tabHienTai = t.id; render(); }
    }, [t.label])));
    head.appendChild(tabs);
    head.appendChild(el('button', { class: 'wg-x', onclick: toggle }, ['✕']));
    p.appendChild(head);

    const body = el('div', { class: 'wg-body', id: 'wgBody' });
    p.appendChild(body);

    if (tabHienTai === 'chat' && window.WidgetChat) { window.WidgetChat.render(body); return; }
    renderTicket(body);
  }

  // ===== TAB TICKET =====
  function renderTicket(body) {
    body.innerHTML = '';
    if (ticketDangXem) { renderChiTiet(body, ticketDangXem); return; }

    // Thanh công cụ: lọc + nút tạo.
    const bar = el('div', { class: 'wg-bar' });
    const fAll = el('button', { class: 'wg-chip' + (!locCuaToi ? ' active' : ''),
      onclick: () => { locCuaToi = false; renderTicket(body); } }, ['Tất cả']);
    const fMine = el('button', { class: 'wg-chip' + (locCuaToi ? ' active' : ''),
      onclick: () => { locCuaToi = true; renderTicket(body); } }, ['Của tôi']);
    bar.appendChild(fAll); bar.appendChild(fMine);
    bar.appendChild(el('button', { class: 'wg-new', onclick: () => formTao(body) }, ['+ Tạo phản hồi']));
    body.appendChild(bar);

    const holder = el('div', { class: 'wg-list' }); body.appendChild(holder);
    holder.appendChild(el('div', { class: 'wg-muted' }, ['Đang tải…']));
    Api.goi('ticket.list', { cua_toi: locCuaToi }).then(rows => {
      holder.innerHTML = '';
      if (!rows.length) { holder.appendChild(el('div', { class: 'wg-muted' }, ['Chưa có phản hồi nào.'])); return; }
      rows.forEach(r => holder.appendChild(dongTicket(r, body)));
    }).catch(e => { holder.innerHTML = ''; holder.appendChild(el('div', { class: 'wg-err' }, [e.message])); });
  }

  function dongTicket(r, body) {
    const meta = el('div', { class: 'wg-tk-meta' }, [
      el('span', { class: 'wg-tag wg-loai-' + maLoai(r.loai) }, [r.loai || '']),
      el('span', { class: 'wg-badge ' + classTT(r.trang_thai) }, [r.trang_thai || 'Mới']),
      el('span', { class: 'wg-muted' }, [(r.so_cmt ? ('💬 ' + r.so_cmt + ' · ') : '') + nhanThoiGian(r.thoi_gian_tao)])
    ]);
    return el('div', { class: 'wg-tk', onclick: () => { ticketDangXem = r.id; renderTicket(body); } }, [
      el('div', { class: 'wg-tk-title' }, [r.tieu_de || '(không tiêu đề)']),
      meta,
      el('div', { class: 'wg-muted wg-sm' }, [r.nguoi_gui + (r.man_hinh ? (' · màn ' + tenMan(r.man_hinh)) : '')])
    ]);
  }

  // ===== FORM TẠO TICKET =====
  function formTao(body) {
    body.innerHTML = '';
    body.appendChild(el('button', { class: 'wg-back', onclick: () => renderTicket(body) }, ['◂ Danh sách']));
    body.appendChild(el('h4', { class: 'wg-h' }, ['Tạo phản hồi mới']));

    const selLoai = el('select', { class: 'wg-inp' }, TICKET_LOAI.map(x => el('option', { value: x }, [x])));
    const inpTieu = el('input', { class: 'wg-inp', placeholder: 'Tiêu đề ngắn gọn *' });
    const inpMo = el('textarea', { class: 'wg-inp wg-area', placeholder: 'Mô tả chi tiết (các bước, kỳ vọng…)' });
    body.appendChild(nhom('Loại', selLoai));
    body.appendChild(nhom('Tiêu đề', inpTieu));
    body.appendChild(nhom('Mô tả', inpMo));
    body.appendChild(el('div', { class: 'wg-muted wg-sm' }, ['Tự đính kèm màn đang xem: ' + (tenMan(manHienTai()) || '—')]));

    const msg = el('div', { class: 'wg-err' });
    const btn = el('button', { class: 'wg-new', onclick: async () => {
      if (!inpTieu.value.trim()) { msg.textContent = 'Thiếu tiêu đề.'; return; }
      btn.disabled = true;
      try {
        await Api.goi('ticket.create', {
          loai: selLoai.value, tieu_de: inpTieu.value, mo_ta: inpMo.value, man_hinh: manHienTai()
        });
        toast('Đã gửi phản hồi.');
        renderTicket(body);
      } catch (e) { msg.textContent = e.message; btn.disabled = false; }
    } }, ['Gửi']);
    body.appendChild(el('div', { class: 'wg-foot' }, [btn, msg]));
  }

  // ===== CHI TIẾT TICKET + BÌNH LUẬN =====
  function renderChiTiet(body, id) {
    body.innerHTML = '';
    body.appendChild(el('button', { class: 'wg-back', onclick: () => { ticketDangXem = null; renderTicket(body); } }, ['◂ Danh sách']));
    const holder = el('div'); body.appendChild(holder);
    holder.appendChild(el('div', { class: 'wg-muted' }, ['Đang tải…']));
    Api.goi('ticket.get', { id: id }).then(d => {
      holder.innerHTML = '';
      const tk = d.ticket;
      holder.appendChild(el('div', { class: 'wg-tk-meta' }, [
        el('span', { class: 'wg-tag wg-loai-' + maLoai(tk.loai) }, [tk.loai || '']),
        el('span', { class: 'wg-badge ' + classTT(tk.trang_thai) }, [tk.trang_thai || 'Mới'])
      ]));
      holder.appendChild(el('h4', { class: 'wg-h' }, [tk.tieu_de || '']));
      if (tk.mo_ta) holder.appendChild(el('div', { class: 'wg-mo' }, [tk.mo_ta]));
      holder.appendChild(el('div', { class: 'wg-muted wg-sm' }, [
        'Gửi bởi ' + tk.nguoi_gui + ' · ' + nhanThoiGian(tk.thoi_gian_tao) +
        (tk.man_hinh ? (' · màn ' + tenMan(tk.man_hinh)) : '') +
        (tk.nguoi_xu_ly ? (' · xử lý: ' + tk.nguoi_xu_ly) : '')
      ]));

      // Nút đổi trạng thái (chỉ admin/QLTM).
      if (laAdmin()) {
        const tt = el('div', { class: 'wg-bar wg-wrap' });
        TICKET_TRANG_THAI.forEach(s => tt.appendChild(el('button', {
          class: 'wg-chip' + (tk.trang_thai === s ? ' active' : ''),
          onclick: async () => {
            try { await Api.goi('ticket.setStatus', { ticket_id: id, trang_thai: s }); toast('Đã đổi: ' + s); renderChiTiet(body, id); }
            catch (e) { toast(e.message, true); }
          }
        }, [s])));
        holder.appendChild(el('div', { class: 'wg-muted wg-sm' }, ['Đổi trạng thái:']));
        holder.appendChild(tt);
      }

      // Luồng bình luận.
      holder.appendChild(el('h5', { class: 'wg-h5' }, ['Trao đổi (' + d.binh_luan.length + ')']));
      const luong = el('div', { class: 'wg-cmts' });
      d.binh_luan.forEach(c => luong.appendChild(el('div', { class: 'wg-cmt' + (c.noi_dung.indexOf('[Hệ thống]') === 0 ? ' wg-sys' : '') }, [
        el('div', { class: 'wg-muted wg-sm' }, [c.nguoi + ' · ' + nhanThoiGian(c.thoi_gian)]),
        el('div', {}, [c.noi_dung])
      ])));
      if (!d.binh_luan.length) luong.appendChild(el('div', { class: 'wg-muted' }, ['Chưa có trao đổi.']));
      holder.appendChild(luong);

      // Ô nhập bình luận.
      const inp = el('textarea', { class: 'wg-inp wg-area', placeholder: 'Viết trao đổi…' });
      const send = el('button', { class: 'wg-new', onclick: async () => {
        if (!inp.value.trim()) return;
        send.disabled = true;
        try { await Api.goi('ticket.comment', { ticket_id: id, noi_dung: inp.value }); renderChiTiet(body, id); }
        catch (e) { toast(e.message, true); send.disabled = false; }
      } }, ['Gửi']);
      holder.appendChild(el('div', { class: 'wg-foot' }, [inp, send]));
    }).catch(e => { holder.innerHTML = ''; holder.appendChild(el('div', { class: 'wg-err' }, [e.message])); });
  }

  // ===== Tiện ích nhỏ =====
  function nhom(nhan, inp) { return el('div', { class: 'wg-frow' }, [el('label', {}, [nhan]), inp]); }
  function maLoai(l) { return l === 'Lỗi' ? 'loi' : l === 'Đề xuất' ? 'dx' : 'hoi'; }
  function classTT(tt) {
    if (tt === 'Đã xong') return 'ok';
    if (tt === 'Từ chối') return 'no';
    if (tt === 'Đang xử lý' || tt === 'Đã tiếp nhận') return 'wip';
    return 'new';
  }
  function nhanThoiGian(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    return m ? (m[3] + '/' + m[2] + ' ' + m[4] + ':' + m[5]) : String(s || '');
  }

  return { onLogin: onLogin };
})();
