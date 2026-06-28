/* ============================================
   FireProM PWA — Main Application
   ООО «ФАЙЕРПРОМ» Corporate Portal v1.3.0
   ============================================ */

class FireProMApp {
  constructor() {
    this.currentPage = 'dashboard';
    this.sidebarOpen = false;
    this.notifications = [];
    this.installPrompt = null;
    this.isOnline = navigator.onLine;
    this.user = { name: 'Геннадий Олегович', initials: 'ГО', role: 'Руководитель' };
  }
  async init() {
    await db.init();
    await db.seedData();
    this.setupEventListeners();
    this.setupNetworkListeners();
    this.handleRoute();

    setTimeout(() => {
      document.getElementById('splash').classList.add('hidden');
      document.getElementById('app').classList.add('visible');
    }, 1500);

    this.updateStats();
    console.log('[App] FireProM initialized');
  }
  setupEventListeners() {
    window.addEventListener('hashchange', () => this.handleRoute());
    document.querySelectorAll('.nav-item, .bottom-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) {
          window.location.hash = page;
          this.sidebarOpen = false;
          this.updateSidebar();
        }
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.focusSearch();
      }
    });
  }
  setupNetworkListeners() {
    const updateOnline = () => {
      this.isOnline = navigator.onLine;
      const offlineBar = document.getElementById('offline-bar');
      const statusDot = document.querySelector('.status-dot');
      const statusText = document.querySelector('.status-text');
      if (!this.isOnline) {
        offlineBar.classList.add('show');
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Офлайн';
        this.showToast('Офлайн-режим активирован', 'warning');
      } else {
        offlineBar.classList.remove('show');
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Онлайн';
        this.showToast('Соединение восстановлено', 'success');
        this.syncOrders();
      }
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();
  }

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const [page, action] = hash.split('&');
    this.navigateTo(page, action);
  }

  navigateTo(page, action = null) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item, .bottom-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    const main = document.getElementById('main-content');
    main.innerHTML = '';
    switch(page) {
      case 'dashboard': this.renderDashboard(main); break;
      case 'calculator': this.renderCalculator(main); break;
      case 'prices': this.renderPrices(main); break;
      case 'orders': this.renderOrders(main, action); break;
      case 'clients': this.renderClients(main, action); break;
      case 'reference': this.renderReference(main); break;
      default: this.renderDashboard(main);
    }
    main.scrollTop = 0;
  }
    async renderDashboard(container) {
    const orders = await db.getAll('orders');
    const clients = await db.getAll('clients');
    const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
    const activeOrders = orders.filter(o => o.status === 'progress').length;
    const newOrders = orders.filter(o => o.status === 'new').length;
    const completedOrders = orders.filter(o => o.status === 'done').length;

    container.innerHTML = `
      <div class="animate-fade">
        <h2 style="font-size:24px;font-weight:700;margin-bottom:20px;">Дашборд</h2>
        <div class="stats-grid stagger">
          <div class="stat-card">
            <div class="stat-label">Выручка</div>
            <div class="stat-value">${(totalRevenue / 1000000).toFixed(2)}M ₽</div>
            <div class="stat-change up">↑ 12% к прошлому месяцу</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Активные заявки</div>
            <div class="stat-value">${activeOrders}</div>
            <div class="stat-change up">↑ 2 новых</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Новые заявки</div>
            <div class="stat-value">${newOrders}</div>
            <div class="stat-change ${newOrders > 0 ? 'up' : 'down'}">${newOrders > 0 ? '↑' : '↓'} за неделю</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Выполнено</div>
            <div class="stat-value">${completedOrders}</div>
            <div class="stat-change up">↑ 95% успешных</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(249,115,22,0.15);">📈</div>
              Динамика выручки
            </div>
            <button class="btn btn-sm btn-ghost" onclick="app.navigateTo('orders')">Все заявки →</button>
          </div>
          <div style="height:280px;"><canvas id="revenueChart"></canvas></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr;gap:16px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <div class="card-title-icon" style="background:rgba(59,130,246,0.15);">🥧</div>
                Статусы заявок
              </div>
            </div>
            <div style="height:220px;display:flex;align-items:center;justify-content:center;">
              <canvas id="statusChart" style="max-width:220px;"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(34,197,94,0.15);">📋</div>
              Последние заявки
            </div>
          </div>
          <div class="table-container">
            <table class="table">
              <thead><tr><th>№</th><th>Клиент</th><th>Объект</th><th>Сумма</th><th>Статус</th></tr></thead>
              <tbody>
                ${orders.slice(0, 5).map(o => `
                  <tr onclick="app.navigateTo('orders')" style="cursor:pointer;">
                    <td class="cell-primary">${o.number}</td>
                    <td>${o.client}</td>
                    <td class="cell-muted">${o.object?.substring(0, 30) || '—'}${o.object?.length > 30 ? '...' : ''}</td>
                    <td class="cell-primary">${o.amount?.toLocaleString('ru-RU')} ₽</td>
                    <td>${this.getStatusBadge(o.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(234,179,8,0.15);">🏢</div>
              Клиенты
            </div>
            <button class="btn btn-sm btn-ghost" onclick="app.navigateTo('clients')">Все клиенты →</button>
          </div>
          ${clients.slice(0, 3).map(c => `
            <div class="list-item" onclick="app.showClientDetail(${c.id})">
              <div class="list-item-icon">🏢</div>
              <div class="list-item-content">
                <div class="list-item-title">${c.name}</div>
                <div class="list-item-subtitle">ИНН: ${c.inn || '—'} | ${c.phone || '—'}</div>
              </div>
              <div class="list-item-meta">
                <span class="tag tag-primary">${c.sro || 'Клиент'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    setTimeout(() => {
      charts.initRevenueChart('revenueChart', {
        labels: ['Янв','Фев','Мар','Апр','Май','Июн'],
        values: [1200000, 1500000, 1800000, 2100000, 2800000, 3400000]
      });
      charts.initStatusChart('statusChart', {
        labels: ['Новые','В работе','Выполнено','Отменено'],
        values: [newOrders, activeOrders, completedOrders, orders.filter(o => o.status === 'cancel').length]
      });
    }, 100);
  }
  renderCalculator(container) {
    const types = calculator.getDoorTypes();
    const sizes = calculator.getStandardSizes();
    const worksCategories = calculator.getWorksList();

    container.innerHTML = `
      <div class="animate-fade">
        <h2 style="font-size:24px;font-weight:700;margin-bottom:20px;">Калькулятор дверей</h2>
        <div class="calc-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Тип двери</label>
              <select class="form-select" id="calc-type">
                ${types.map(t => `<option value="${t.name}">${t.name} — ${t.price.toLocaleString('ru-RU')} ₽/м²</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Количество</label>
              <input type="number" class="form-input" id="calc-qty" value="1" min="1">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Стандартный размер</label>
              <select class="form-select" id="calc-size-preset" onchange="app.applySizePreset()">
                <option value="">— Выберите —</option>
                ${sizes.map(s => `<option value="${s.w},${s.h}">${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ширина, мм</label>
              <input type="number" class="form-input" id="calc-width" value="900" min="600" max="2290">
            </div>
            <div class="form-group">
              <label class="form-label">Высота, мм</label>
              <input type="number" class="form-input" id="calc-height" value="2100" min="1800" max="2450">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Дополнительные опции</label>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
              <label class="checkbox"><input type="checkbox" id="opt-antipanic"> Антипаника</label>
              <label class="checkbox"><input type="checkbox" id="opt-electromagnet"> Электромагнитный замок</label>
              <label class="checkbox"><input type="checkbox" id="opt-closer"> Доводчик</label>
              <label class="checkbox"><input type="checkbox" id="opt-autothreshold"> Автоматический порог</label>
              <label class="checkbox"><input type="checkbox" id="opt-canopy"> Козырёк</label>
              <label class="checkbox"><input type="checkbox" id="opt-vision"> Стеклопакет</label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Монтажные работы</label>
            ${Object.entries(worksCategories).map(([cat, works]) => `
              <div style="margin-bottom:12px;">
                <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:6px;">${cat}</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  ${works.map(w => `
                    <label class="checkbox" style="background:var(--bg);padding:8px 12px;border-radius:8px;border:1px solid var(--surface-light);">
                      <input type="checkbox" class="work-check" data-name="${w.name}" data-price="${w.price}">
                      <span style="font-size:13px;">${w.name} <span style="color:var(--text-muted);">(${w.price.toLocaleString('ru-RU')} ₽/${w.unit})</span></span>
                    </label>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-primary btn-lg btn-block" onclick="app.calculateDoor()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/></svg>
            Рассчитать стоимость
          </button>
        </div>
        <div id="calc-result" style="display:none;">
          <div class="calc-result">
            <div class="calc-result-label">Итого с НДС 22%</div>
            <div class="calc-result-total" id="calc-total">0 ₽</div>
            <div style="font-size:14px;color:var(--text-muted);margin-top:4px;">Площадь полотна: <span id="calc-area">0</span> м²</div>
            <div class="calc-breakdown" id="calc-breakdown"></div>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-secondary btn-block" onclick="app.saveCalculation()">💾 Сохранить расчёт</button>
            <button class="btn btn-outline btn-block" onclick="app.shareCalculation()">📤 Поделиться</button>
          </div>
        </div>
      </div>
    `;
  }
  applySizePreset() {
    const preset = document.getElementById('calc-size-preset').value;
    if (!preset) return;
    const [w, h] = preset.split(',').map(Number);
    document.getElementById('calc-width').value = w;
    document.getElementById('calc-height').value = h;
  }

  calculateDoor() {
    const config = {
      type: document.getElementById('calc-type').value,
      width: Number(document.getElementById('calc-width').value),
      height: Number(document.getElementById('calc-height').value),
      quantity: Number(document.getElementById('calc-qty').value),
      options: {
        antipanic: document.getElementById('opt-antipanic').checked,
        electromagnet: document.getElementById('opt-electromagnet').checked,
        closer: document.getElementById('opt-closer').checked,
        autothreshold: document.getElementById('opt-autothreshold').checked,
        canopy: document.getElementById('opt-canopy').checked,
        visionPanel: document.getElementById('opt-vision').checked
      },
      works: Array.from(document.querySelectorAll('.work-check:checked')).map(cb => ({
        name: cb.dataset.name,
        qty: 1
      }))
    };
    const result = calculator.calculate(config);
    this.lastCalculation = result;
    document.getElementById('calc-total').textContent = result.total.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('calc-area').textContent = result.area;
    const breakdown = document.getElementById('calc-breakdown');
    breakdown.innerHTML = `
      <div class="calc-breakdown-row"><span>Двери (${config.type}, ${result.quantity} шт.)</span><span>${result.doorCost.toLocaleString('ru-RU')} ₽</span></div>
      ${result.optionsCost > 0 ? `<div class="calc-breakdown-row"><span>Опции</span><span>${result.optionsCost.toLocaleString('ru-RU')} ₽</span></div>` : ''}
      ${result.worksBreakdown.map(w => `<div class="calc-breakdown-row"><span>${w.name} (${w.qty} ${w.unit})</span><span>${w.total.toLocaleString('ru-RU')} ₽</span></div>`).join('')}
      <div class="calc-breakdown-row"><span>Подытог</span><span>${result.subtotal.toLocaleString('ru-RU')} ₽</span></div>
      <div class="calc-breakdown-row"><span>НДС 22%</span><span>${result.vat.toLocaleString('ru-RU')} ₽</span></div>
      <div class="calc-breakdown-row total"><span>ИТОГО</span><span>${result.total.toLocaleString('ru-RU')} ₽</span></div>
    `;
    document.getElementById('calc-result').style.display = 'block';
    document.getElementById('calc-result').scrollIntoView({ behavior: 'smooth' });
  }

  saveCalculation() {
    if (!this.lastCalculation) return;
    const blob = new Blob([JSON.stringify(this.lastCalculation, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `расчет-fireprom-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Расчёт сохранён', 'success');
  }

  shareCalculation() {
    if (!this.lastCalculation) return;
    const text = `Расчёт FireProM: ${this.lastCalculation.total.toLocaleString('ru-RU')} ₽ (с НДС 22%)`;
    if (navigator.share) {
      navigator.share({ title: 'Расчёт FireProM', text });
    } else {
      navigator.clipboard.writeText(text);
      this.showToast('Скопировано в буфер обмена', 'success');
    }
  }
  renderPrices(container) {
    const types = calculator.getDoorTypes();
    const works = calculator.getWorksList();
    container.innerHTML = `
      <div class="animate-fade">
        <h2 style="font-size:24px;font-weight:700;margin-bottom:20px;">Прайс-лист</h2>
        <p style="color:var(--text-muted);margin-bottom:20px;">Актуально на 16.06.2026. Все цены с НДС 22%.</p>
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(249,115,22,0.15);">🚪</div>
              Противопожарные двери
            </div>
          </div>
          <div class="table-container">
            <table class="table">
              <thead><tr><th>Тип</th><th>Цена за м²</th><th>Описание</th></tr></thead>
              <tbody>
                ${types.map(t => `
                  <tr>
                    <td class="cell-primary">${t.name}</td>
                    <td style="color:var(--primary);font-weight:700;">${t.price.toLocaleString('ru-RU')} ₽</td>
                    <td class="cell-muted">Противопожарная дверь, сталь 1,2 мм, минвата</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ${Object.entries(works).map(([cat, items]) => `
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <div class="card-title-icon" style="background:rgba(59,130,246,0.15);">🔧</div>
                ${cat}
              </div>
            </div>
            <div class="table-container">
              <table class="table">
                <thead><tr><th>Наименование</th><th>Цена</th><th>Ед.</th></tr></thead>
                <tbody>
                  ${items.map(i => `
                    <tr>
                      <td class="cell-primary">${i.name}</td>
                      <td style="color:var(--primary);font-weight:700;">${i.price.toLocaleString('ru-RU')} ₽</td>
                      <td class="cell-muted">${i.unit}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  async renderOrders(container, action = null) {
    if (action === 'new') { this.renderOrderForm(container); return; }
    const orders = await db.getAll('orders');
    container.innerHTML = `
      <div class="animate-fade">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:24px;font-weight:700;">Заявки</h2>
          <button class="btn btn-primary" onclick="app.navigateTo('orders&new')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Новая заявка
          </button>
        </div>
        <div class="tabs">
          <button class="tab active" onclick="app.filterOrders(this,'all')">Все (${orders.length})</button>
          <button class="tab" onclick="app.filterOrders(this,'new')">Новые (${orders.filter(o=>o.status==='new').length})</button>
          <button class="tab" onclick="app.filterOrders(this,'progress')">В работе (${orders.filter(o=>o.status==='progress').length})</button>
          <button class="tab" onclick="app.filterOrders(this,'done')">Выполнено (${orders.filter(o=>o.status==='done').length})</button>
        </div>
        <div id="orders-list">
          ${orders.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <h3>Нет заявок</h3>
              <p>Создайте первую заявку</p>
            </div>
          ` : orders.map(o => this.renderOrderCard(o)).join('')}
        </div>
      </div>
    `;
  }

  renderOrderCard(order) {
    return `
      <div class="list-item" onclick="app.showOrderDetail(${order.id})">
        <div class="list-item-icon" style="font-size:24px;">📋</div>
        <div class="list-item-content">
          <div class="list-item-title">${order.number} — ${order.client}</div>
          <div class="list-item-subtitle">${order.object || '—'} | ${order.items || '—'}</div>
        </div>
        <div class="list-item-meta">
          <div class="list-item-price">${order.amount?.toLocaleString('ru-RU') || '—'} ₽</div>
          <div style="margin-top:4px;">${this.getStatusBadge(order.status)}</div>
        </div>
      </div>
    `;
  }

  async filterOrders(btn, status) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const orders = await db.getAll('orders');
    const filtered = status === 'all' ? orders : orders.filter(o => o.status === status);
    document.getElementById('orders-list').innerHTML = filtered.map(o => this.renderOrderCard(o)).join('');
  }
  renderOrderForm(container) {
    container.innerHTML = `
      <div class="animate-fade">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <button class="btn btn-ghost btn-icon" onclick="app.navigateTo('orders')">←</button>
          <h2 style="font-size:24px;font-weight:700;">Новая заявка</h2>
        </div>
        <div class="calc-form">
          <div class="form-group">
            <label class="form-label">Номер заявки</label>
            <input type="text" class="form-input" id="order-number" value="З-2026-${String(Math.floor(Math.random()*900)+100).padStart(3,'0')}">
          </div>
          <div class="form-group">
            <label class="form-label">Клиент</label>
            <input type="text" class="form-input" id="order-client" placeholder="Название организации">
          </div>
          <div class="form-group">
            <label class="form-label">Объект (адрес)</label>
            <input type="text" class="form-input" id="order-object" placeholder="Адрес объекта">
          </div>
          <div class="form-group">
            <label class="form-label">Позиции</label>
            <textarea class="form-textarea" id="order-items" placeholder="Описание работ и материалов"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Сумма, ₽</label>
              <input type="number" class="form-input" id="order-amount" placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Статус</label>
              <select class="form-select" id="order-status">
                <option value="new">Новая</option>
                <option value="progress">В работе</option>
                <option value="done">Выполнено</option>
                <option value="cancel">Отменено</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-lg btn-block" onclick="app.saveOrder()">Сохранить заявку</button>
        </div>
      </div>
    `;
  }

  async saveOrder() {
    const order = {
      number: document.getElementById('order-number').value,
      client: document.getElementById('order-client').value,
      object: document.getElementById('order-object').value,
      items: document.getElementById('order-items').value,
      amount: Number(document.getElementById('order-amount').value) || 0,
      status: document.getElementById('order-status').value
    };
    if (!order.client || !order.number) {
      this.showToast('Заполните обязательные поля', 'error');
      return;
    }
    await db.addOrder(order);
    this.showToast('Заявка сохранена', 'success');
    this.navigateTo('orders');
    this.updateStats();
  }

  async showOrderDetail(id) {
    const order = await db.get('orders', id);
    if (!order) return;
    this.openModal(`Заявка ${order.number}`, `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Клиент</div>
        <div style="font-size:16px;font-weight:600;margin-top:4px;">${order.client}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Объект</div>
        <div style="margin-top:4px;">${order.object || '—'}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Позиции</div>
        <div style="margin-top:4px;">${order.items || '—'}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Сумма</div>
        <div style="font-size:24px;font-weight:800;color:var(--primary);margin-top:4px;">${order.amount?.toLocaleString('ru-RU') || '—'} ₽</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Статус</div>
        <div style="margin-top:4px;">${this.getStatusBadge(order.status)}</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button class="btn btn-primary btn-block" onclick="app.updateOrderStatus(${order.id}, 'progress')">В работу</button>
        <button class="btn btn-success btn-block" onclick="app.updateOrderStatus(${order.id}, 'done')">Выполнено</button>
        <button class="btn btn-outline btn-block" onclick="app.closeModal()">Закрыть</button>
      </div>
    `);
  }

  async updateOrderStatus(id, status) {
    await db.updateOrder(id, { status });
    this.showToast('Статус обновлён', 'success');
    this.closeModal();
    this.navigateTo('orders');
    this.updateStats();
  }
  async renderClients(container, action = null) {
    if (action === 'new') { this.renderClientForm(container); return; }
    const clients = await db.getAll('clients');
    container.innerHTML = `
      <div class="animate-fade">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:24px;font-weight:700;">Клиенты</h2>
          <button class="btn btn-primary" onclick="app.navigateTo('clients&new')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Добавить
          </button>
        </div>
        <div class="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Поиск по названию, ИНН, контакту..." oninput="app.searchClients(this.value)">
        </div>
        <div id="clients-list">
          ${clients.map(c => `
            <div class="list-item" onclick="app.showClientDetail(${c.id})">
              <div class="list-item-icon">🏢</div>
              <div class="list-item-content">
                <div class="list-item-title">${c.name}</div>
                <div class="list-item-subtitle">ИНН: ${c.inn || '—'} | ${c.phone || '—'}</div>
              </div>
              <div class="list-item-meta">
                <span class="tag tag-primary">${c.sro || 'Клиент'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async searchClients(query) {
    const clients = await db.getClients(query);
    document.getElementById('clients-list').innerHTML = clients.map(c => `
      <div class="list-item" onclick="app.showClientDetail(${c.id})">
        <div class="list-item-icon">🏢</div>
        <div class="list-item-content">
          <div class="list-item-title">${c.name}</div>
          <div class="list-item-subtitle">ИНН: ${c.inn || '—'} | ${c.phone || '—'}</div>
        </div>
        <div class="list-item-meta">
          <span class="tag tag-primary">${c.sro || 'Клиент'}</span>
        </div>
      </div>
    `).join('');
  }

  renderClientForm(container) {
    container.innerHTML = `
      <div class="animate-fade">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <button class="btn btn-ghost btn-icon" onclick="app.navigateTo('clients')">←</button>
          <h2 style="font-size:24px;font-weight:700;">Новый клиент</h2>
        </div>
        <div class="calc-form">
          <div class="form-group">
            <label class="form-label">Название организации *</label>
            <input type="text" class="form-input" id="client-name" placeholder="ООО «...»">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">ИНН</label>
              <input type="text" class="form-input" id="client-inn" placeholder="1234567890">
            </div>
            <div class="form-group">
              <label class="form-label">КПП</label>
              <input type="text" class="form-input" id="client-kpp" placeholder="123456789">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Генеральный директор</label>
            <input type="text" class="form-input" id="client-director" placeholder="ФИО">
          </div>
          <div class="form-group">
            <label class="form-label">Юридический адрес</label>
            <input type="text" class="form-input" id="client-address" placeholder="Адрес">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="client-email" placeholder="email@example.ru">
            </div>
            <div class="form-group">
              <label class="form-label">Телефон</label>
              <input type="tel" class="form-input" id="client-phone" placeholder="+7 (999) 000-00-00">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Примечания</label>
            <textarea class="form-textarea" id="client-notes" placeholder="Дополнительная информация..."></textarea>
          </div>
          <button class="btn btn-primary btn-lg btn-block" onclick="app.saveClient()">Сохранить клиента</button>
        </div>
      </div>
    `;
  }

  async saveClient() {
    const client = {
      name: document.getElementById('client-name').value,
      inn: document.getElementById('client-inn').value,
      kpp: document.getElementById('client-kpp').value,
      director: document.getElementById('client-director').value,
      address: document.getElementById('client-address').value,
      email: document.getElementById('client-email').value,
      phone: document.getElementById('client-phone').value,
      notes: document.getElementById('client-notes').value
    };
    if (!client.name) {
      this.showToast('Укажите название организации', 'error');
      return;
    }
    await db.addClient(client);
    this.showToast('Клиент добавлен', 'success');
    this.navigateTo('clients');
  }

  async showClientDetail(id) {
    const client = await db.get('clients', id);
    if (!client) return;
    this.openModal(client.name, `
      <div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">ИНН:</span> <span style="font-weight:600;">${client.inn || '—'}</span></div>
      <div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">КПП:</span> <span>${client.kpp || '—'}</span></div>
      <div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">Директор:</span> <span>${client.director || '—'}</span></div>
      <div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">Адрес:</span> <span>${client.address || '—'}</span></div>
      <div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">Email:</span> <a href="mailto:${client.email}" style="color:var(--primary);">${client.email || '—'}</a></div>
      <div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">Телефон:</span> <a href="tel:${client.phone}" style="color:var(--primary);">${client.phone || '—'}</a></div>
      ${client.sro ? `<div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">СРО:</span> <span class="tag tag-primary">${client.sro}</span></div>` : ''}
      ${client.notes ? `<div style="margin-bottom:12px;"><span style="color:var(--text-muted);font-size:12px;">Примечания:</span> <p style="margin-top:4px;">${client.notes}</p></div>` : ''}
      <div style="display:flex;gap:10px;margin-top:20px;">
        <a href="tel:${client.phone}" class="btn btn-primary btn-block" style="text-decoration:none;">📞 Позвонить</a>
        <a href="mailto:${client.email}" class="btn btn-secondary btn-block" style="text-decoration:none;">✉️ Написать</a>
      </div>
    `);
  }
    renderReference(container) {
    container.innerHTML = `
      <div class="animate-fade">
        <h2 style="font-size:24px;font-weight:700;margin-bottom:20px;">Справочник</h2>
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(59,130,246,0.15);">📐</div>
              Нормативные просветы (СП / ГОСТ)
            </div>
          </div>
          <div class="table-container">
            <table class="table">
              <thead><tr><th>Элемент</th><th>Минимум</th><th>Стандарт</th><th>Максимум</th></tr></thead>
              <tbody>
                <tr><td class="cell-primary">Порог</td><td>14 мм</td><td>28 мм</td><td>42 мм</td></tr>
                <tr><td class="cell-primary">Наличник</td><td>30 мм</td><td>55 мм</td><td>—</td></tr>
                <tr><td class="cell-primary">Коробка</td><td>105 мм</td><td>—</td><td>—</td></tr>
                <tr><td class="cell-primary">Полотно</td><td>74 мм</td><td>—</td><td>—</td></tr>
                <tr><td class="cell-primary">Макс. высота</td><td>—</td><td>—</td><td>2450 мм</td></tr>
                <tr><td class="cell-primary">Макс. ширина (двуств.)</td><td>—</td><td>—</td><td>2290 мм</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(34,197,94,0.15);">🔧</div>
              Спецификация дверей (июнь 2026)
            </div>
          </div>
          <div style="display:grid;gap:12px;">
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Коробка / Полотно</div>
              <div style="font-size:14px;color:var(--text-muted);">Сталь 1,2 мм, утепление минватой</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Петли</div>
              <div style="font-size:14px;color:var(--text-muted);">Каплевидные 20×140 мм</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Уплотнители</div>
              <div style="font-size:14px;color:var(--text-muted);">Remontix + ТСЛ21 БО 1 мм</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Замок</div>
              <div style="font-size:14px;color:var(--text-muted);">FUARO FL-0432 / AVECS 2000-ZN</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Цилиндр</div>
              <div style="font-size:14px;color:var(--text-muted);">Fuaro 100 ZA 70 мм</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Ручки</div>
              <div style="font-size:14px;color:var(--text-muted);">FUARO DH-0431 NE чёрные</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Доводчик</div>
              <div style="font-size:14px;color:var(--text-muted);">Ajax 95 кг</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Порог</div>
              <div style="font-size:14px;color:var(--text-muted);">Fapim Domatic Compact Fire DA7004 автоматический</div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Монтажная пена</div>
              <div style="font-size:14px;color:var(--text-muted);">Soudal + MARCON огнестойкая</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(234,179,8,0.15);">🔒</div>
              Электромагнитный замок VIZIT-ML240-40-50
            </div>
          </div>
          <div style="display:grid;gap:12px;">
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Характеристики</div>
              <div style="font-size:14px;color:var(--text-muted);line-height:1.6;">
                Усилие удержания: 240 кг<br>
                Напряжение: 9–15 В DC<br>
                Толщина двери: 40–50 мм<br>
                Потребление: ≤500 мА / ≤7,2 Вт<br>
                Размеры: 186×45×30 мм<br>
                Температурный диапазон: –40…+45 °С
              </div>
            </div>
            <div style="background:var(--bg);padding:14px;border-radius:10px;">
              <div style="font-weight:600;margin-bottom:6px;">Комплектация</div>
              <div style="font-size:14px;color:var(--text-muted);line-height:1.6;">
                Электромагнит, ответная пластина, уголок 40×50 мм, монтажный комплект, паспорт, встроенный модуль перемагничивания
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title-icon" style="background:rgba(239,68,68,0.15);">⚡</div>
              Коммуникационный протокол
            </div>
          </div>
          <div style="background:var(--bg);padding:16px;border-radius:10px;font-size:14px;line-height:1.7;color:var(--text-secondary);">
            <strong style="color:var(--text);">Порядок обращений по замкам и оборудованию:</strong><br><br>
            1. Жилец → УК/ТСЖ/ЖКС (заказчик по договору)<br>
            2. УК/ТСЖ/ЖКС → ООО «ФАЙЕРПРОМ» (диагностика/юстировка/замена)<br>
            3. ООО «ФАЙЕРПРОМ» → ответ УК → жилец<br><br>
            <em style="color:var(--text-muted);">Обращения от жильцов/собственников напрямую не принимаются.</em>
          </div>
        </div>
      </div>
    `;
  }
  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.updateSidebar();
  }

  updateSidebar() {
    document.getElementById('sidebar').classList.toggle('open', this.sidebarOpen);
    document.getElementById('sidebar-overlay').classList.toggle('show', this.sidebarOpen);
  }

  toggleNotifications() {
    this.showToast('Уведомления: ' + (this.notifications.length || 'нет новых'), 'info');
  }

  toggleProfile() {
    this.openModal('Профиль', `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="width:80px;height:80px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:white;margin:0 auto 12px;">${this.user.initials}</div>
        <div style="font-size:18px;font-weight:700;">${this.user.name}</div>
        <div style="color:var(--text-muted);">${this.user.role}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-secondary btn-block" onclick="app.exportData()">📤 Экспорт данных</button>
        <button class="btn btn-secondary btn-block" onclick="app.importData()">📥 Импорт данных</button>
        <button class="btn btn-outline btn-block" onclick="app.closeModal()">Закрыть</button>
      </div>
    `);
  }

  openModal(title, body) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-overlay').classList.add('show');
    document.getElementById('modal').classList.add('show');
  }

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
    document.getElementById('modal').classList.remove('show');
  }

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  getStatusBadge(status) {
    const labels = { new: 'Новая', progress: 'В работе', done: 'Выполнено', cancel: 'Отменено' };
    return `<span class="status status-${status}">${labels[status] || status}</span>`;
  }

  async updateStats() {
    const orders = await db.getAll('orders');
    document.getElementById('orders-badge').textContent = orders.filter(o => o.status === 'new').length;
  }

  async syncOrders() {
    if (!this.isOnline) return;
    const unsynced = await db.getUnsynced('orders');
    if (unsynced.length > 0) {
      console.log('[App] Syncing', unsynced.length, 'orders');
      for (const order of unsynced) {
        await db.markSynced('orders', order.id);
      }
      this.showToast(`Синхронизировано ${unsynced.length} заявок`, 'success');
    }
  }
  async exportData() {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fireprom-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Данные экспортированы', 'success');
    this.closeModal();
  }

  async importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        await db.importAll(data);
        this.showToast('Данные импортированы', 'success');
        this.closeModal();
        this.navigateTo('dashboard');
      } catch (err) {
        this.showToast('Ошибка импорта: ' + err.message, 'error');
      }
    };
    input.click();
  }

  installApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          this.showToast('Приложение установлено!', 'success');
        }
        deferredPrompt = null;
      });
    }
    document.getElementById('install-prompt').classList.remove('show');
  }

  dismissInstall() {
    localStorage.setItem('install-dismissed', 'true');
    document.getElementById('install-prompt').classList.remove('show');
  }

  updateApp() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.waiting?.postMessage('SKIP_WAITING');
        window.location.reload();
      });
    }
  }

  focusSearch() {
    const search = document.querySelector('.search-box input');
    if (search) search.focus();
  }
}

// Initialize
const app = new FireProMApp();
document.addEventListener('DOMContentLoaded', () => app.init());
