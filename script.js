// ===== GROUTGROVE — MAIN SCRIPT v3.0 =====
// Security + Input Sanitization + Cart Fix

const CART_KEY = 'groutgrove_cart';

// ===== INPUT SANITIZATION =====
function sanitizeInput(str) {
  if(!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;')
    .replace(/\//g,'&#x2F;')
    .trim()
    .substring(0, 500);
}

function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g,'');
  return cleaned.length === 10 && /^[6-9]/.test(cleaned);
}

function validatePincode(pin) {
  return /^\d{6}$/.test(pin.trim());
}

function validateEmail(email) {
  if(!email) return true; // Optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Rate limiting
const rateLimits = {};
function checkRateLimit(key, maxAttempts=5, windowMs=60000) {
  const now = Date.now();
  if(!rateLimits[key]) rateLimits[key] = [];
  rateLimits[key] = rateLimits[key].filter(t => now-t < windowMs);
  if(rateLimits[key].length >= maxAttempts) return false;
  rateLimits[key].push(now);
  return true;
}

// ===== NAVBAR =====
function toggleNav() {
  const nav = document.getElementById('navLinks');
  if(nav) nav.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  const nav = document.getElementById('navLinks');
  const btn = document.querySelector('.hamburger');
  if(nav && nav.classList.contains('open') && !nav.contains(e.target) && e.target !== btn) {
    nav.classList.remove('open');
  }
});

// ===== TOAST =====
function showToast(msg, duration=3000) {
  let t = document.querySelector('.toast');
  if(!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = sanitizeInput(msg);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ===== CART — Persistent + Login Merge =====
function getCart() {
  try {
    const nxUser = JSON.parse(localStorage.getItem('nx_user'));
    if(nxUser && nxUser.phone) {
      const userCart = localStorage.getItem(CART_KEY+'_'+nxUser.phone);
      if(userCart) return JSON.parse(userCart);
    }
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch(e) { return []; }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    localStorage.setItem('nirmanx_cart', JSON.stringify(cart));
    const nxUser = JSON.parse(localStorage.getItem('nx_user'));
    if(nxUser && nxUser.phone) {
      localStorage.setItem(CART_KEY+'_'+nxUser.phone, JSON.stringify(cart));
    }
    updateCartBadge();
  } catch(e) {}
}

function updateCartBadge() {
  const cart = getCart();
  const total = cart.reduce((s,i) => s+(i.qty||1), 0);
  document.querySelectorAll('.cart-badge').forEach(b => {
    b.textContent = total;
    b.style.display = total > 0 ? 'inline' : 'none';
  });
}

// Merge carts on login
function mergeCartsOnLogin() {
  const nxUser = JSON.parse(localStorage.getItem('nx_user'));
  if(!nxUser || !nxUser.phone) return;
  const guestCart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
  const userCartKey = CART_KEY+'_'+nxUser.phone;
  const userCart = JSON.parse(localStorage.getItem(userCartKey)) || [];
  if(guestCart.length > 0 && userCart.length > 0) {
    guestCart.forEach(gItem => {
      const ex = userCart.find(u => u.name === gItem.name);
      if(ex) ex.qty += gItem.qty;
      else userCart.push(gItem);
    });
    localStorage.setItem(userCartKey, JSON.stringify(userCart));
    localStorage.setItem(CART_KEY, JSON.stringify(userCart));
    localStorage.setItem('nirmanx_cart', JSON.stringify(userCart));
  } else if(guestCart.length > 0) {
    localStorage.setItem(userCartKey, JSON.stringify(guestCart));
  } else if(userCart.length > 0) {
    localStorage.setItem(CART_KEY, JSON.stringify(userCart));
    localStorage.setItem('nirmanx_cart', JSON.stringify(userCart));
  }
  updateCartBadge();
}

// ===== ADD TO CART =====
window.addToCart = function(name, price) {
  if(!checkRateLimit('add_cart', 30, 60000)) {
    showToast('⚠️ Too many actions! Please wait a moment.');
    return;
  }
  const safeName = sanitizeInput(name);
  const safePrice = parseFloat(price);
  if(!safeName || isNaN(safePrice) || safePrice <= 0) {
    showToast('❌ Invalid product!');
    return;
  }
  if(window.location.pathname.includes('cart.html')) {
    let cart = getCart();
    const ex = cart.find(i => i.name === safeName);
    if(ex) ex.qty++;
    else cart.push({ name: safeName, price: safePrice, qty: 1 });
    saveCart(cart);
    showToast('✅ Quantity updated!');
    if(typeof renderCart === 'function') renderCart();
    return;
  }
  showQtyPopup(safeName, safePrice);
};

function showQtyPopup(name, price) {
  const ex = document.querySelector('.qty-popup-overlay');
  if(ex) ex.remove();
  let qty = 1;
  const overlay = document.createElement('div');
  overlay.className = 'qty-popup-overlay';
  overlay.innerHTML = `
    <div class="qty-popup">
      <h3>${name}</h3>
      <div class="qp-price">₹${price.toLocaleString('en-IN')}</div>
      <div class="qty-controls">
        <button id="qp-minus">−</button>
        <span id="qp-num">1</span>
        <button id="qp-plus">+</button>
      </div>
      <div class="qp-total" id="qp-total">Total: ₹${price.toLocaleString('en-IN')}</div>
      <div class="qp-btns">
        <button class="qp-cancel" id="qp-cancel">Cancel</button>
        <button class="qp-add" id="qp-add">🛒 Add to Cart</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  function upd() {
    document.getElementById('qp-num').textContent = qty;
    document.getElementById('qp-total').textContent = 'Total: ₹'+(price*qty).toLocaleString('en-IN');
  }
  document.getElementById('qp-minus').onclick = () => { if(qty>1){qty--;upd();} };
  document.getElementById('qp-plus').onclick = () => { if(qty<999){qty++;upd();} };
  document.getElementById('qp-cancel').onclick = () => overlay.remove();
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  document.getElementById('qp-add').onclick = () => {
    let cart = getCart();
    const ex = cart.find(i => i.name===name);
    if(ex) ex.qty += qty;
    else cart.push({ name, price, qty });
    saveCart(cart);
    overlay.remove();
    showToast(`✅ ${name} added! (×${qty})`);
  };
}

// ===== CALCULATOR =====
let currentCalcType = 'cement';
function switchCalc(type, btn) {
  currentCalcType = type;
  document.querySelectorAll('.calc-tab').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const r = document.getElementById('calcResult');
  if(r) { r.classList.remove('show'); r.style.display='none'; }
}
function calculate() {
  const len = parseFloat(document.getElementById('cLength')?.value)||0;
  const wid = parseFloat(document.getElementById('cWidth')?.value)||0;
  const flo = parseFloat(document.getElementById('cFloors')?.value)||1;
  if(!len||!wid||len<=0||wid<=0){showToast('⚠️ Enter valid length and width!');return;}
  if(len>500||wid>500){showToast('⚠️ Enter area in feet (max 500)!');return;}
  const area = len*wid*flo;
  let results = [];
  switch(currentCalcType) {
    case 'cement':
      results=[
        {val:Math.ceil(area*.4)+' Bags',lbl:'Cement (50kg)',icon:'🏗️'},
        {val:Math.ceil(area*.6)+' CFT',lbl:'Sand',icon:'🪣'},
        {val:Math.ceil(area*1.2)+' CFT',lbl:'Stone/Grit',icon:'🪨'},
        {val:'₹'+(Math.ceil(area*.4)*380).toLocaleString('en-IN'),lbl:'Est. Cost',icon:'💰'}
      ]; break;
    case 'bricks':
      const br=Math.ceil(area*55);
      results=[
        {val:br.toLocaleString('en-IN'),lbl:'Bricks Needed',icon:'🧱'},
        {val:Math.ceil(area*.3)+' Bags',lbl:'Cement Mortar',icon:'🏗️'},
        {val:'₹'+(br*8).toLocaleString('en-IN'),lbl:'Est. Cost',icon:'💰'},
        {val:area+' sqft',lbl:'Total Area',icon:'📐'}
      ]; break;
    case 'tiles':
      const ti=Math.ceil(area*1.1);
      results=[
        {val:ti+' sqft',lbl:'Tiles (+10%)',icon:'🪟'},
        {val:Math.ceil(area/40)+' Bags',lbl:'Tile Adhesive',icon:'🧴'},
        {val:Math.ceil(area/50)+' Bags',lbl:'Grout',icon:'⬜'},
        {val:'₹'+(ti*45).toLocaleString('en-IN'),lbl:'Est. Cost',icon:'💰'}
      ]; break;
    case 'paint':
      const wa=Math.ceil(area*3.5);
      results=[
        {val:Math.ceil(wa/40)+' Litres',lbl:'Paint (2 coats)',icon:'🎨'},
        {val:Math.ceil(wa/80)+' Litres',lbl:'Primer',icon:'🖌️'},
        {val:wa+' sqft',lbl:'Wall Area',icon:'📐'},
        {val:'₹'+(Math.ceil(wa/40)*280).toLocaleString('en-IN'),lbl:'Est. Cost',icon:'💰'}
      ]; break;
  }
  const grid = document.getElementById('resultGrid');
  if(grid) grid.innerHTML = results.map(r=>`<div class="result-item"><div style="font-size:22px;margin-bottom:5px">${r.icon}</div><span class="r-val">${r.val}</span><div class="r-lbl">${r.lbl}</div></div>`).join('');
  const res = document.getElementById('calcResult');
  if(res){res.style.display='block';res.classList.add('show');res.scrollIntoView({behavior:'smooth',block:'nearest'});}
}

// ===== SEARCH =====
function searchProduct() {
  const q = document.getElementById('searchInput')?.value?.trim();
  if(!q){showToast('⚠️ Enter product name!');return;}
  if(!checkRateLimit('search',20,60000)){showToast('⚠️ Too many searches!');return;}
  const base = window.location.pathname.includes('/pages/') ? 'products.html':'pages/products.html';
  window.location.href = `${base}?search=${encodeURIComponent(sanitizeInput(q))}`;
}
document.addEventListener('keydown', function(e) {
  if(e.key==='Enter' && document.getElementById('searchInput')===document.activeElement) searchProduct();
});

// ===== WA FLOAT =====
setTimeout(()=>{
  const b=document.getElementById('waBubble');
  if(b){b.style.display='block';setTimeout(()=>b.style.display='none',5000);}
},3000);

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  updateCartBadge();
  mergeCartsOnLogin();
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if(searchQuery) {
    const input = document.querySelector('.filter-search');
    if(input) input.value = sanitizeInput(searchQuery);
  }
}); 