import { database, auth, ADMIN_UID } from './firebase-config.js';
import { ref, get, set, push, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let products = [];
let settings = {};
let cart = JSON.parse(localStorage.getItem('luxe_cart') || '[]');
let currentFilter = 'All';
let currentProduct = null;
let currentUser = null;
let userOrders = [];
let zoom = 1, rotation = 0, translateX = 0, translateY = 0;
let authMode = 'login';

const bdt = n => '৳ ' + Number(n).toLocaleString('en-IN');
const catLabel = c => ({ Women: 'উইমেন', Men: 'মেন', Accessories: 'অ্যাকসেসরিজ' }[c] || c);

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.classList.remove('show'), 2800);
}

// ========== LOAD SETTINGS ==========
async function loadSettings() {
  try {
    const snapshot = await get(ref(database, 'settings'));
    settings = snapshot.exists() ? snapshot.val() : {};
    applySettings();
  } catch (e) { console.error(e); }
}

function applySettings() {
  const siteName = settings.site_name || 'LUXE';
  const logoHtml = siteName.charAt(0) + '<span>' + siteName.slice(1) + '</span>';
  document.getElementById('siteLogo').innerHTML = logoHtml;
  document.getElementById('footerLogo').innerHTML = logoHtml;
  document.title = siteName + ' | ' + (settings.site_tagline || 'প্রিমিয়াম ফ্যাশন');

  document.getElementById('topbar').textContent = settings.topbar_text || 'স্বাগতম';
  document.getElementById('heroEyebrow').textContent = settings.hero_eyebrow || '';
  document.getElementById('heroTitle').innerHTML = 
    `${settings.hero_title_line1 || ''} <em>${settings.hero_title_em || ''}</em><br>${settings.hero_title_line2 || ''}`;
  document.getElementById('heroDesc').textContent = settings.hero_description || '';
  document.getElementById('heroBtn').textContent = settings.hero_button || 'কিনুন';
  if (settings.hero_image) document.getElementById('heroImage').src = settings.hero_image;

  document.getElementById('sectionTag').textContent = settings.section_tag || '';
  document.getElementById('sectionTitle').innerHTML = 
    `${settings.section_title || ''} <em>${settings.section_title_em || ''}</em>`;

  document.getElementById('footerAbout').textContent = settings.footer_about || '';
  document.getElementById('footPhone').textContent = settings.footer_phone || '';
  document.getElementById('footEmail').textContent = settings.footer_email || '';
  document.getElementById('footAddress').textContent = settings.footer_address || '';
  document.getElementById('footCopyright').textContent = settings.footer_copyright || '';
}

// ========== LOAD PRODUCTS ==========
async function loadProducts() {
  try {
    const snapshot = await get(ref(database, 'products'));
    products = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.entries(data).forEach(([id, p]) => products.push({ id, ...p }));
    }
    renderProducts();
  } catch (e) {
    document.getElementById('productGrid').innerHTML = '<div class="empty-state">ডেটা লোড হয়নি</div>';
  }
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const filtered = currentFilter === 'All' ? products : products.filter(p => p.category === currentFilter);
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">কোনো পণ্য নেই</div>';
    return;
  }
  grid.innerHTML = filtered.map(p => {
    const out = (p.stock || 0) <= 0;
    return `
      <div class="product-card" onclick="openPd('${p.id}')">
        <div class="p-img">
          ${p.badge ? `<span class="p-badge">${p.badge}</span>` : ''}
          <img src="${p.image}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/400x500?text=No+Image'">
          ${out ? `<div class="p-quick" style="background:#c0392b;transform:translateY(0)">স্টক শেষ</div>` : ''}
        </div>
        <div class="p-info">
          <div class="p-cat">${catLabel(p.category)}</div>
          <h3>${p.name}</h3>
          <div class="p-price">${bdt(p.price)} ${p.old_price ? `<span class="old">${bdt(p.old_price)}</span>` : ''}</div>
        </div>
      </div>`;
  }).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderProducts();
  });
});

// ========== PRODUCT DETAIL (Requires Login) ==========
window.openPd = function(id) {
  if (!currentUser) {
    toast('প্রোডাক্ট দেখতে লগইন করুন');
    openAuth();
    return;
  }

  const p = products.find(x => x.id === id);
  if (!p) return;
  currentProduct = p;
  zoom = 1; rotation = 0; translateX = 0; translateY = 0;

  document.getElementById('pdImage').src = p.image;
  document.getElementById('pdImage').style.transform = '';
  document.getElementById('pdCat').textContent = catLabel(p.category);
  document.getElementById('pdTitle').textContent = p.name;
  document.getElementById('pdPrice').innerHTML = bdt(p.price) + (p.old_price ? `<span class="old">${bdt(p.old_price)}</span>` : '');
  document.getElementById('pdDesc').textContent = p.description || 'বিবরণ নেই।';

  const detailsBox = document.getElementById('pdDetails');
  if (p.details) {
    detailsBox.style.display = 'block';
    document.getElementById('pdDetailsText').textContent = p.details;
  } else detailsBox.style.display = 'none';

  const stockEl = document.getElementById('pdStock');
  const btn = document.getElementById('pdAddBtn');
  if ((p.stock || 0) <= 0) {
    stockEl.classList.add('out');
    document.getElementById('pdStockText').textContent = 'স্টক শেষ';
    btn.disabled = true; btn.textContent = 'স্টক শেষ';
  } else {
    stockEl.classList.remove('out');
    document.getElementById('pdStockText').textContent = `স্টকে আছে: ${p.stock} টি`;
    btn.disabled = false; btn.textContent = 'কার্টে যোগ করুন';
  }

  document.getElementById('pdOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.closePd = function() {
  document.getElementById('pdOverlay').classList.remove('show');
  document.body.style.overflow = '';
  zoom = 1; rotation = 0; translateX = 0; translateY = 0;
  document.getElementById('pdImage').style.transform = '';
};

document.getElementById('pdOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'pdOverlay') closePd();
});

function applyTransform() {
  document.getElementById('pdImage').style.transform = 
    `scale(${zoom}) rotate(${rotation}deg) translate(${translateX / zoom}px, ${translateY / zoom}px)`;
}
window.zoomIn = () => { zoom = Math.min(zoom + 0.25, 3); applyTransform(); };
window.zoomOut = () => { zoom = Math.max(zoom - 0.25, 0.5); applyTransform(); };
window.resetZoom = () => { zoom = 1; rotation = 0; translateX = 0; translateY = 0; applyTransform(); };
window.rotateImg = () => { rotation = (rotation + 90) % 360; applyTransform(); };
window.zoomWheel = (e) => { e.preventDefault(); e.deltaY < 0 ? zoomIn() : zoomOut(); };

let dragging = false, startX = 0, startY = 0;
window.startDrag = (e) => {
  if (zoom <= 1) return;
  dragging = true;
  startX = e.clientX - translateX;
  startY = e.clientY - translateY;
  document.getElementById('pdImage').style.cursor = 'grabbing';
};
document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  translateX = e.clientX - startX;
  translateY = e.clientY - startY;
  applyTransform();
});
document.addEventListener('mouseup', () => {
  dragging = false;
  const img = document.getElementById('pdImage');
  if (img) img.style.cursor = zoom > 1 ? 'grab' : 'zoom-in';
});

window.addFromDetail = () => {
  if (currentProduct) {
    addToCart(currentProduct.id);
    closePd();
  }
};

// ========== CART ==========
function saveCart() {
  localStorage.setItem('luxe_cart', JSON.stringify(cart));
  updateCartUI();
}

window.addToCart = function(id) {
  if (!currentUser) {
    toast('কার্টে যোগ করতে লগইন করুন');
    openAuth();
    return;
  }

  const p = products.find(x => x.id === id);
  if (!p || (p.stock || 0) <= 0) return toast('স্টক শেষ!');
  const ex = cart.find(i => i.id === id);
  if (ex) {
    if (ex.qty + 1 > p.stock) return toast('স্টকের বেশি যোগ করা যাবে না');
    ex.qty++;
  } else cart.push({ id, qty: 1 });
  saveCart();
  toast('✓ কার্টে যোগ হয়েছে');
  openCart();
};

window.removeFromCart = function(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
};

window.changeQty = function(id, delta) {
  const item = cart.find(i => i.id === id);
  const p = products.find(x => x.id === id);
  if (!item) return;
  const n = item.qty + delta;
  if (n <= 0) return removeFromCart(id);
  if (n > p.stock) return toast('স্টকের বেশি নয়');
  item.qty = n;
  saveCart();
};

function updateCartUI() {
  document.getElementById('cartCount').textContent = cart.reduce((s, i) => s + i.qty, 0);
  const box = document.getElementById('cartItems');
  if (!cart.length) {
    box.innerHTML = '<div class="cart-empty"><i class="fa-solid fa-bag-shopping"></i><p>কার্ট খালি</p></div>';
    document.getElementById('cartTotal').textContent = '৳ ০';
    return;
  }
  let total = 0;
  box.innerHTML = cart.map(i => {
    const p = products.find(x => x.id === i.id);
    if (!p) return '';
    total += p.price * i.qty;
    return `<div class="cart-item">
      <img src="${p.image}" onerror="this.src='https://via.placeholder.com/80'">
      <div class="cart-item-info">
        <h4>${p.name}</h4>
        <div class="price">${bdt(p.price)}</div>
        <div class="qty">
          <button onclick="changeQty('${p.id}',-1)">−</button>
          <span>${i.qty}</span>
          <button onclick="changeQty('${p.id}',1)">+</button>
        </div>
      </div>
      <i class="fa-solid fa-trash-can remove" onclick="removeFromCart('${p.id}')"></i>
    </div>`;
  }).join('');
  document.getElementById('cartTotal').textContent = bdt(total);
}

window.openCart = function() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('overlay').classList.add('show');
};
window.closeCart = function() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('checkoutForm').classList.remove('open');
};
document.getElementById('cartIcon').addEventListener('click', openCart);
document.getElementById('closeCart').addEventListener('click', closeCart);
document.getElementById('overlay').addEventListener('click', closeCart);

window.toggleCheckout = function() {
  if (!cart.length) return toast('কার্ট খালি!');
  if (!currentUser) {
    closeCart();
    toast('অর্ডার করতে লগইন করুন');
    openAuth();
    return;
  }
  document.getElementById('checkoutForm').classList.toggle('open');
  if (document.getElementById('checkoutForm').classList.contains('open')) {
    document.getElementById('cName').value = currentUser.displayName || '';
    document.getElementById('cEmail').value = currentUser.email || '';
    togglePayment();
  }
};

window.togglePayment = function() {
  const method = document.querySelector('input[name="payMethod"]:checked').value;
  const details = document.getElementById('payDetails');
  if (method === 'cod') details.classList.remove('show');
  else {
    details.classList.add('show');
    document.getElementById('payTo').textContent = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket' }[method];
    const total = cart.reduce((s, i) => {
      const p = products.find(x => x.id === i.id);
      return s + (p ? p.price * i.qty : 0);
    }, 0);
    document.getElementById('payAmount').textContent = bdt(total);
    document.getElementById('payNum').textContent = settings['payment_' + method + '_number'] || '01700000000';
  }
};

// ========== PLACE ORDER ==========
window.placeOrder = async function() {
  if (!currentUser) {
    closeCart();
    toast('অর্ডার করতে লগইন করুন');
    openAuth();
    return;
  }

  const name = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const address = document.getElementById('cAddress').value.trim();
  const method = document.querySelector('input[name="payMethod"]:checked').value;

  if (!name) return toast('নাম দিন');
  if (!phone || phone.length < 11) return toast('সঠিক মোবাইল দিন');
  if (!address) return toast('ঠিকানা দিন');

  let payNum = '', trxId = '';
  if (method !== 'cod') {
    payNum = document.getElementById('cPayNumber').value.trim();
    trxId = document.getElementById('cTrxId').value.trim();
    if (!payNum || payNum.length < 11) return toast('পেমেন্ট নম্বর দিন');
    if (!trxId) return toast('TrxID দিন');
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'অর্ডার হচ্ছে...';

  try {
    let total = 0;
    const items = cart.map(i => {
      const p = products.find(x => x.id === i.id);
      total += p.price * i.qty;
      return {
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        qty: i.qty,
        image: p.image
      };
    });

    const orderData = {
      customer_name: name,
      phone,
      email: email || currentUser.email || '',
      address,
      user_uid: currentUser.uid,
      user_email: currentUser.email,
      total,
      payment_method: method,
      payment_number: payNum,
      transaction_id: trxId,
      payment_status: method === 'cod' ? 'unpaid' : 'pending_verification',
      status: 'pending',
      items,
      created_at: new Date().toISOString()
    };

    const ordersRef = ref(database, 'orders');
    const newOrderRef = push(ordersRef);
    await set(newOrderRef, orderData);

    for (const item of items) {
      const p = products.find(x => x.id === item.product_id);
      const newStock = Math.max(0, (p.stock || 0) - item.qty);
      await update(ref(database, `products/${item.product_id}`), { stock: newStock });
    }

    const orderId = newOrderRef.key.slice(-6).toUpperCase();
    let msg = `🎉 ধন্যবাদ ${name}!\n\nঅর্ডার #${orderId} কনফার্ম।\nমোট: ${bdt(total)}`;
    if (method !== 'cod') msg += `\n\n📱 পেমেন্ট: ${method.toUpperCase()}\nTrxID: ${trxId}\n\n২৪ ঘণ্টায় ভেরিফাই হবে।`;
    else msg += `\n\n💵 ডেলিভারির সময় পেমেন্ট করুন।`;

    toast(`✓ অর্ডার #${orderId} সফল!`);
    cart = [];
    saveCart();
    closeCart();
    document.getElementById('checkoutForm').classList.remove('open');
    ['cName','cPhone','cEmail','cAddress','cPayNumber','cTrxId'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    await loadProducts();
    setTimeout(() => alert(msg), 500);
  } catch (e) {
    console.error(e);
    toast('ব্যর্থ: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'অর্ডার কনফার্ম করুন';
  }
};

// ========== AUTH ==========
const googleProvider = new GoogleAuthProvider();

window.openAuth = function() {
  document.getElementById('authOverlay').classList.add('show');
};
window.closeAuth = function() {
  document.getElementById('authOverlay').classList.remove('show');
  clearAuthMsg();
};
document.getElementById('authOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'authOverlay') closeAuth();
});

function showAuthMsg(msg, type = 'error') {
  const el = document.getElementById('authMsg');
  el.textContent = msg;
  el.className = 'auth-msg ' + type;
}
function clearAuthMsg() {
  document.getElementById('authMsg').className = 'auth-msg';
}

window.switchAuthMode = function(mode) {
  authMode = mode;
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const nameField = document.getElementById('authName');
  const submitBtn = document.getElementById('submitAuthBtn');
  const googleBtnText = document.getElementById('googleBtnText');

  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    nameField.style.display = 'none';
    submitBtn.textContent = 'লগইন করুন';
    googleBtnText.textContent = 'Google দিয়ে লগইন';
  } else {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    nameField.style.display = 'block';
    submitBtn.textContent = 'অ্যাকাউন্ট তৈরি করুন';
    googleBtnText.textContent = 'Google দিয়ে সাইন আপ';
  }
  clearAuthMsg();
};

window.firebaseGoogleLogin = async function() {
  clearAuthMsg();
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserToDb(result.user);
    closeAuth();
    toast(`স্বাগতম ${result.user.displayName || ''}!`);
  } catch (e) {
    showAuthMsg(e.message);
  }
};

window.submitAuth = async function() {
  clearAuthMsg();
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const name = document.getElementById('authName').value.trim();

  if (!email) return showAuthMsg('ইমেইল দিন');
  if (!pass || pass.length < 6) return showAuthMsg('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর');
  if (authMode === 'signup' && !name) return showAuthMsg('নাম দিন');

  const btn = document.getElementById('submitAuthBtn');
  btn.disabled = true;
  btn.textContent = 'অপেক্ষা করুন...';

  try {
    if (authMode === 'login') {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      await syncUserToDb(result.user);
      closeAuth();
      toast('লগইন সফল!');
    } else {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(result.user, { displayName: name });
      await syncUserToDb(result.user);
      closeAuth();
      toast('অ্যাকাউন্ট তৈরি সফল!');
    }
  } catch (e) {
    let msg = e.message;
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password')
      msg = 'ইমেইল বা পাসওয়ার্ড ভুল';
    else if (e.code === 'auth/user-not-found')
      msg = 'এই ইমেইলে অ্যাকাউন্ট নেই';
    else if (e.code === 'auth/email-already-in-use')
      msg = 'এই ইমেইলে অ্যাকাউন্ট আছে, লগইন করুন';
    else if (e.code === 'auth/invalid-email')
      msg = 'সঠিক ইমেইল দিন';
    else if (e.code === 'auth/weak-password')
      msg = 'পাসওয়ার্ড দুর্বল';
    showAuthMsg(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'লগইন করুন' : 'অ্যাকাউন্ট তৈরি করুন';
  }
};

window.firebaseForgotPassword = async function() {
  clearAuthMsg();
  const email = document.getElementById('authEmail').value.trim();
  if (!email) return showAuthMsg('আগে ইমেইল লিখুন');
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMsg('✓ রিসেট লিংক ইমেইলে পাঠানো হয়েছে', 'success');
  } catch (e) {
    let msg = e.message;
    if (e.code === 'auth/user-not-found') msg = 'এই ইমেইলে অ্যাকাউন্ট নেই';
    showAuthMsg(msg);
  }
};

window.firebaseLogout = async function() {
  if (!confirm('লগআউট করবেন?')) return;
  await signOut(auth);
  document.getElementById('userMenu').classList.remove('show');
  closeProfile();
  closeCart();
  toast('লগআউট হয়েছে');
};

async function syncUserToDb(user) {
  const userRef = ref(database, `users/${user.uid}`);
  const snapshot = await get(userRef);
  const userData = {
    uid: user.uid,
    name: user.displayName || user.email.split('@')[0],
    email: user.email,
    photo: user.photoURL || '',
    last_login: new Date().toISOString()
  };
  if (!snapshot.exists()) {
    userData.created_at = new Date().toISOString();
    userData.role = 'customer';
  } else {
    userData.role = snapshot.val().role || 'customer';
    userData.created_at = snapshot.val().created_at;
  }
  await set(userRef, userData);
}
loadSettings();
loadProducts();
