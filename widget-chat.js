/**
 * widget-chat.js — TAB "TRỢ LÝ AI" trong widget (RAG/Chat trên HDSD, Gemini)
 * ------------------------------------------------------------------
 * Gắn vào widget.js qua window.WidgetChat = { render(body) }.
 * Khi tồn tại, widget.js tự hiện thêm tab "🤖 Trợ lý AI".
 *
 * Gửi kèm VIEW (màn đang xem) + lịch sử hội thoại tới action 'chat'.
 * Backend truy hồi HDSD theo embedding + trả lời + nguồn trích.
 */
window.WidgetChat = (function () {
  // Lịch sử hội thoại trong phiên (không lưu server). [{vai_tro:'u'|'a', noi_dung}]
  let lichSu = [];
  let dangGui = false;

  function manHienTai() { return (typeof VIEW !== 'undefined') ? VIEW : ''; }

  function render(body) {
    body.innerHTML = '';
    const wrap = el('div', { class: 'wg-chat' });

    const log = el('div', { class: 'wg-chat-log', id: 'wgChatLog' });
    wrap.appendChild(log);

    // Ô nhập + gửi.
    const inp = el('textarea', { class: 'wg-inp wg-area', placeholder: 'Hỏi về cách dùng phần mềm… (vd: làm sao tạo đơn mua?)' });
    inp.style.minHeight = '46px';
    const send = el('button', { class: 'wg-new', onclick: () => gui(inp) }, ['Gửi']);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui(inp); }
    });
    wrap.appendChild(el('div', { class: 'wg-foot' }, [inp, send]));
    body.appendChild(wrap);

    veLai(log);
    if (!lichSu.length) {
      log.appendChild(el('div', { class: 'wg-msg a' }, [
        'Xin chào! Tôi là trợ lý hướng dẫn dùng phần mềm Thu Mua DEGO. ' +
        'Bạn hỏi bất cứ điều gì về thao tác trên các màn — tôi trả lời dựa trên tài liệu hướng dẫn.'
      ]));
    }
  }

  // Vẽ lại toàn bộ lịch sử vào log.
  function veLai(log) {
    log.innerHTML = '';
    lichSu.forEach(m => {
      const div = el('div', { class: 'wg-msg ' + (m.vai_tro === 'u' ? 'u' : 'a') }, [m.noi_dung]);
      log.appendChild(div);
      if (m.nguon && m.nguon.length) {
        const src = el('div', { class: 'wg-src wg-muted' }, ['Nguồn: ']);
        m.nguon.forEach((s, i) => {
          src.appendChild(el('span', {}, [(i ? ' · ' : '') + (s.heading || s.file)]));
        });
        log.appendChild(src);
      }
    });
    log.scrollTop = log.scrollHeight;
  }

  async function gui(inp) {
    const q = inp.value.trim();
    if (!q || dangGui) return;
    dangGui = true;
    inp.value = '';
    lichSu.push({ vai_tro: 'u', noi_dung: q });
    const log = document.getElementById('wgChatLog');
    veLai(log);
    const dangSoan = el('div', { class: 'wg-msg a wg-muted' }, ['Đang soạn…']);
    log.appendChild(dangSoan); log.scrollTop = log.scrollHeight;

    try {
      // Gửi lịch sử TRƯỚC câu hỏi hiện tại (backend tự thêm câu hỏi vào cuối).
      const ls = lichSu.slice(0, -1).map(m => ({ vai_tro: m.vai_tro, noi_dung: m.noi_dung }));
      const d = await Api.goi('chat', { query: q, man_hinh: manHienTai(), lich_su: ls });
      lichSu.push({ vai_tro: 'a', noi_dung: d.answer || '(không có trả lời)', nguon: d.nguon || [] });
    } catch (e) {
      lichSu.push({ vai_tro: 'a', noi_dung: '⚠ ' + e.message, nguon: [] });
    } finally {
      dangGui = false;
      veLai(document.getElementById('wgChatLog'));
    }
  }

  return { render: render };
})();
