
# === CALCULATOR.JS ===
calc_js = '''/* ============================================
   FireProM Calculator
   Расчёт стоимости противопожарных дверей
   ============================================ */

class DoorCalculator {
  constructor() {
    // Цены из памяти (16.06.2026)
    this.doorPrices = {
      'ТИП 1': 44000, 'ТИП 2': 42000, 'ТИП 3': 40000, 'ТИП 4': 32000,
      'ТИП 5': 35000, 'ТИП 6': 37000, 'ТИП 7': 44000, 'ТИП 8': 44000,
      'ТИП 9': 40000, 'ТИП 10': 35000, 'ТИП 11': 42000
    };
    
    // Монтажные работы из памяти
    this.works = {
      'Замер': { price: 1200, unit: 'шт.', category: 'Подготовка' },
      'Доставка': { price: 6600, unit: 'рейс', category: 'Логистика' },
      'Подъём (до 3 этажа)': { price: 480, unit: 'этаж', category: 'Логистика' },
      'Подъём (свыше 3 этажа)': { price: 600, unit: 'этаж', category: 'Логистика' },
      'Демонтаж старой двери': { price: 480, unit: 'шт.', category: 'Демонтаж' },
      'Демонтаж с расширением проёма': { price: 1440, unit: 'шт.', category: 'Демонтаж' },
      'Монтаж двери с ПСУЛ': { price: 6000, unit: 'шт.', category: 'Монтаж' },
      'Монтаж двери с ПСУЛ (сложный)': { price: 13200, unit: 'шт.', category: 'Монтаж' },
      'Откосы ГКЛ': { price: 3849, unit: 'компл.', category: 'Отделка' },
      'Откосы штукатурные': { price: 4168, unit: 'компл.', category: 'Отделка' },
      'Металлопортал': { price: 19520, unit: 'компл.', category: 'Дополнительно' },
      'Документация': { price: 45000, unit: 'компл.', category: 'Документы' }
    };
    
    // НДС
    this.vatRate = 0.22;
  }

  calculate(config) {
    const { type, width, height, quantity, works = [], options = {} } = config;
    
    // Площадь полотна
    const area = (width / 1000) * (height / 1000);
    
    // Стоимость дверей
    const pricePerM2 = this.doorPrices[type] || 40000;
    let doorCost = area * pricePerM2 * quantity;
    
    // Двустворчатая дверь — надбавка 40%
    if (width > 1200) {
      doorCost *= 1.4;
    }
    
    // Опции
    let optionsCost = 0;
    if (options.antipanic) optionsCost += 8500 * quantity;
    if (options.electromagnet) optionsCost += 7200 * quantity;
    if (options.closer) optionsCost += 3200 * quantity;
    if (options.autothreshold) optionsCost += 5800 * quantity;
    if (options.canopy) optionsCost += 4500 * quantity;
    if (options.visionPanel) optionsCost += 12000 * quantity;
    
    // Монтажные работы
    let worksCost = 0;
    const worksBreakdown = [];
    for (const work of works) {
      const w = this.works[work.name];
      if (w) {
        const cost = w.price * (work.qty || 1);
        worksCost += cost;
        worksBreakdown.push({ name: work.name, qty: work.qty || 1, unit: w.unit, price: w.price, total: cost });
      }
    }
    
    const subtotal = doorCost + optionsCost + worksCost;
    const vat = subtotal * this.vatRate;
    const total = subtotal + vat;
    
    return {
      area: area.toFixed(3),
      doorCost: Math.round(doorCost),
      optionsCost: Math.round(optionsCost),
      worksCost: Math.round(worksCost),
      worksBreakdown,
      subtotal: Math.round(subtotal),
      vat: Math.round(vat),
      total: Math.round(total),
      pricePerM2,
      quantity
    };
  }

  getDoorTypes() {
    return Object.keys(this.doorPrices).map(k => ({
      name: k,
      price: this.doorPrices[k]
    }));
  }

  getWorksList() {
    const categories = {};
    for (const [name, data] of Object.entries(this.works)) {
      if (!categories[data.category]) categories[data.category] = [];
      categories[data.category].push({ name, ...data });
    }
    return categories;
  }

  getStandardSizes() {
    return [
      { w: 900, h: 2100, label: '900×2100 (стандарт)' },
      { w: 980, h: 2000, label: '980×2000' },
      { w: 1000, h: 2100, label: '1000×2100' },
      { w: 1200, h: 2100, label: '1200×2100' },
      { w: 1350, h: 2120, label: '1350×2120 (двуств.)' },
      { w: 1500, h: 2100, label: '1500×2100 (двуств.)' },
      { w: 1800, h: 2100, label: '1800×2100 (двуств.)' },
      { w: 2000, h: 2100, label: '2000×2100 (двуств.)' }
    ];
  }
}

const calculator = new DoorCalculator();
'''

with open(f"{base_dir}/js/calculator.js", "w", encoding="utf-8") as f:
    f.write(calc_js)

print("✅ js/calculator.js создан")