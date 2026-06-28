
# === DB.JS (IndexedDB wrapper) ===
db_js = '''/* ============================================
   FireProM DB — IndexedDB Layer
   Офлайн-хранилище данных
   ============================================ */

class FireProMDB {
  constructor() {
    this.dbName = 'FireProMDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Таблица заявок
        if (!db.objectStoreNames.contains('orders')) {
          const ordersStore = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
          ordersStore.createIndex('status', 'status', { unique: false });
          ordersStore.createIndex('client', 'client', { unique: false });
          ordersStore.createIndex('synced', 'synced', { unique: false });
          ordersStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Таблица клиентов
        if (!db.objectStoreNames.contains('clients')) {
          const clientsStore = db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
          clientsStore.createIndex('name', 'name', { unique: false });
          clientsStore.createIndex('inn', 'inn', { unique: true });
          clientsStore.createIndex('synced', 'synced', { unique: false });
        }
        
        // Таблица прайсов
        if (!db.objectStoreNames.contains('prices')) {
          db.createObjectStore('prices', { keyPath: 'id' });
        }
        
        // Таблица настроек
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        // Таблица кэша API
        if (!db.objectStoreNames.contains('apiCache')) {
          const cacheStore = db.createObjectStore('apiCache', { keyPath: 'url' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Generic CRUD
  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Orders helpers
  async addOrder(order) {
    order.createdAt = new Date().toISOString();
    order.updatedAt = order.createdAt;
    order.synced = false;
    return this.put('orders', order);
  }

  async getOrders(filter = {}) {
    let orders = await this.getAll('orders');
    if (filter.status) orders = orders.filter(o => o.status === filter.status);
    if (filter.client) orders = orders.filter(o => o.client?.includes(filter.client));
    if (filter.synced !== undefined) orders = orders.filter(o => o.synced === filter.synced);
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async updateOrder(id, updates) {
    const order = await this.get('orders', id);
    if (!order) return null;
    Object.assign(order, updates, { updatedAt: new Date().toISOString(), synced: false });
    return this.put('orders', order);
  }

  // Clients helpers
  async addClient(client) {
    client.createdAt = new Date().toISOString();
    client.synced = false;
    return this.put('clients', client);
  }

  async getClients(search = '') {
    let clients = await this.getAll('clients');
    if (search) {
      const q = search.toLowerCase();
      clients = clients.filter(c => 
        c.name?.toLowerCase().includes(q) || 
        c.inn?.includes(q) ||
        c.contact?.toLowerCase().includes(q)
      );
    }
    return clients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Settings
  async setSetting(key, value) {
    return this.put('settings', { key, value, updatedAt: new Date().toISOString() });
  }

  async getSetting(key, defaultValue = null) {
    const setting = await this.get('settings', key);
    return setting ? setting.value : defaultValue;
  }

  // API Cache
  async cacheApi(url, data, ttl = 3600000) {
    return this.put('apiCache', {
      url,
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  async getApiCache(url) {
    const cached = await this.get('apiCache', url);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > cached.ttl) {
      await this.delete('apiCache', url);
      return null;
    }
    return cached.data;
  }

  // Sync queue
  async getUnsynced(storeName) {
    return this.getByIndex(storeName, 'synced', false);
  }

  async markSynced(storeName, id) {
    const item = await this.get(storeName, id);
    if (item) {
      item.synced = true;
      item.syncedAt = new Date().toISOString();
      return this.put(storeName, item);
    }
  }

  // Seed data
  async seedData() {
    const seeded = await this.getSetting('seeded');
    if (seeded) return;

    // Seed clients from memory
    const clients = [
      { id: 1, name: 'ООО «НПО «ГИДРОАТОМ»', inn: '7841064608', kpp: '783801001', ogrn: '1177847269786', director: 'Жирноклеева Ирина Владимировна', address: '190031, СПб, ул. Ефимова, д. 4а лит. А, пом. 24-н, офис 523', email: 'gidroatom-npo@yandex.ru', phone: '+7 (911) 824-49-15', bank: 'Альфа-Банк', account: '40702810632200001979', bik: '044030786', sro: 'СРО строительное и проектирование 1 уровень', notes: 'Потенциальный заказчик', synced: true },
      { id: 2, name: 'ООО «ЖКС №2 Калининского района»', inn: '', contact: 'Заказчик по договору', address: 'СПб, Калининский район', notes: 'Закупка 39 металлических дверей, НМЦ 2 944 366,43 ₽', synced: true },
      { id: 3, name: 'ООО «СТД «Петрович»', inn: '', address: 'Энгельса 157 лит. А', notes: 'КП от 25.06.2026 — 2 противопожарные двери', synced: true }
    ];
    for (const c of clients) await this.put('clients', c);

    // Seed sample orders
    const orders = [
      { id: 1, number: 'З-2026-001', client: 'ООО «НПО «ГИДРОАТОМ»', object: 'ул. Ефимова, д. 4а', items: 'Противопожарные двери', amount: 350000, status: 'new', createdAt: '2026-06-25T10:00:00Z', synced: true },
      { id: 2, number: 'З-2026-002', client: 'ООО «ЖКС №2 Калининского района»', object: 'Академика Байкова 13к2, Веденеева 4, Науки 14к4', items: '39 металлических дверей', amount: 2850000, status: 'progress', createdAt: '2026-06-20T14:30:00Z', synced: true },
      { id: 3, number: 'З-2026-003', client: 'ООО «СТД «Петрович»', object: 'Энгельса 157 лит. А', items: '2 противопожарные двери ДПМ01+ДПМ02', amount: 199850, status: 'done', createdAt: '2026-06-15T09:00:00Z', synced: true }
    ];
    for (const o of orders) await this.put('orders', o);

    await this.setSetting('seeded', true);
    console.log('[DB] Seed data loaded');
  }

  // Export/Import
  async exportAll() {
    const data = {};
    for (const store of ['orders', 'clients', 'settings']) {
      data[store] = await this.getAll(store);
    }
    return data;
  }

  async importAll(data) {
    for (const [store, items] of Object.entries(data)) {
      await this.clear(store);
      for (const item of items) {
        await this.put(store, item);
      }
    }
  }
}

// Global instance
const db = new FireProMDB();
'''

with open(f"{base_dir}/js/db.js", "w", encoding="utf-8") as f:
    f.write(db_js)

print("✅ js/db.js создан")