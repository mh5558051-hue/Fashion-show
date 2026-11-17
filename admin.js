import { database, auth, storage, ADMIN_UID } from './firebase-config.js';
import { ref, get, set, push, update, remove }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref as sRef, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let products = [];
let orders = [];
let users = [];
let settings = {};
let editingId = null;
let uploadedImageUrl = '';
let currentAdmin = null;

const bdt = n => '৳ ' + Number(n).toLocaleString('en-IN');

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.classList.remove('show'), 2800);
}

const googleProvider = new GoogleAuthProvider();

window.adminGoogleLogin = async function() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      alert('❌ আপনি অনুমোদিত অ্যাডমিন নন।');
      return;
    }
  } catch (e) { alert(e.message); }
};

window.adminEmailLogin = async function(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      alert('❌ আপনি অনুমোদিত অ্যাডমিন নন।');
      return;
    }
  } catch (e) { alert(e.message); }
};

window.adminForgotPassword = async function() {
  const email = prompt('অ্যাডমিন ইমেইল দিন:');
  if (!email) return;
  try {
    await sendPasswordResetEmail(auth, email);
    alert('রিসেট লিংক পাঠানো হয়েছে ✓');
  } catch (e) { alert(e.message); }
};

window.adminLogout = async function() {
  await signOut(auth);
  location.reload();
};

onAuthStateChanged(auth, (user) => {
  if (user && user.uid === ADMIN_UID) {
    currentAdmin = user;
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').classList.add('show');
    document.getElementById('adminAvatar').innerHTML = 
      user.photoURL ? `<img src="${user.photoURL}">` : 'A';
    document.getElementById('adminName').textContent = user.displayName || user.email.split('@')[0];
    initDashboard();
  } else if (user) {
    signOut(auth);
  } else {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboard').classList.remove('show');
  }
});

document.querySelectorAll('.sb-menu a[data-tab]').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelectorAll('.sb-menu a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
    document.getElementById('tab-' + a.dataset.tab).classList.add('active');
    const titles = { dashboard: 'ড্যাশবোর্ড', products: 'পণ্য', orders: 'অর্ডার', users: 'ইউজার', settings: 'সেটিংস' };
    const subs = { dashboard: 'স্টোরের নিয়ন্ত্রণ', products: 'পণ্য ম্যানেজ', orders: 'অর্ডার ও পেমেন্ট', users: 'নিবন্ধিত ইউজার', settings: 'সাইট কাস্টমাইজ' };
    document.getElementById('pageTitle').textContent = titles[a.dataset.tab];
    document.getElementById('pageSub').textContent = subs[a.dataset.tab];
    if (a.dataset.tab === 'orders') loadOrders();
    if (a.dataset.tab === 'users') loadUsers();
    if (a.dataset.tab === 'settings') loadSettingsForm();
  });
});

async function initDashboard() {
  await loadSettings();
  await loadProducts();
  await loadOrders();
  await loadUsers();
  updateStats();
}

async function loadSettings() {
  const snap = await get(ref(database, 'settings'));
  settings = snap.exists() ? snap.val() : {};
}

async function loadProducts() {
  const snap = await get(ref(database, 'products'));
  products = [];
  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([id, p]) => products.push({ id, ...p }));
  }
  renderProductsTable();
  renderRecent();
  updateStats();
}

async function loadOrders() {
  const snap = await get(ref(database, 'orders'));
  orders = [];
  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([id, o]) => orders.push({ id, ...o }));
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  renderOrders();
  updateStats();
}

async function loadUsers() {
  const snap = await get(ref(database, 'users'));
  users = [];
  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([uid, u]) => users.push({ uid, ...u }));
  }
  renderUsers();
  updateStats();
}

function updateStats() {
  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statOrders').textContent = orders.filter(o => o.status === 'pending').length;
  document.getElementById('statPendingPay').textContent = orders.filter(o => o.payment_status === 'pending_verification').length;
  const revenue = orders.filter(o => o.status !== 'cancelled' && o.payment_status === 'paid')
    .reduce((s, o) => s + (o.total || 0), 0);
  document.getElementById('statRevenue').textContent = bdt(revenue);
  document.getElementById('statUsers').textContent = users.length;

  const badge = document.getElementById('orderBadge');
  const total = orders.filter(o => o.status === 'pending').length + 
                orders.filter(o => o.payment_status === 'pending_verification').length;
  if (total > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = total;
  } else badge.style.display = 'none';
}

function renderRecent() {
  document.getElementById('recentProducts').innerHTML = products.slice(0, 5).map(p => `
    <tr>
      <td><div class="prod-name">${p.name}</div></td>
      <td><span class="pill ${p.category === 'Accessories' ? 'acc' : p.category.toLowerCase()}">${p.category}</span></td>
      <td>${bdt(p.price)}</td>
      <td>${p.stock}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:30px;color:#999">কোনো পণ্য নেই</td></tr>';
}

function renderProductsTable() {
  document.getElementById('prodCount').textContent = products.length;
  const tb = document.getElementById('productTable');
  if (!products.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#999">কোনো পণ্য নেই</td></tr>';
    return;
  }
  tb.innerHTML = products.map(p => `
    <tr>
      <td><img class="prod-thumb" src="${p.image}" onerror="this.src='https://via.placeholder.com/56'"></td>
      <td><div class="prod-name">${p.name}</div><div class="prod-sub">${p.badge || '—'}</div></td>
      <td><span class="pill ${p.category === 'Accessories' ? 'acc' : p.category.toLowerCase()}">${p.category}</span></td>
      <td>${bdt(p.price)}</td>
      <td style="${p.stock < 5 ? 'color:#c0392b;font-weight:600' : ''}">${p.stock}</td>
      <td>
        <button class="act-btn edit" onclick="editProduct('${p.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="act-btn del" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

function statusLabel(s) {
  return { pending: 'পেন্ডিং', confirmed: 'কনফার্মড', shipped: 'শিপড', delivered: 'ডেলিভারড', cancelled: 'বাতিল' }[s] || s;
}
function payLabel(m) {
  return { cod: 'ক্যাশ অন', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket' }[m] || m;
}
function payStatusLabel(s) {
  return { unpaid: 'অপরিশোধিত', pending_verification: 'ভেরিফিকেশন বাকি', paid: '✓ পরিশোধিত', rejected: '✗ বাতিল' }[s] || s;
}

function renderOrders() {
  const box = document.getElementById('ordersList');
  if (!orders.length) {
    box.innerHTML = '<div class="empty-tab"><i class="fa-solid fa-receipt"></i><h3>এখনো অর্ডার নেই</h3><p>গ্রাহক অর্ডার করলে দেখাবে।</p></div>';
    return;
  }
  box.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-head">
        <div>
          <h3>অর্ডার #${o.id.slice(-6).toUpperCase()}</h3>
          <div style="font-size:12px;color:#8a8478;margin-top:4px">${new Date(o.created_at).toLocaleString('en-GB')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:600;color:#b8935a">${bdt(o.total)}</div>
          <span class="pill ${o.status}">${statusLabel(o.status)}</span>
        </div>
      </div>
      <div class="pay-info">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:center">
          <div>
            <strong style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8478">পেমেন্ট</strong>
            <div style="font-size:15px;font-weight:500;margin-top:4px">${payLabel(o.payment_method)}</div>
            ${o.payment_method !== 'cod' ? `
              <div style="font-size:13px;color:#555;margin-top:6px">
                নম্বর: <strong>${o.payment_number}</strong><br>
                TrxID: <strong style="color:#b8935a">${o.transaction_id}</strong>
              </div>` : ''}
          </div>
          <div style="text-align:right">
            <span class="pay-status ${o.payment_status}">${payStatusLabel(o.payment_status)}</span>
            ${o.payment_status === 'pending_verification' ? `
              <div style="margin-top:10px">
                <button onclick="verifyPayment('${o.id}','paid')" style="padding:8px 16px;background:#2e8b57;color:#fff;border:none;cursor:pointer;font-size:12px;margin-right:6px">
                  <i class="fa-solid fa-check"></i> ভেরিফাই
                </button>
                <button onclick="verifyPayment('${o.id}','rejected')" style="padding:8px 16px;background:#c0392b;color:#fff;border:none;cursor:pointer;font-size:12px">
                  <i class="fa-solid fa-xmark"></i> বাতিল
                </button>
              </div>` : ''}
          </div>
        </div>
      </div>
      <div class="order-info">
        <div><strong>গ্রাহক</strong>${o.customer_name}</div>
        <div><strong>মোবাইল</strong>${o.phone}</div>
        <div><strong>ইমেইল</strong>${o.email || '—'}</div>
        <div><strong>ঠিকানা</strong>${o.address}</div>
      </div>
      <div class="order-items-list">
        ${(o.items || []).map(it => `
          <div class="order-item-row">
            <img src="${it.image}" onerror="this.src='https://via.placeholder.com/50'">
            <div><strong style="font-size:13px;color:#0e0e0e">${it.product_name}</strong>
              <span style="color:#8a8478"> × ${it.qty}</span></div>
            <div style="font-weight:500;color:#b8935a">${bdt(it.price * it.qty)}</div>
          </div>`).join('')}
      </div>
      <div class="order-actions">
        <select class="status-select" onchange="updateStatus('${o.id}', this.value)">
          ${['pending','confirmed','shipped','delivered','cancelled'].map(s =>
            `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
        </select>
        <button class="act-btn del" style="width:auto;padding:0 14px" onclick="deleteOrder('${o.id}')">
          <i class="fa-solid fa-trash"></i> ডিলিট
        </button>
      </div>
    </div>`).join('');
}

function renderUsers() {
  const tb = document.getElementById('usersTable');
  if (!users.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#999">কোনো ইউজার নেই</td></tr>';
    return;
  }
  tb.innerHTML = users.map(u => `
    <tr>
      <td>${u.photo ? `<img class="prod-thumb" src="${u.photo}">` : `<div style="width:56px;height:56px;background:#b8935a;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:600">${(u.name || 'U')[0].toUpperCase()}</div>`}</td>
      <td><div class="prod-name">${u.name || '—'}</div></td>
      <td>${u.email}</td>
      <td><span class="pill ${u.role === 'admin' ? 'men' : 'acc'}">${u.role}</span></td>
      <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}</td>
    </tr>`).join('');
}

window.openModal = function() {
  editingId = null;
  uploadedImageUrl = '';
  document.getElementById('modalTitle').textContent = 'নতুন পণ্য';
  ['pName','pPrice','pOldPrice','pBadge','pDesc','pDetails','pImgUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pStock').value = 100;
  document.getElementById('pCategory').value = 'Women';
  document.getElementById('pFile').value = '';
  document.getElementById('imgPreview').style.display = 'none';
  document.getElementById('modal').classList.add('show');
};

window.closeModal = function() {
  document.getElementById('modal').classList.remove('show');
  editingId = null;
};

window.previewUrl = function() {
  const url = document.getElementById('pImgUrl').value.trim();
  if (!url) return;
  const prev = document.getElementById('imgPreview');
  prev.src = url; prev.style.display = 'block';
  uploadedImageUrl = url;
};

window.uploadImage = async function(e) {
  const f = e.target.files[0];
  if (!f) return;
  const prev = document.getElementById('imgPreview');
  prev.src = URL.createObjectURL(f); prev.style.display = 'block';
  toast('আপলোড হচ্ছে...');
  try {
    const storageRef = sRef(storage, `products/${Date.now()}_${f.name}`);
    await uploadBytes(storageRef, f);
    uploadedImageUrl = await getDownloadURL(storageRef);
    toast('✓ ছবি আপলোড হয়েছে');
  } catch (err) {
    toast('ব্যর্থ: ' + err.message);
  }
};

window.editProduct = function(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  editingId = id;
  uploadedImageUrl = p.image;
  document.getElementById('modalTitle').textContent = 'পণ্য এডিট';
  document.getElementById('pName').value = p.name;
  document.getElementById('pCategory').value = p.category;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pOldPrice').value = p.old_price || 0;
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pBadge').value = p.badge || '';
  document.getElementById('pDesc').value = p.description || '';
  document.getElementById('pDetails').value = p.details || '';
  document.getElementById('pImgUrl').value = p.image || '';
  document.getElementById('pFile').value = '';
  const prev = document.getElementById('imgPreview');
  prev.src = p.image; prev.style.display = 'block';
  document.getElementById('modal').classList.add('show');
};

window.saveProduct = async function() {
  const name = document.getElementById('pName').value.trim();
  const price = Number(document.getElementById('pPrice').value);
  if (!name || !price) return toast('নাম ও দাম দিন');
  if (!uploadedImageUrl && !document.getElementById('pImgUrl').value.trim()) {
    return toast('ছবি আপলোড করুন বা URL দিন');
  }
  const image = uploadedImageUrl || document.getElementById('pImgUrl').value.trim();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = 'সেভ হচ্ছে...';

  try {
    const data = {
      name,
      category: document.getElementById('pCategory').value,
      price,
      old_price: Number(document.getElementById('pOldPrice').value) || 0,
      stock: Number(document.getElementById('pStock').value) || 0,
      badge: document.getElementById('pBadge').value,
      description: document.getElementById('pDesc').value,
      details: document.getElementById('pDetails').value,
      image,
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      await update(ref(database, `products/${editingId}`), data);
      toast('✓ আপডেট হয়েছে');
    } else {
      data.created_at = new Date().toISOString();
      await push(ref(database, 'products'), data);
      toast('✓ পণ্য যোগ হয়েছে');
    }
    closeModal();
    await initDashboard();
  } catch (e) {
    toast('ব্যর্থ: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'সেভ করুন';
  }
};

window.deleteProduct = async function(id) {
  if (!confirm('পণ্যটি মুছে ফেলবেন?')) return;
  try {
    await remove(ref(database, `products/${id}`));
    toast('✓ মুছে ফেলা হয়েছে');
    await initDashboard();
  } catch (e) { toast('ব্যর্থ: ' + e.message); }
};

window.updateStatus = async function(id, status) {
  try {
    await update(ref(database, `orders/${id}`), { status });
    toast('✓ আপডেট');
    await initDashboard();
  } catch (e) { toast('ব্যর্থ: ' + e.message); }
};

window.verifyPayment = async function(id, status) {
  if (!confirm(status === 'paid' ? 'পেমেন্ট ভেরিফাই?' : 'পেমেন্ট বাতিল করে অর্ডার ক্যানসেল?')) return;
  try {
    const updates = { payment_status: status };
    if (status === 'rejected') updates.status = 'cancelled';
    await update(ref(database, `orders/${id}`), updates);
    toast(status === 'paid' ? '✓ ভেরিফাইড' : '✗ বাতিল');
    await initDashboard();
  } catch (e) { toast('ব্যর্থ: ' + e.message); }
};

window.deleteOrder = async function(id) {
  if (!confirm('অর্ডার মুছবেন?')) return;
  try {
    await remove(ref(database, `orders/${id}`));
    toast('✓ মুছে ফেলা');
    await initDashboard();
  } catch (e) { toast('ব্যর্থ: ' + e.message); }
};

async function loadSettingsForm() {
  const snap = await get(ref(database, 'settings'));
  settings = snap.exists() ? snap.val() : {};
  Object.entries(settings).forEach(([k, v]) => {
    const el = document.getElementById('s_' + k);
    if (el) el.value = v;
  });
}

window.saveSettings = async function(e) {
  e.preventDefault();
  const data = {};
  e.target.querySelectorAll('input, textarea').forEach(el => {
    if (el.id && el.id.startsWith('s_')) {
      data[el.id.slice(2)] = el.value;
    }
  });
  try {
    await update(ref(database, 'settings'), data);
    toast('✓ সেটিংস সেভ হয়েছে');
  } catch (err) { toast('ব্যর্থ: ' + err.message); }
};
