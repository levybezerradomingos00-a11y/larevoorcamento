(() => {
  'use strict';
  const form = document.getElementById('proposalForm');
  const nameInput = document.getElementById('clientName');
  const setupInput = document.getElementById('setupPrice');
  const houseInput = document.getElementById('housePrice');
  const pdfButton = document.getElementById('pdfButton');
  const status = document.getElementById('editStatus');
  const fields = [nameInput, setupInput, houseInput];
  const integers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const decimals = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let busy = false;

  function parsePrice(value) {
    const raw = value.trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(raw)) return null;
    const parts = raw.replace(/\./g, '').split(',');
    const cents = Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents >= 0 && cents <= 9999999999 ? cents : null;
  }
  function displayPrice(cents) {
    return cents === null ? '—' : (cents % 100 === 0 ? integers : decimals).format(cents / 100);
  }
  function filename() {
    const name = nameInput.value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() || 'Cliente';
    return `LAREVO HOME - Proposta - ${name}`;
  }
  function message(text, tone = 'error') {
    status.textContent = text;
    status.dataset.tone = tone;
  }
  function update() {
    const name = nameInput.value.trim();
    const setup = parsePrice(setupInput.value), house = parsePrice(houseInput.value);
    nameInput.setCustomValidity(name ? '' : 'Informe o nome do cliente.');
    setupInput.setCustomValidity(setup === null ? 'Informe um valor válido, como 3.000,00.' : '');
    houseInput.setCustomValidity(house === null ? 'Informe um valor válido, como 2.000,00.' : '');
    fields.forEach(input => input.setAttribute('aria-invalid', input.validity.valid ? 'false' : 'true'));
    const amounts = { setup, house, total: setup === null || house === null ? null : setup + house };
    document.querySelectorAll('[data-client]').forEach(el => { el.textContent = name || 'Cliente'; });
    document.querySelectorAll('[data-amount]').forEach(el => {
      const label = displayPrice(amounts[el.dataset.amount]);
      el.textContent = label;
      el.closest('.money, .fee strong, .smallprice')?.classList.toggle('wide-price', label.length > 8);
    });
    const valid = !!name && setup !== null && house !== null;
    pdfButton.disabled = !valid || busy;
    if (!busy) message(valid ? '' : 'Preencha o nome e os dois valores. Use vírgula para os centavos: 3.000,00.');
    document.title = filename();
    return valid;
  }
  function setBusy(value) {
    busy = value;
    fields.forEach(field => { field.disabled = value; });
    form.setAttribute('aria-busy', String(value));
    pdfButton.textContent = value ? 'Gerando PDF…' : 'Baixar PDF';
    update();
  }

  async function exportDocument() {
    const styles = window.LarevoStyles;
    if (!styles?.screen || !styles?.print) throw new Error('Os estilos de exportação não carregaram. Recarregue a página.');
    const frame = document.createElement('iframe');
    frame.title = 'Preparação do PDF';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1400px;height:1000px;border:0;pointer-events:none;';
    const loaded = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = () => reject(new Error('Não foi possível preparar as páginas.'));
    });
    // Only our prepared styles enter the PDF, never styles injected by a preview or extension.
    const head = document.createElement('head');
    const charset = document.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    head.append(charset);
    const base = document.createElement('base');
    base.href = document.baseURI;
    head.prepend(base);
    const style = document.createElement('style');
    style.textContent = `${styles.screen}\n${styles.print}`;
    head.append(style);
    frame.srcdoc = `<!doctype html><html lang="pt-BR">${head.outerHTML}<body>${document.querySelector('main').outerHTML}</body></html>`;
    document.body.append(frame);
    try {
      await loaded;
      await frame.contentDocument.fonts.ready;
      await new Promise(resolve => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
      return { frame, pages: Array.from(frame.contentDocument.querySelectorAll('.page')) };
    } catch (error) { frame.remove(); throw error; }
  }
  async function downloadPdf() {
    if (busy || !update() || !form.reportValidity()) return;
    setBusy(true);
    let frame;
    let success = false;
    try {
      if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error('As bibliotecas de PDF não carregaram. Recarregue a página.');
      message('Preparando as três páginas…', 'info');
      const prepared = await exportDocument();
      frame = prepared.frame;
      if (prepared.pages.length !== 3) throw new Error('A proposta deve ter três páginas.');
      const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      pdf.setProperties({ title: filename(), author: 'LAREVO HOME', subject: 'Pacote Construtora', creator: 'LAREVO HOME' });
      for (const [index, page] of prepared.pages.entries()) {
        message(`Gerando página ${index + 1} de 3…`, 'info');
        const canvas = await window.html2canvas(page, {
          scale: 2.5, backgroundColor: null, logging: false,
          windowWidth: 1400, windowHeight: 1000, scrollX: 0, scrollY: 0
        });
        if (index) pdf.addPage('a4', 'landscape');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 297, 210);
        canvas.width = canvas.height = 0;
      }
      await pdf.save(`${filename()}.pdf`, { returnPromise: true });
      success = true;
    } catch (error) {
      console.error('Falha ao gerar PDF:', error);
      setBusy(false);
      message(`Não foi possível baixar o PDF. ${error.message || 'Recarregue a página e tente novamente.'}`);
    } finally {
      frame?.remove();
      if (busy) setBusy(false);
      if (success) message('PDF gerado. Confira o arquivo nos downloads do navegador.', 'info');
    }
  }

  fields.forEach(input => input.addEventListener('input', update));
  [setupInput, houseInput].forEach(input => input.addEventListener('blur', () => {
    const cents = parsePrice(input.value);
    if (cents !== null) input.value = decimals.format(cents / 100);
    update();
  }));
  form.addEventListener('submit', event => { event.preventDefault(); downloadPdf(); });
  update();
})();
