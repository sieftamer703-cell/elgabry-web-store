import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

// ضبط رقم واتساب المكتبة (أدخل الرقم هنا بدون علامة +)
const WHATSAPP_NUMBER = '01012993309'; // 👈 غيّر هذا الرقم برقم المكتبة الحقيقي

const $ = id => document.getElementById(id);
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let products = [];
let cart = {};
let category = 'الكل';

const money = n => `${Number(n).toLocaleString('ar-EG')} ج.م`;

// جلب المنتجات المفعّلة من Supabase
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('خطأ في جلب المنتجات:', error.message);
    $('grid').textContent = 'تعذر تحميل المنتجات حالياً.';
    return;
  }

  products = data || [];
  renderCategories();
  renderProducts();
}

function renderCategories() {
  const categoriesList = ['الكل', ...new Set(products.map(p => p.category).filter(Boolean))];
  $('categories').replaceChildren();

  categoriesList.forEach(c => {
    const b = document.createElement('button');
    b.textContent = c;
    b.className = c === category ? 'active' : '';
    b.onclick = () => {
      category = c;
      renderCategories();
      renderProducts();
    };
    $('categories').append(b);
  });
}

function renderProducts() {
  const q = $('search').value.trim().toLowerCase();$('grid').replaceChildren();

  const filtered = products.filter(p => 
    (category === 'الكل' || p.category === category) &&
    p.name.toLowerCase().includes(q)
  );

  filtered.forEach(p => {
    const card = document.createElement('article');
    card.className = 'product';

    const visual = document.createElement('div');
    visual.className = 'visual';
    if (p.image_url) {
      const img = document.createElement('img');
      img.src = p.image_url;
      img.alt = p.name;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      visual.replaceChildren(img);
    } else {
      visual.textContent = '📚';
    }

    const details = document.createElement('div');
    details.className = 'details';

    const name = document.createElement('h3');
    name.textContent = p.name;

    const price = document.createElement('p');
    price.textContent = money(p.price);

    const btn = document.createElement('button');
    btn.textContent = p.stock > 0 ? 'أضف للسلة +' : 'غير متوفر';
    btn.disabled = p.stock <= 0;
    btn.onclick = () => {
      cart[p.id] = (cart[p.id] || 0) + 1;
      renderCart();
    };

    details.append(name, price, btn);
    card.append(visual, details);
    $('grid').append(card);
  });

  if (!filtered.length) {
    $('grid').textContent = 'لا توجد منتجات مطابقة.';
  }
}

function entries() {
  return products.filter(p => cart[p.id] > 0);
}

function total() {
  return entries().reduce((sum, p) => sum + p.price * cart[p.id], 0);
}

function renderCart() {
  $('count').textContent = Object.values(cart).reduce((a, b) => a + b, 0);$('cartItems').replaceChildren();

  entries().forEach(p => {
    const line = document.createElement('div');
    line.className = 'line';

    const desc = document.createElement('span');
    desc.textContent = `${p.name} × ${cart[p.id]} — ${money(p.price * cart[p.id])}`;

    const remove = document.createElement('button');
    remove.textContent = 'حذف';
    remove.onclick = () => {
      delete cart[p.id];
      renderCart();
    };

    line.append(desc, remove);
    $('cartItems').append(line);
  });

  if (!entries().length) {
    $('cartItems').textContent = 'السلة فارغة';
  }

  $('total').textContent = `الإجمالي: ${money(total())} (بدون توصيل)`;
}

$('search').addEventListener('input', renderProducts);
$('cartBtn').onclick = () => {$('cartDialog').showModal();
  renderCart();
};
$('closeCart').onclick = () =>$('cartDialog').close();

$('fulfillment').onchange = () => {
  const isDelivery = $('fulfillment').value === 'delivery';$('addressBox').hidden = !isDelivery;
  $('address').required = isDelivery;
};

function buildWhatsAppMessage() {
  if (!entries().length) {
    $('status').textContent = 'أضف منتجًا للسلة أولًا';
    return null;
  }
  if (!$('checkout').reportValidity()) return null;

  return `طلب جديد - مكتبة الجبري\n` +
    `الاسم: ${$('customer').value}\n` +
    `الموبايل: ${$('phone').value}\n` +
    `الاستلام: ${$('fulfillment').value === 'pickup' ? 'استلام من المكتبة' : 'توصيل'}\n` +
    `العنوان: ${$('address').value || '—'}\n` +
    `المنتجات:\n` +
    entries().map(p => `• ${p.name} × ${cart[p.id]} = ${money(p.price * cart[p.id])}`).join('\n') +
    `\n\nالإجمالي: ${money(total())}\n` +
    `ملاحظات: ${$('notes').value || '—'}`;
}

$('whatsapp').onclick = () => {
  const msg = buildWhatsAppMessage();
  if (!msg) return;

  if (!/^\d{10,15}$/.test(WHATSAPP_NUMBER)) {$('status').textContent = 'يرجى إدخال رقم واتساب المكتبة الصحيح داخل app.js';
    return;
  }

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
};

// حفظ الطلب داخل قاعدة البيانات Supabase
$('checkout').onsubmit = async e => {
  e.preventDefault();

  if (!entries().length) {
    $('status').textContent = 'السلة فارغة!';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  $('status').textContent = 'جاري إرسال الطلب...';

  

const orderPayload = {
  customer_name: $('customer').value.trim(),
  customer_phone: $('phone').value.trim(),
  customer_address:
    $('fulfillment').value === 'delivery'
      ? $('address').value.trim()
      : 'استلام من المكتبة',
  delivery_method: $('fulfillment').value
};

const items = Object.entries(cart)
  .filter(([id, quantity]) => Number(quantity) > 0)
  .map(([id, quantity]) => ({
    product_id: id,
    quantity: Number(quantity)
  }));

if (!items.length) {
  $('status').textContent = 'السلة فارغة.';
  submitBtn.disabled = false;
  return;
}

// الاحتفاظ بنفس المعرف عند إعادة المحاولة
const requestPayload = JSON.stringify({
  ...orderPayload,
  items: [...items].sort((a, b) =>
    a.product_id.localeCompare(b.product_id)
  )
});

const storageKey = 'elgabry_pending_order';

let pending;

try {
  pending = JSON.parse(
    sessionStorage.getItem(storageKey) || 'null'
  );
} catch {
  pending = null;
}

if (!pending || pending.payload !== requestPayload) {
  pending = {
    id: crypto.randomUUID(),
    payload: requestPayload
  };

  sessionStorage.setItem(
    storageKey,
    JSON.stringify(pending)
  );
}

let orderId = null;
let error = null;

try {
  const result = await supabase.rpc(
    'place_store_order',
    {
      p_customer_name: orderPayload.customer_name,
      p_customer_phone: orderPayload.customer_phone,
      p_customer_address: orderPayload.customer_address,
      p_delivery_method: orderPayload.delivery_method,
      p_items: items,
      p_request_id: pending.id
    }
  );

  orderId = result.data;
  error = result.error;
} catch (err) {
  error = err;
}

submitBtn.disabled = false;

if (error) {
  console.error(error);

  $('status').textContent =
    'تعذر تأكيد الطلب. حاول مرة أخرى بنفس البيانات.';
} else {
  sessionStorage.removeItem(storageKey);

  $('status').textContent =
    'تم تسجيل طلبك بنجاح! رقم الطلب: ' + orderId;

  cart = {};
  $('checkout').reset();
  renderCart();

  await loadProducts();
}

};

// تشغيل جلب البيانات عند تحضير الصفحة
loadProducts();
