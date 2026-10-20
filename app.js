import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
const WHATSAPP = '201012993309';
const money = n => `${Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`;
let products = [], cart = {}, category = 'الكل', user = null, sending = false, authReady = false;
const pendingKeyFor = uid => `elgabry_checkout_pending_v3_${uid}`;
let ordersLoadToken = 0;
const escapeStatus = (message, kind = '') => { $('status').textContent = message; $('status').className = `feedback ${kind}`; };

async function loadProducts() {
  $('grid').innerHTML = '<p class="empty">جاري تحميل المنتجات...</p>';
  const { data, error } = await supabase.from('products').select('id,name,price,stock,category,image_url,is_active,created_at').eq('is_active', true).order('created_at', { ascending: false });
  if (error) { console.error(error); $('grid').innerHTML = '<p class="empty">تعذر تحميل المنتجات. حاول تحديث الصفحة.</p>'; return; }
  products = data || [];
  cart = Object.fromEntries(Object.entries(cart).filter(([id]) => products.some(p => p.id === id)));
  renderCategories(); renderProducts(); renderCart();
}
function renderCategories() {
  const list = ['الكل', ...new Set(products.map(p => p.category).filter(Boolean))];
  if (!list.includes(category)) category = 'الكل';
  $('categories').replaceChildren();
  for (const c of list) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = c;
    b.className = c === category ? 'active' : '';
    b.onclick = () => { category = c; renderCategories(); renderProducts(); };
    $('categories').append(b);
  }
}
function renderProducts() {
  const q = $('search').value.trim().toLocaleLowerCase();
  const filtered = products.filter(p => (category === 'الكل' || p.category === category) && String(p.name || '').toLocaleLowerCase().includes(q));
  $('productCount').textContent = `(${filtered.length})`;
  const grid = $('grid'); grid.replaceChildren();
  if (!filtered.length) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = 'مفيش منتجات مطابقة حاليًا. جرّب قسم تاني أو غيّر البحث.'; grid.append(e); return; }
  for (const p of filtered) {
    const card = document.createElement('article'); card.className = 'product';
    const visual = document.createElement('div'); visual.className = 'visual';
    if (p.image_url && /^https:\/\//i.test(p.image_url)) {
      const img = document.createElement('img'); img.src = p.image_url; img.alt = p.name; img.loading = 'lazy';
      img.onerror = () => { visual.textContent = '📚'; }; visual.append(img);
    } else visual.textContent = '📚';
    const details = document.createElement('div'); details.className = 'details';
    const cat = document.createElement('span'); cat.className = 'category-name'; cat.textContent = p.category || 'منتجات المكتبة';
    const name = document.createElement('h3'); name.textContent = p.name;
    const price = document.createElement('p'); price.className = 'price'; price.textContent = money(p.price);
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = p.stock > 0 ? 'أضف للسلة + ' : 'غير متوفر'; btn.disabled = p.stock <= 0;
    btn.onclick = () => { if (!requireLogin()) return; if ((cart[p.id] || 0) >= p.stock) { alert('الكمية المطلوبة غير متوفرة'); return; } cart[p.id] = (cart[p.id] || 0) + 1; renderCart(); btn.textContent = '✓ تمت الإضافة'; setTimeout(() => { if (btn.isConnected) btn.textContent = 'أضف للسلة +'; }, 950); };
    details.append(cat, name, price, btn); card.append(visual, details); grid.append(card);
  }
}
function cartProducts() { return products.filter(p => (cart[p.id] || 0) > 0); }
function total() { return cartProducts().reduce((sum, p) => sum + Number(p.price) * cart[p.id], 0); }
function renderCart() {
  $('count').textContent = Object.values(cart).reduce((a, b) => a + Number(b), 0);
  const box = $('cartItems'); box.replaceChildren();
  if (!cartProducts().length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'السلة فاضية حاليًا. اختار منتجات الأول 🛒'; box.append(p); }
  for (const p of cartProducts()) {
    const line = document.createElement('div'); line.className = 'line';
    const description = document.createElement('span'); description.textContent = `${p.name} — ${money(Number(p.price) * cart[p.id])}`;
    const controls = document.createElement('div'); controls.className = 'qty-actions';
    const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `تقليل ${p.name}`);
    minus.onclick = () => { if (--cart[p.id] <= 0) delete cart[p.id]; renderCart(); };
    const qty = document.createElement('b'); qty.textContent = cart[p.id];
    const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', `زيادة ${p.name}`);
    plus.onclick = () => { if (cart[p.id] >= p.stock) return alert('الكمية المطلوبة غير متوفرة'); cart[p.id]++; renderCart(); };
    controls.append(minus, qty, plus); line.append(description, controls); box.append(line);
  }
  $('total').textContent = `الإجمالي: ${money(total())} (بدون مصاريف التوصيل)`;
}
function payload() {
  return {
    customer_name: $('customer').value.trim(),
    customer_phone: $('phone').value.trim(),
    customer_address: $('fulfillment').value === 'delivery' ? $('address').value.trim() : 'استلام من المكتبة',
    delivery_method: $('fulfillment').value
  };
}
function items() { return Object.entries(cart).filter(([, qty]) => Number(qty) > 0).map(([product_id, quantity]) => ({ product_id, quantity: Number(quantity) })).sort((a,b) => a.product_id.localeCompare(b.product_id)); }
function whatsappMessage() {
  const p = payload();
  return `طلب من مكتبة الجبري\nالاسم: ${p.customer_name}\nالموبايل: ${p.customer_phone}\nطريقة الاستلام: ${p.delivery_method === 'pickup' ? 'استلام من المكتبة' : 'توصيل'}\nالعنوان: ${p.customer_address}\n\nالمنتجات:\n${cartProducts().map(product => `• ${product.name} × ${cart[product.id]} = ${money(Number(product.price) * cart[product.id])}`).join('\n')}\n\nالإجمالي المبدئي: ${money(total())}\nملاحظات: ${$('notes').value.trim() || 'لا يوجد'}\n(رسالة استفسار وليست طلبًا مؤكدًا داخل المتجر)`;
}
$('whatsapp').onclick = () => {
  if (!requireLogin()) return;
  if (!items().length) return escapeStatus('أضف منتجًا للسلة الأول', 'error');
  if (!$('checkout').reportValidity()) return;
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(whatsappMessage())}`, '_blank', 'noopener,noreferrer');
};
$('checkout').onsubmit = async event => {
  event.preventDefault();
  if (!requireLogin()) return;
  if (sending) return;
  const chosen = items(); if (!chosen.length) return escapeStatus('السلة فارغة', 'error');
  if (!$('checkout').reportValidity()) return;
  const info = payload();
  const fingerprint = JSON.stringify({ ...info, items: chosen });
  const pendingKey = pendingKeyFor(user.id);
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); } catch {}
  if (!pending || pending.fingerprint !== fingerprint) {
    pending = { id: crypto.randomUUID(), fingerprint };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
  }
  sending = true; $('submitOrder').disabled = true; escapeStatus('جاري تسجيل طلبك...');
  try {
    const { data, error } = await supabase.rpc('place_store_order_for_user', {
      p_customer_name: info.customer_name, p_customer_phone: info.customer_phone,
      p_delivery_method: info.delivery_method, p_customer_address: info.customer_address,
      p_items: chosen, p_request_id: pending.id
    });
    if (error) throw error;
    sessionStorage.removeItem(pendingKey);
    cart = {}; renderCart(); $('checkout').reset(); $('addressBox').hidden = true;
    escapeStatus(`تم تسجيل طلبك بنجاح! رقم الطلب: ${data}. احتفظ بالرقم للمتابعة.`, 'success');
    await loadProducts();
    await loadMyOrders();
  } catch (err) {
    console.error('Checkout error:', err);
    const msg = String(err?.message || '');
    if (msg.includes('ORDER_RATE_LIMIT_10_MIN')) escapeStatus('وصلت للحد المؤقت: 3 طلبات خلال 10 دقائق. جرّب بعد شوية أو تواصل مع المكتبة.', 'error');
    else if (msg.includes('ORDER_RATE_LIMIT_DAY')) escapeStatus('وصلت للحد اليومي: 12 طلب خلال 24 ساعة. تواصل مع المكتبة للمساعدة.', 'error');
    else escapeStatus('تعذر تأكيد الطلب. لو مش متأكد إنه اتسجل، افتح «طلباتي» قبل ما تحاول تاني.', 'error');
  }
  finally { sending = false; $('submitOrder').disabled = false; }
};
$('search').addEventListener('input', renderProducts);
$('reload').onclick = loadProducts;
$('cartBtn').onclick = () => { if (!requireLogin()) return; renderCart(); $('cartDialog').showModal(); };
$('closeCart').onclick = () => $('cartDialog').close();
$('fulfillment').onchange = () => { const delivery = $('fulfillment').value === 'delivery'; $('addressBox').hidden = !delivery; $('address').required = delivery; };
const accountDialog = $('accountDialog');
function showAccount() {
  $('authStatus').textContent = '';
  if (!accountDialog.open) accountDialog.showModal();
}
function requireLogin() {
  if (user) return true;
  showAccount();
  $('authStatus').textContent = 'لازم تسجّل دخولك بحساب Google الأول.';
  return false;
}
// Account button handled by ui-controls.js independently of Supabase.
$('closeAccount').onclick = () => {
  if (!user) {
    $('authStatus').textContent = 'تسجيل الدخول مطلوب للمتابعة.';
    return;
  }
  accountDialog.close();
};
accountDialog.addEventListener('cancel', event => {
  if (!user) event.preventDefault();
});
function renderAccount() {
  $('signedOutPanel').hidden = !!user;
  $('signedInPanel').hidden = !user;
  $('accountLabel').textContent = user ? 'حسابي ✓' : 'تسجيل الدخول';
  $('userInfo').textContent = user ? `أهلًا ${user.user_metadata?.full_name || user.email || 'بيك'} 👋` : '';
  if (user && !$('customer').value.trim()) $('customer').value = user.user_metadata?.full_name || user.user_metadata?.name || '';
  if (authReady && !user) showAccount();
  if (user && accountDialog.open) accountDialog.close();
  if (user) loadMyOrders();
}
async function login() {
  $('googleLogin').disabled = true;
  $('authStatus').textContent = 'جاري تحويلك إلى Google...';
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}${location.pathname}` }
    });
    if (error) throw error;
  } catch (error) {
    console.error('Google sign in:', error);
    $('authStatus').textContent = 'تعذر فتح Google. راجع إعدادات Google Provider وRedirect URLs في Supabase. التفاصيل: ' + (error.message || 'خطأ غير معروف');
    $('googleLogin').disabled = false;
  }
}
$('googleLogin').onclick = login;
$('logout').onclick = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) $('authStatus').textContent = error.message;
};

// طلبات العميل: RLS في قاعدة البيانات هو الذي يحدد صاحب الطلب.
async function loadMyOrders() {
  const token = ++ordersLoadToken;
  const accountId = user?.id;
  const panel = $('myOrdersList');
  if (!panel) return;
  panel.replaceChildren();
  if (!user) { panel.textContent = 'سجّل دخولك لعرض طلباتك.'; return; }
  panel.textContent = 'جاري تحميل طلباتك...';
  const { data, error } = await supabase.from('orders')
    .select('id,created_at,status,total,delivery_method,order_items(product_name,quantity,unit_price)')
    .order('created_at', { ascending: false }).limit(30);
  if (token !== ordersLoadToken || accountId !== user?.id) return;
  panel.replaceChildren();
  if (error) { console.error('My orders:',error); panel.textContent = 'تعذر تحميل طلباتك. حاول مرة أخرى.'; return; }
  if (!data?.length) { panel.textContent = 'مفيش طلبات مرتبطة بحسابك لحد دلوقتي.'; return; }
  const labels = {pending:'جديد',confirmed:'مؤكد',shipped:'جاري التوصيل',completed:'مكتمل',cancelled:'ملغي'};
  for (const order of data) {
    const card = document.createElement('article'); card.className = 'my-order-card';
    const head = document.createElement('strong');
    head.textContent = `طلب ${String(order.id).slice(0,8)} • ${labels[order.status] || order.status} • ${money(order.total)}`;
    const date = document.createElement('small');
    date.textContent = new Date(order.created_at).toLocaleString('ar-EG');
    card.append(head,date);
    for (const item of order.order_items || []) {
      const line = document.createElement('div');
      line.textContent = `${item.product_name} × ${item.quantity} — ${money(item.unit_price)}`;
      card.append(line);
    }
    panel.append(card);
  }
}
$('refreshMyOrders')?.addEventListener('click',loadMyOrders);

// Theme toggle is handled by ui-controls.js.
supabase.auth.onAuthStateChange((_event, session) => {
  const nextUser = session?.user || null;
  const changed = user?.id !== nextUser?.id;
  user = nextUser;
  if (changed) {
    ordersLoadToken++;
    const panel = $('myOrdersList');
    if (panel) panel.textContent = user ? 'جاري تحميل طلباتك...' : 'سجّل دخولك لعرض طلباتك.';
    cart = {}; renderCart();
    $('checkout').reset();
    $('addressBox').hidden = true;
    escapeStatus('');
  }
  if (authReady) renderAccount();
});
try {
  const { data: sessionResult, error } = await supabase.auth.getSession();
  if (error) throw error;
  user = sessionResult?.session?.user || null;
} catch (error) {
  console.error('Session error:', error);
  $('authStatus').textContent = 'تعذر التحقق من تسجيل الدخول. تأكد من الاتصال بالإنترنت.';
}
authReady = true;
renderAccount();
loadProducts();
