/* DuoPay · Sandbox learning prototype. No secrets or persistent storage. */
(() => {
  'use strict';
  const MAX_TOTAL = 99999999;
  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  function toCents(value) {
    const text = String(value ?? '').trim();
    if (text === '') return 0;
    if (!/^\d{1,7}(?:\.\d{0,2})?$/.test(text)) return NaN;
    const [whole, decimal = ''] = text.split('.');
    const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    return Number.isSafeInteger(result) && result <= MAX_TOTAL ? result : NaN;
  }
  function allocate(total, weights) {
    if (!Number.isSafeInteger(total) || total < 0 || !weights.length || weights.some(w => !Number.isSafeInteger(w) || w < 0)) throw new Error('Invalid allocation');
    let safeWeights = weights;
    if (!weights.some(Boolean)) safeWeights = weights.map(() => 1);
    const denominator = safeWeights.reduce((sum, w) => sum + BigInt(w), 0n);
    const parts = safeWeights.map((w, index) => {
      const numerator = BigInt(total) * BigInt(w);
      return { index, cents: Number(numerator / denominator), remainder: numerator % denominator };
    });
    let remaining = total - parts.reduce((sum, p) => sum + p.cents, 0);
    [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1).forEach(part => { if (remaining > 0) { parts[part.index].cents++; remaining--; } });
    return parts.map(part => part.cents);
  }
  function calculate(items, people, tax, tip, mode = 'item') {
    const errors = [];
    if (!people.length) errors.push('Add at least one person.');
    if (!items.length) errors.push('Add at least one item.');
    if (items.length > 50) errors.push('This prototype supports up to 50 items.');
    if (![tax, tip].every(n => Number.isSafeInteger(n) && n >= 0)) errors.push('Enter valid tax and tip amounts with at most two decimal places.');
    for (const [index, item] of items.entries()) {
      if (!item.name.trim()) errors.push(`Give item ${index + 1} a name.`);
      if (!Number.isSafeInteger(item.cents) || item.cents <= 0) errors.push(`Enter a positive amount for item ${index + 1}.`);
      if (mode === 'item' && !item.members.some(id => people.some(p => p.id === id))) errors.push(`Assign ${item.name || `item ${index + 1}`} to at least one person.`);
    }
    if (errors.length) return { valid: false, errors };
    const subtotal = items.reduce((sum, item) => sum + item.cents, 0);
    const total = subtotal + tax + tip;
    if (total > MAX_TOTAL) return { valid: false, errors: ['Keep the bill below $1,000,000.00.'] };
    let bases = people.map(() => 0);
    if (mode === 'equal') bases = allocate(subtotal, people.map(() => 1));
    else items.forEach(item => {
      const parts = allocate(item.cents, people.map(person => item.members.includes(person.id) ? 1 : 0));
      bases = bases.map((base, i) => base + parts[i]);
    });
    const taxes = allocate(tax, bases);
    const tips = allocate(tip, bases);
    const shares = people.map((person, i) => ({ id: person.id, base: bases[i], tax: taxes[i], tip: tips[i], total: bases[i] + taxes[i] + tips[i] }));
    return { valid: true, subtotal, tax, tip, total, shares, errors: [] };
  }
  function parseReceipt(text) {
    const result = { items: [], tax: 0, tip: 0, printedSubtotal: null, printedTotal: null };
    String(text).split(/\r?\n/).forEach(raw => {
      const line = raw.trim().replace(/[|]/g, ' ').replace(/\s+/g, ' ');
      const match = line.match(/^(.+?)\s+\$?\s*(\d[\d,]*[.,]\d{2})\s*$/);
      if (!match) return;
      const name = match[1].replace(/\s*\$\s*$/, '').trim();
      let amount = match[2];
      if (!amount.includes('.') && /,\d{2}$/.test(amount)) amount = amount.replace(',', '.');
      else amount = amount.replace(/,/g, '');
      const cents = toCents(amount);
      if (!Number.isFinite(cents)) return;
      if (/^(sub\s*-?\s*total)\b/i.test(name)) result.printedSubtotal = cents;
      else if (/^(sales\s+)?tax\b|^vat\b/i.test(name)) result.tax += cents;
      else if (/^(tip|gratuity|service(?:\s+charge)?)\b/i.test(name)) result.tip += cents;
      else if (/^(grand\s+)?total\b/i.test(name)) result.printedTotal = cents;
      else if (!/^(cash|change|balance|amount due|visa|mastercard|amex|card|paid|discount|savings|tender|payment)\b/i.test(name) && cents > 0 && result.items.length < 50) result.items.push({ name: name.slice(0, 100), cents });
    });
    return result;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { toCents, allocate, calculate, parseReceipt };
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const colors = ['#7563d8', '#36a98c', '#e49a58', '#559bd2', '#d775a0', '#a58b40', '#6b9e59', '#8a80a4'];
  const sampleText = 'Pasta Primavera 18.00\nGrilled Salmon 24.00\nMargherita Pizza 16.00\nLemonade (3) 12.00\nSubtotal 70.00\nTax 5.60\nTip 14.00\nTotal 89.60';
  const makeSample = () => ({
    people: [{ id: 'alex', name: 'Alex', color: colors[0] }, { id: 'maya', name: 'Maya', color: colors[1] }, { id: 'sam', name: 'Sam', color: colors[2] }],
    items: [{ id: 'i1', name: 'Pasta Primavera', cents: 1800, members: ['alex'] }, { id: 'i2', name: 'Grilled Salmon', cents: 2400, members: ['maya'] }, { id: 'i3', name: 'Margherita Pizza', cents: 1600, members: ['sam'] }, { id: 'i4', name: 'Lemonade (3)', cents: 1200, members: ['alex', 'maya', 'sam'] }],
    tax: 560, tip: 1400, mode: 'item', payer: 'alex', payments: {}, uncertain: {}, locked: false, inCheckout: false, checkout: null
  });
  const state = { ...makeSample(), clientId: 'sb', payActions: null, sdkGeneration: 0, ocrBusy: false, image: 'sample-receipt.png', objectUrl: null, worker: null };
  let calculated;
  let toastTimer;
  const icon = name => `<svg class="icon small" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
  function editable() { if (state.locked || state.inCheckout || state.ocrBusy) { toast(state.locked ? 'This bill is locked after a payment attempt. Export the record before leaving.' : 'Please finish the current scan or checkout first.'); return false; } return true; }
  function personName(person) { return person?.name?.trim() || 'Friend'; }
  function avatar(person) { return `<span class="person-avatar" style="--person-color:${person.color}">${escape(personName(person).charAt(0).toUpperCase())}</span>`; }
  function setEditLock() {
    const locked = state.locked || state.inCheckout || state.ocrBusy;
    document.body.classList.toggle('bill-locked', state.locked);
    ['choose-receipt', 'scan-receipt', 'parse-text', 'raw-receipt', 'bill-name', 'add-item', 'tax-amount', 'tip-amount', 'add-person', 'mode-item', 'mode-equal', 'reset-demo'].forEach(id => { $(id).disabled = locked; });
    document.querySelectorAll('.item-row input,.item-row button,.person-row input,.person-row button').forEach(el => { el.disabled = locked; });
    $('payer-select').disabled = state.inCheckout;
    document.querySelectorAll('.person-remove').forEach(button => { button.disabled = locked || state.people.length <= 2; });
    $('open-settings').disabled = state.inCheckout || state.locked;
    $('settings-inline').disabled = state.inCheckout || state.locked;
    syncPaymentEligibility();
  }
  function renderItems() {
    $('receipt-items').innerHTML = state.items.map((item, index) => `<div class="item-row" data-item="${item.id}"><input class="item-name" aria-label="Item ${index + 1} name" maxlength="100" value="${escape(item.name)}"><div class="item-price money-input"><span>$</span><input aria-label="Item ${index + 1} amount" type="number" min="0.01" max="999999.99" step="0.01" inputmode="decimal" value="${Number.isFinite(item.cents) ? (item.cents / 100).toFixed(2) : ''}"></div><div class="item-assignees" role="group" aria-label="Who shared ${escape(item.name)}">${state.people.map(person => `<button type="button" class="person-toggle ${item.members.includes(person.id) ? 'is-selected' : ''}" style="--person-color:${person.color}" data-person="${person.id}" aria-pressed="${item.members.includes(person.id)}">${escape(personName(person))}</button>`).join('')}</div><button class="icon-button remove-item" aria-label="Remove item ${index + 1}">${icon('close')}</button></div>`).join('');
    $('item-count').textContent = `${state.items.length} item${state.items.length === 1 ? '' : 's'}`;
    setEditLock();
  }
  function renderPeople() {
    $('people-list').innerHTML = state.people.map(person => `<div class="person-row" data-person="${person.id}">${avatar(person)}<input class="person-name" aria-label="Name of ${escape(personName(person))}" maxlength="24" value="${escape(person.name)}"><button class="icon-button person-remove" aria-label="Remove ${escape(personName(person))}" ${state.people.length <= 2 ? 'disabled' : ''}>${icon('close')}</button></div>`).join('');
    setEditLock();
    if (state.people.length <= 2) document.querySelectorAll('.person-remove').forEach(button => { button.disabled = true; });
  }
  function recalculate() {
    calculated = calculate(state.items, state.people, state.tax, state.tip, state.mode);
    $('summary-subtotal').textContent = calculated.valid ? money(calculated.subtotal) : '—';
    $('summary-extras').textContent = calculated.valid ? money(calculated.tax + calculated.tip) : '—';
    $('summary-total').textContent = calculated.valid ? money(calculated.total) : '—';
    $('validation-note').hidden = calculated.valid;
    $('validation-note').textContent = calculated.errors[0] || '';
    $('cent-check').innerHTML = calculated.valid ? `${icon('check')}Exactly ${money(calculated.total)}. Not a cent left behind.` : 'Review the highlighted bill details before checkout.';
    $('cent-check').classList.toggle('has-error', !calculated.valid);
    $('mode-item').classList.toggle('selected', state.mode === 'item');
    $('mode-equal').classList.toggle('selected', state.mode === 'equal');
    $('mode-item').setAttribute('aria-pressed', String(state.mode === 'item'));
    $('mode-equal').setAttribute('aria-pressed', String(state.mode === 'equal'));
    renderShares();
  }
  function renderShares() {
    $('share-list').innerHTML = state.people.map(person => {
      const share = calculated.valid ? calculated.shares.find(s => s.id === person.id) : null;
      const paid = state.payments[person.id];
      const uncertain = state.uncertain[person.id];
      return `<div class="share-row ${state.payer === person.id ? 'is-payer' : ''} ${paid ? 'is-paid' : ''}">${avatar(person)}<div class="share-person"><b>${escape(personName(person))}</b><small>${paid ? 'Captured in Sandbox' : uncertain ? 'Capture needs verification' : share ? `${money(share.base)} items + ${money(share.tax + share.tip)} extras` : 'Review bill details'}</small></div><div class="share-value"><strong>${share ? money(share.total) : '—'}</strong>${paid ? `<span class="paid-label">${icon('check')}Paid</span>` : ''}</div></div>`;
    }).join('');
    $('payer-select').innerHTML = state.people.map(person => `<option value="${person.id}" ${person.id === state.payer ? 'selected' : ''}>${escape(personName(person))}${state.payments[person.id] ? ' · paid' : state.uncertain[person.id] ? ' · check capture' : ''}</option>`).join('');
    updatePayer();
  }
  function updatePayer() {
    const person = state.people.find(p => p.id === state.payer) || state.people[0];
    if (!person) return;
    const share = calculated.valid ? calculated.shares.find(s => s.id === person.id) : null;
    $('payer-name').textContent = `${personName(person)}'s share`;
    $('payer-amount').textContent = share ? money(share.total) : '—';
    document.querySelectorAll('.share-row').forEach((row, i) => row.classList.toggle('is-payer', state.people[i].id === state.payer));
    if (state.payments[person.id]) paymentStatus(`Completed Sandbox capture · Order ${state.payments[person.id].orderId}`, 'success');
    else if (state.uncertain[person.id]) paymentStatus(`Capture not confirmed. Verify Sandbox order ${state.uncertain[person.id].orderId} before trying again.`, 'error');
    else if (state.payActions && !state.inCheckout) paymentStatus('Ready for a test payment. No real money will move.');
    syncPaymentEligibility();
  }
  function syncPaymentEligibility() {
    if (!state.payActions || !calculated) return;
    const share = calculated.valid && calculated.shares.find(s => s.id === state.payer);
    const enabled = share && share.total > 0 && !state.payments[state.payer] && !state.uncertain[state.payer] && !state.inCheckout && !state.ocrBusy;
    try { enabled ? state.payActions.enable() : state.payActions.disable(); } catch (_) { /* SDK can be mid-render. */ }
  }
  function paymentStatus(text, type = '') { $('payment-status').textContent = text; $('payment-status').className = `payment-status ${type}`; }
  async function loadPayPal() {
    const generation = ++state.sdkGeneration;
    state.payActions = null;
    $('paypal-buttons').replaceChildren();
    paymentStatus('Loading PayPal Sandbox…');
    document.querySelectorAll('script[data-duopay-sdk]').forEach(script => script.remove());
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.dataset.duopaySdk = 'true';
        script.setAttribute('data-namespace', 'duoPayPal');
        const params = new URLSearchParams({ 'client-id': state.clientId, currency: 'USD', intent: 'capture', components: 'buttons', 'disable-funding': 'card,credit,paylater', 'buyer-country': 'US' });
        script.src = `https://www.paypal.com/sdk/js?${params}`;
        const timeout = setTimeout(() => reject(new Error('SDK timeout')), 25000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => { clearTimeout(timeout); reject(new Error('SDK could not load')); };
        document.head.append(script);
      });
      if (generation !== state.sdkGeneration) return;
      const sdk = window.duoPayPal;
      if (!sdk || !sdk.Buttons) throw new Error('SDK unavailable');
      const buttons = sdk.Buttons({
        fundingSource: sdk.FUNDING.PAYPAL,
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 48, tagline: false },
        onInit(_data, actions) { state.payActions = actions; syncPaymentEligibility(); },
        onClick(_data, actions) {
          recalculate();
          const share = calculated.valid && calculated.shares.find(s => s.id === state.payer);
          if (!share || share.total <= 0 || state.payments[state.payer] || state.uncertain[state.payer] || state.inCheckout || state.ocrBusy) { toast('Review the split or select an unpaid person before checkout.'); return actions.reject(); }
          const person = state.people.find(p => p.id === state.payer);
          state.checkout = { personId: person.id, name: personName(person), cents: share.total, bill: $('bill-name').value, orderId: null, captureAttempted: false };
          return actions.resolve();
        },
        async createOrder(_data, actions) {
          const checkout = state.checkout;
          if (!checkout) throw new Error('No validated checkout');
          state.inCheckout = true;
          setEditLock();
          paymentStatus(`Creating Sandbox order for ${checkout.name}…`);
          try {
            const orderId = await actions.order.create({ intent: 'CAPTURE', purchase_units: [{ description: `DuoPay: ${checkout.bill} — ${checkout.name}`.slice(0, 127), custom_id: `duopay-${checkout.personId}-${Date.now()}`.slice(0, 127), amount: { currency_code: 'USD', value: (checkout.cents / 100).toFixed(2) } }], application_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' } });
            checkout.orderId = orderId;
            paymentStatus('Complete the test payment in the PayPal Sandbox window.');
            return orderId;
          } catch (error) { state.inCheckout = false; state.checkout = null; setEditLock(); paymentStatus('Could not create a Sandbox order. Check the Client ID and try again.', 'error'); throw error; }
        },
        async onApprove(data, actions) {
          const checkout = state.checkout;
          if (!checkout) { paymentStatus('No matching local checkout. Verify this order in your Sandbox account before retrying.', 'error'); return; }
          checkout.captureAttempted = true;
          paymentStatus('PayPal approved. Confirming the Sandbox capture…');
          try {
            const order = await actions.order.capture();
            const capture = order.purchase_units?.flatMap(unit => unit.payments?.captures || []).find(c => c.status === 'COMPLETED');
            const amountMatches = capture?.amount?.currency_code === 'USD' && toCents(capture.amount.value) === checkout.cents;
            if (order.status !== 'COMPLETED' || !capture || !amountMatches) throw new Error('Capture not confirmed');
            state.payments[checkout.personId] = { orderId: order.id || data.orderID, captureId: capture.id, cents: checkout.cents, status: 'COMPLETED', at: new Date().toISOString() };
            state.locked = true;
            state.inCheckout = false;
            state.checkout = null;
            recalculate();
            setEditLock();
            paymentStatus(`${checkout.name}'s ${money(checkout.cents)} share was captured in Sandbox. Order ${order.id || data.orderID}`, 'success');
            toast('Sandbox payment confirmed. The bill is now locked; other friends can settle their shares.');
          } catch (_) {
            state.uncertain[checkout.personId] = { orderId: checkout.orderId || data.orderID || 'unknown', cents: checkout.cents, status: 'UNCONFIRMED' };
            state.locked = true;
            state.inCheckout = false;
            state.checkout = null;
            recalculate();
            setEditLock();
            paymentStatus(`Capture not confirmed. Check Sandbox order ${checkout.orderId || data.orderID} before making another payment.`, 'error');
          }
        },
        onCancel() { state.inCheckout = false; state.checkout = null; setEditLock(); paymentStatus('Checkout cancelled. No payment has been marked paid.'); },
        onError() {
          const checkout = state.checkout;
          if (checkout?.captureAttempted) { state.uncertain[checkout.personId] = { orderId: checkout.orderId || 'unknown', cents: checkout.cents, status: 'UNCONFIRMED' }; state.locked = true; }
          state.inCheckout = false;
          state.checkout = null;
          recalculate();
          setEditLock();
          paymentStatus('PayPal returned an error. No payment is marked paid. If approval already happened, verify the Sandbox order before retrying.', 'error');
        }
      });
      await buttons.render('#paypal-buttons');
      if (generation === state.sdkGeneration) updatePayer();
    } catch (_) {
      if (generation !== state.sdkGeneration) return;
      paymentStatus('PayPal could not load. Check your connection, disable blocking extensions, or apply a valid Sandbox Client ID.', 'error');
      const retry = document.createElement('button');
      retry.className = 'button button-secondary'; retry.textContent = 'Retry PayPal Sandbox'; retry.addEventListener('click', loadPayPal);
      $('paypal-buttons').append(retry);
    }
  }
  function applyParsedReceipt(text, source, confidence) {
    const parsed = parseReceipt(text);
    if (!parsed.items.length) { $('scan-message').textContent = 'No item prices were recognized. Review the text below or add items manually.'; toast('No items found. Try a clearer image or paste receipt text.'); return false; }
    const normal = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const previous = new Map(state.items.map(item => [normal(item.name), item.members]));
    state.items = parsed.items.map((item, index) => ({ ...item, id: `scan-${Date.now()}-${index}`, members: previous.get(normal(item.name)) || state.people.map(p => p.id) }));
    state.tax = parsed.tax;
    state.tip = parsed.tip;
    $('tax-amount').value = (state.tax / 100).toFixed(2);
    $('tip-amount').value = (state.tip / 100).toFixed(2);
    $('raw-receipt').value = text;
    renderItems(); recalculate();
    const warnings = [];
    if (parsed.printedSubtotal !== null && calculated.valid && parsed.printedSubtotal !== calculated.subtotal) warnings.push('item subtotal does not match the receipt');
    if (parsed.printedTotal !== null && calculated.valid && parsed.printedTotal !== calculated.total) warnings.push('calculated total does not match the printed total');
    if (confidence !== undefined && confidence < 80) warnings.push('OCR confidence is low');
    $('scan-message').textContent = `${source}: ${parsed.items.length} items imported. ${warnings.length ? `Review carefully: ${warnings.join('; ')}.` : 'Review items and assignments before paying.'}`;
    $('scan-icon').classList.remove('muted');
    $('scan-confidence').textContent = confidence === undefined ? '' : `${Math.round(confidence)}% OCR confidence`;
    return true;
  }
  async function ensureOCR() {
    if (!window.Tesseract) await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js'; script.onload = resolve; script.onerror = () => reject(new Error('OCR library download failed')); document.head.append(script);
    });
    if (!state.worker) state.worker = await window.Tesseract.createWorker('eng', 1, { logger: event => {
      if (!state.ocrBusy) return;
      const labels = { 'loading tesseract core': 'Loading the local AI engine…', 'initializing tesseract': 'Starting the AI engine…', 'loading language traineddata': 'Downloading the English AI model…', 'initializing api': 'Preparing the recognition model…', 'recognizing text': 'AI is reading your receipt…' };
      $('scan-message').textContent = labels[event.status] || 'Preparing on-device AI…';
      const progress = event.status === 'recognizing text' ? 50 + (event.progress || 0) * 50 : (event.progress || 0) * 45;
      $('scan-progress-bar').style.width = `${Math.min(100, Math.max(5, progress))}%`;
    } });
    return state.worker;
  }
  async function scanReceipt() {
    if (!editable()) return;
    state.ocrBusy = true; setEditLock(); $('scan-progress').hidden = false; $('scan-confidence').textContent = ''; $('scan-progress-bar').style.width = '5%'; $('scan-message').textContent = 'Preparing on-device AI. First scan downloads the model…';
    try {
      const worker = await ensureOCR();
      const result = await worker.recognize(state.image);
      $('scan-progress-bar').style.width = '100%';
      applyParsedReceipt(result.data.text, 'AI scan complete', result.data.confidence);
    } catch (_) {
      $('scan-message').textContent = 'The AI model could not finish. Check your connection, retry, or paste the receipt text instead.';
      toast('AI scan failed safely. Your existing split has not been changed.');
      if (state.worker) { try { await state.worker.terminate(); } catch (_) {} state.worker = null; }
    } finally { state.ocrBusy = false; setEditLock(); $('scan-progress').hidden = true; }
  }
  function selectImage(file) {
    if (!editable() || !file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast('Choose a JPG, PNG or WebP image. PDFs are not supported.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('Choose an image smaller than 10 MB.'); return; }
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = URL.createObjectURL(file); state.image = state.objectUrl; $('receipt-preview').src = state.objectUrl; $('receipt-preview').alt = 'Your selected receipt, processed on this device'; $('scan-receipt').innerHTML = `${icon('spark')}Scan receipt with AI`;
    scanReceipt();
  }
  function openSettings() { if (state.inCheckout || state.locked) return; $('paypal-client-id').value = state.clientId === 'sb' ? '' : state.clientId; $('settings-dialog').showModal(); }
  $('open-settings').addEventListener('click', openSettings);
  $('settings-inline').addEventListener('click', openSettings);
  $('close-settings').addEventListener('click', () => $('settings-dialog').close());
  $('settings-form').addEventListener('submit', event => {
    event.preventDefault();
    if (state.inCheckout || state.locked) return;
    const value = $('paypal-client-id').value.trim() || 'sb';
    if (!/^(?:sb|[A-Za-z0-9_-]{20,200})$/.test(value)) { toast('Enter a valid Sandbox Client ID, not a Client Secret.'); return; }
    state.clientId = value; $('settings-dialog').close(); loadPayPal(); toast(value === 'sb' ? 'Using PayPal’s official Sandbox shortcut.' : 'Sandbox Client ID applied for this browser session only.');
  });
  ['open-notes', 'footer-notes'].forEach(id => $(id).addEventListener('click', () => $('notes-dialog').showModal()));
  $('close-notes').addEventListener('click', () => $('notes-dialog').close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
  $('choose-receipt').addEventListener('click', () => { if (editable()) $('receipt-file').click(); });
  $('receipt-file').addEventListener('change', event => { selectImage(event.target.files[0]); event.target.value = ''; });
  $('scan-receipt').addEventListener('click', scanReceipt);
  $('drop-zone').addEventListener('dragover', event => { event.preventDefault(); $('drop-zone').classList.add('is-dragover'); });
  $('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('is-dragover'));
  $('drop-zone').addEventListener('drop', event => { event.preventDefault(); $('drop-zone').classList.remove('is-dragover'); selectImage(event.dataTransfer.files[0]); });
  $('parse-text').addEventListener('click', () => { if (editable()) applyParsedReceipt($('raw-receipt').value, 'Text imported'); });
  $('receipt-items').addEventListener('input', event => {
    if (!event.target.matches('input') || state.locked || state.inCheckout) return;
    const item = state.items.find(i => i.id === event.target.closest('.item-row').dataset.item);
    if (event.target.classList.contains('item-name')) item.name = event.target.value;
    else item.cents = toCents(event.target.value);
    recalculate();
  });
  $('receipt-items').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || !editable()) return;
    const row = button.closest('.item-row'); const item = state.items.find(i => i.id === row.dataset.item);
    if (button.classList.contains('remove-item')) state.items = state.items.filter(i => i.id !== item.id);
    else if (button.dataset.person) { const id = button.dataset.person; item.members = item.members.includes(id) ? item.members.filter(p => p !== id) : [...item.members, id]; }
    renderItems(); recalculate();
  });
  $('add-item').addEventListener('click', () => { if (!editable()) return; if (state.items.length >= 50) { toast('This prototype supports up to 50 items.'); return; } state.items.push({ id: `item-${Date.now()}`, name: 'New item', cents: 100, members: state.people.map(p => p.id) }); renderItems(); recalculate(); });
  $('people-list').addEventListener('input', event => { if (!event.target.matches('input') || state.locked || state.inCheckout) return; state.people.find(p => p.id === event.target.closest('.person-row').dataset.person).name = event.target.value; renderItems(); recalculate(); });
  $('people-list').addEventListener('click', event => {
    const button = event.target.closest('.person-remove'); if (!button || !editable() || state.people.length <= 2) return;
    const id = button.closest('.person-row').dataset.person; state.people = state.people.filter(p => p.id !== id); state.items.forEach(item => { item.members = item.members.filter(p => p !== id); }); if (state.payer === id) state.payer = state.people[0].id; renderPeople(); renderItems(); recalculate();
  });
  $('add-person').addEventListener('click', () => {
    if (!editable()) return; if (state.people.length >= 8) { toast('Up to 8 people are supported in this prototype.'); return; }
    const previousCount = state.people.length; const person = { id: `person-${Date.now()}`, name: `Friend ${previousCount + 1}`, color: colors[previousCount % colors.length] };
    state.items.forEach(item => { if (item.members.length === previousCount) item.members.push(person.id); }); state.people.push(person); renderPeople(); renderItems(); recalculate();
  });
  ['tax', 'tip'].forEach(key => $(`${key}-amount`).addEventListener('input', event => { if (!state.locked && !state.inCheckout) { state[key] = toCents(event.target.value); recalculate(); } }));
  ['item', 'equal'].forEach(mode => $(`mode-${mode}`).addEventListener('click', () => { if (editable()) { state.mode = mode; recalculate(); } }));
  $('payer-select').addEventListener('change', event => { state.payer = event.target.value; updatePayer(); });
  $('reset-demo').addEventListener('click', () => {
    if (!editable()) return; Object.assign(state, makeSample()); if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); state.objectUrl = null; state.image = 'sample-receipt.png'; $('receipt-preview').src = state.image; $('receipt-preview').alt = 'Sample dinner receipt from The Good Table'; $('bill-name').value = 'Dinner at The Good Table'; $('raw-receipt').value = sampleText; $('tax-amount').value = '5.60'; $('tip-amount').value = '14.00'; $('scan-message').textContent = 'Editable sample loaded. AI scan has not run yet.'; $('scan-confidence').textContent = ''; $('scan-icon').classList.add('muted'); $('scan-receipt').innerHTML = `${icon('spark')}Scan sample with AI`; renderPeople(); renderItems(); recalculate(); setEditLock(); toast('The sample dinner is ready to split.');
  });
  $('export-summary').addEventListener('click', () => {
    if (!calculated.valid) { toast('Fix the bill details before exporting.'); return; }
    const data = { app: 'DuoPay', environment: 'PayPal Sandbox only', bill: $('bill-name').value, currency: 'USD', exportedAt: new Date().toISOString(), splitMethod: state.mode, amountsIn: 'integer cents', subtotal: calculated.subtotal, tax: calculated.tax, tip: calculated.tip, total: calculated.total, items: state.items.map(item => ({ name: item.name, cents: item.cents, sharedBy: item.members.map(id => personName(state.people.find(p => p.id === id))).filter(Boolean) })), shares: calculated.shares.map(share => ({ ...share, name: personName(state.people.find(p => p.id === share.id)), payment: state.payments[share.id] || state.uncertain[share.id] || { status: 'UNPAID' } })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'duopay-split-summary.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Split summary exported. No credentials are included.');
  });
  window.addEventListener('beforeunload', () => { if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); if (state.worker) state.worker.terminate(); });
  renderPeople(); renderItems(); recalculate(); loadPayPal();
})();
