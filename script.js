// Local mock OAuth + UI helpers
// When running as a static site, build OAuth URLs on the client using the public CLIENT_ID
// Decide whether to use mock auth: explicit config (NG_CONFIG.USE_MOCK) or default to local dev
const USE_MOCK = (window.NG_CONFIG && !!window.NG_CONFIG.USE_MOCK) || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'); // set NG_CONFIG.USE_MOCK=true for dev previews if needed

function buildInviteUrl(guildId){
  try{
    const cfg = window.NG_CONFIG || {};
    const client = cfg.CLIENT_ID;
    const perms = cfg.DEFAULT_PERMISSIONS || '8';
    const params = new URLSearchParams({ client_id: client, permissions: perms, scope: 'bot' });
    if (guildId){ params.set('guild_id', guildId); params.set('disable_guild_select', 'true'); }
    return 'https://discord.com/api/oauth2/authorize?' + params.toString();
  }catch(e){ return '/'; }
}
function openInvite(guildId){ const url = buildInviteUrl(guildId); window.open(url, '_blank'); }

function buildAuthUrl(){
  try{
    const cfg = window.NG_CONFIG || {};
    const client = cfg.CLIENT_ID;
    const base = cfg.BASE_URL || window.location.origin;
    const redirect = encodeURIComponent((base.replace(/\/$/, '')) + '/callback');
    const params = new URLSearchParams({ client_id: client, redirect_uri: (base.replace(/\/$/, '') + '/callback'), response_type: 'code', scope: 'identify guilds' });
    return 'https://discord.com/api/oauth2/authorize?' + params.toString();
  }catch(e){ return '/'; }
}

function login(){ showPageLoader(); if (USE_MOCK) { window.location.href = 'mock-auth.html'; } else { window.location.href = buildAuthUrl(); } }

// Attach click handlers to invite/login anchors to prevent navigation to /invite-now or /auth (which are not available on static deploys)
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    const inviteEls = document.querySelectorAll('#invite-btn, #hero-invite, #invite-bottom');
    inviteEls.forEach(el => { el.addEventListener('click', (e)=>{ e.preventDefault(); openInvite(); }); el.setAttribute('href','#'); });
    const loginEls = document.querySelectorAll('#login-btn, #hero-login, #invite-login');
    loginEls.forEach(el => { el.addEventListener('click', (e)=>{ e.preventDefault(); login(); }); el.setAttribute('href','#'); });
  }catch(e){}
});

// Image fallback helpers 🔧
function setImageFallback(img){
  if (!img) return;
  if (img._hasFallback) return;
  img._hasFallback = true;
  function onErr(){
    img.removeEventListener('error', onErr);
    img.src = 'placeholder.svg';
    img.classList.add('img-fallback');
  }
  img.addEventListener('error', onErr);
  if (!img.getAttribute('src')) img.src = 'placeholder.svg';
}
function attachImageFallbacks(scope=document){
  try{
    const imgs = scope && scope.querySelectorAll ? scope.querySelectorAll('img.guild-icon, img.user-avatar, img[data-fallback]') : [];
    imgs.forEach(setImageFallback);
  }catch(e){/* ignore */}
}

// Apply a saved global theme (if any) from localStorage
function updatePrimaryButtons(){
  try{
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '';
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '';
    const nodes = document.querySelectorAll('.btn.primary.setup-btn, .btn.primary.manage-btn');
    nodes.forEach(n => {
      if (accent) n.style.background = accent;
      if (rgb) n.style.boxShadow = `0 10px 30px rgba(${rgb},0.06)`;
      // ensure readable text color
      try{ const onAccent = getComputedStyle(document.documentElement).getPropertyValue('--on-accent') || '#fff'; n.style.color = onAccent; }catch(e){}
    });
  }catch(e){}
}

function applySavedGlobalTheme(){
  try{
    const raw = localStorage.getItem('ng_theme_global');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s) return;
    if (s.accent){
      document.documentElement.style.setProperty('--accent', s.accent);
      // compute an RGB triplet for accent so we can use it in rgba(...) elsewhere
      try{
        const hex = s.accent.replace(/^#/, '');
        if (/^[0-9a-f]{6}$/i.test(hex)){
          const r = parseInt(hex.slice(0,2),16);
          const g = parseInt(hex.slice(2,4),16);
          const b = parseInt(hex.slice(4,6),16);
          document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
        }
      }catch(e){}
    }
    if (s.bgMode === 'light'){
      document.documentElement.style.setProperty('--bg-1', '#f6f7fb');
      document.documentElement.style.setProperty('--card', 'rgba(0,0,0,0.04)');
      document.documentElement.style.setProperty('--muted','rgba(0,0,0,0.6)');
      document.documentElement.style.setProperty('--text','#0b1720');
      document.documentElement.style.setProperty('--on-accent','#fff');
      document.documentElement.style.setProperty('--border','rgba(0,0,0,0.08)');
      document.documentElement.style.setProperty('--glass','rgba(0,0,0,0.02)');
      document.documentElement.style.setProperty('--card-2','rgba(0,0,0,0.015)');
      document.documentElement.style.setProperty('--spinner-track','rgba(0,0,0,0.06)');
      try{ document.documentElement.classList.add('theme-light'); }catch(e){}
    } else if (s.bgMode === 'dark'){
      document.documentElement.style.setProperty('--bg-1', '#0b0f12');
      document.documentElement.style.setProperty('--card', 'rgba(255,255,255,0.03)');
      document.documentElement.style.setProperty('--muted','rgba(255,255,255,0.68)');
      document.documentElement.style.setProperty('--text','#e9eef6');
      document.documentElement.style.setProperty('--on-accent','#fff');
      document.documentElement.style.setProperty('--border','rgba(255,255,255,0.04)');
      document.documentElement.style.setProperty('--glass','rgba(255,255,255,0.02)');
      document.documentElement.style.setProperty('--card-2','rgba(255,255,255,0.015)');
      document.documentElement.style.setProperty('--spinner-track','rgba(255,255,255,0.06)');
      try{ document.documentElement.classList.remove('theme-light'); }catch(e){}
    } else {
      // system preference
      const isSysLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      try{ if (isSysLight) document.documentElement.classList.add('theme-light'); else document.documentElement.classList.remove('theme-light'); }catch(e){}
    }
    // update any primary buttons that may be present on the page (dashboard)
    updatePrimaryButtons();
  }catch(e){ console.warn('Failed to apply saved global theme', e); }
}

// listen for storage changes so an open Dashboard or Server list will update when global theme changes in another tab/window
window.addEventListener('storage', (ev)=>{
  if (!ev || !ev.key) return;
  if (ev.key === 'ng_theme_global'){
    // apply the updated global theme so buttons like Setup/Manage update immediately
    applySavedGlobalTheme();
  }
});
// Also listen for an in-page custom event so pages in the same tab can react immediately
window.addEventListener('theme:changed', (ev)=>{
  try{ applySavedGlobalTheme(); }catch(e){}
});

// Show loader on internal navigation (single-click experience)
document.addEventListener('click', (e)=>{
  const a = e.target.closest && e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  // ignore external links (different origin), mailto, tel, hash-only, or anchors that open in new tab
  try {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return; // external
  } catch (err) {
    // if URL parsing fails, fallback to original checks
    if (href.startsWith('http') && !href.startsWith(location.origin)) return;
  }
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
  if (a.target === '_blank') return;
  if (href.startsWith('#') || href === '') return;
  // show loader for internal navigations
  showPageLoader();
});
function logout(){ localStorage.removeItem('ng_token'); localStorage.removeItem('ng_user'); location.reload(); }
function getUser(){ try { return JSON.parse(localStorage.getItem('ng_user')); } catch(e){ return null; } }

function showLoginPrompt(){ const authInfo = document.getElementById('auth-info'); const serverList = document.getElementById('server-list'); if (serverList) serverList.innerHTML = ''; if (authInfo) authInfo.innerHTML = `<div class="login-cta"><p class="section-lead">You are not logged in. Sign in with Discord to manage your servers.</p><a href="/auth" id="dash-login" class="btn primary">Login with Discord</a></div>`; const dashLogin = document.getElementById('dash-login'); if (dashLogin) dashLogin.addEventListener('click',(e)=>{ e.preventDefault(); window.location.href='/auth'; }); }

function showLoading(){ const loader = document.getElementById('loader'); const skeletons = document.getElementById('skeletons'); const serverList = document.getElementById('server-list'); if (serverList) serverList.innerHTML = ''; if (loader) { loader.style.display='flex'; loader.setAttribute('aria-hidden','false'); } if (skeletons) { skeletons.innerHTML=''; for (let i=0;i<6;i++){ const div = document.createElement('div'); div.className='server-item'; div.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-sub"></div>'; skeletons.appendChild(div); } skeletons.setAttribute('aria-hidden','false'); } }

function hideLoading(){ const loader = document.getElementById('loader'); const skeletons = document.getElementById('skeletons'); if (loader) { loader.style.display='none'; loader.setAttribute('aria-hidden','true'); } if (skeletons) { skeletons.innerHTML=''; skeletons.setAttribute('aria-hidden','true'); } }

function renderGuilds(guilds, user){
  const serverList = document.getElementById('server-list');
  if (!serverList) return;
  serverList.innerHTML = '';
  // permissions bits: ADMINISTRATOR=0x8, MANAGE_GUILD=0x20
  const ADMIN = BigInt(0x8);
  const MANAGE = BigInt(0x20);
  console.log('Rendering', guilds.length, 'guilds into #server-list');
  serverList.style.opacity = '0';
  guilds.forEach((g,i) => {
    try {
      // Defensive parsing in case Discord returns unexpected values
      const permsRaw = (typeof g.permissions === 'string' || typeof g.permissions === 'number') ? g.permissions : '0';
      const perms = BigInt(permsRaw || '0');
      const hasAccess = !!g.owner || ((perms & ADMIN) !== 0n) || ((perms & MANAGE) !== 0n);
      const div = document.createElement('div');
      div.className='server-item';

      const serverName = g.name || `Server ${i+1} (unnamed)`;
      const iconUrl = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon && g.icon.startsWith && g.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : 'https://cdn.jsdelivr.net/gh/identicons/identicon.png';
      // No inline badge — use the right-side action button instead
      const badge = ``;
      // Show Manage when the bot is present; otherwise show Setup (if the user has manage access). If no access, show a disabled No Access button.
      // If server didn't return explicit bot presence info (undefined), default to showing Manage so behavior is unchanged when server lacks a bot token
      const btnHtml = hasAccess ? (g.bot_present === false ? `<button class="btn primary setup-btn" data-id="${g.id}">Setup</button>` : `<button class="btn primary manage-btn" data-id="${g.id}">Manage</button>`) : `<button class="btn no-access-btn" disabled>No Access</button>`;

      div.innerHTML = `
        <div class="server-row">
          <img src="${iconUrl}" alt="${serverName} icon" class="guild-icon" onerror="this.onerror=null;this.src='placeholder.svg'">
          <div class="server-meta">
            <h3 title="${serverName}">${serverName}</h3>
            <p class="small-muted">${badge}</p>
          </div>
          <div class="server-actions">
            ${btnHtml}
          </div>
        </div>
      `;

      serverList.appendChild(div);
      // attach fallback handlers for images inside this new card
      attachImageFallbacks(div);
      // staggered fade-in for each card
      setTimeout(()=>{ div.classList.add('show'); }, i * 40 + 90);
      const manageBtn = div.querySelector('.manage-btn');
      if (manageBtn) manageBtn.addEventListener('click', ()=>{ window.location.href = `server-dashboard.html?id=${encodeURIComponent(g.id)}&name=${encodeURIComponent(serverName)}`; });
      const setupBtn = div.querySelector('.setup-btn');
      if (setupBtn) setupBtn.addEventListener('click', ()=>{ startInviteAndWait(g.id, serverName, setupBtn); });

      // Background verification: double-check bot presence and update UI if the bot was removed (avoids waiting for cache TTL)
      (function verifyPresenceOnCard(card,guild){
        if (!guild || !guild.id) return;
        if (guild.bot_present !== true) return; // only verify when we think the bot is present
        (async ()=>{
          try{
            const r = await fetch(`/api/guild/${encodeURIComponent(guild.id)}`, { credentials: 'include' });
            if (!r.ok) return;
            const latest = await r.json();
            if (latest && latest.bot_present === false){
              const actions = card.querySelector('.server-actions');
              if (actions){
                actions.innerHTML = `<button class="btn primary setup-btn" data-id="${guild.id}">Setup</button>`;
                const newBtn = actions.querySelector('.setup-btn');
                if (newBtn) newBtn.addEventListener('click', ()=>{ startInviteAndWait(guild.id, serverName, newBtn); });
                try{ updatePrimaryButtons(); }catch(e){}
              }
            }
          }catch(e){ /* ignore transient fetch errors */ }
        })();
      })(div, g);
    } catch (err) {
      console.error('Error rendering guild', g, err);
      // Append a fallback card to show this guild's raw data
      const div = document.createElement('div');
      div.className='server-item disabled';
      div.innerHTML = `<h3>Failed to render guild</h3><pre class="small-muted">${JSON.stringify({ id: g.id, name: g.name }, null, 2)}</pre>`;
      serverList.appendChild(div);
    }
  });
  // fade-in after a short delay so layout can settle
  setTimeout(()=>{ serverList.style.opacity='1'; }, 60);
  // ensure any primary action buttons pick up the current accent color
  try{ updatePrimaryButtons(); }catch(e){}
}

// Polling helper: wait for the bot to appear in a guild by repeatedly fetching the targeted /api/guild/:id endpoint
async function waitForBotInGuild(guildId, timeout = 180000, interval = 3000){
  const start = Date.now();
  while ((Date.now() - start) < timeout){
    try {
      const res = await fetch(`/api/guild/${encodeURIComponent(guildId)}`, { credentials: 'include' });
      if (res.ok){
        const g = await res.json();
        if (g && g.bot_present === true) return true;
      }
    } catch(e){ /* ignore transient errors */ }
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

// Open the invite page in a new tab and wait for the bot to be added to `guildId`.
// When detected, redirect the current page to the server dashboard for that guild.
function startInviteAndWait(guildId, serverName, btn){
  const url = `/invite-now?guild_id=${encodeURIComponent(guildId)}`;
  const win = window.open(url, '_blank');
  if (btn){ btn.disabled = true; btn.textContent = 'Waiting for invite…'; }

  // Tracker to let the popup-check short-circuit the polling flow
  let popupHandled = false;

  // Periodically try to read the popup location. This will throw until the popup returns to our origin.
  const popupChecker = setInterval(()=>{
    try{
      if (!win || win.closed){ clearInterval(popupChecker); return; }
      const href = String(win.location.href || '');
      // If popup navigated back to our invite callback or server dashboard, extract guild id and redirect
      if (href.includes('/invite-callback') || href.includes('/server-dashboard.html')){
        popupHandled = true;
        try{
          const u = new URL(href);
          const gid = u.searchParams.get('state') || u.searchParams.get('guild_id') || u.searchParams.get('id');
          // broadcast to other windows that guild joined so they can refresh immediately
          try{ localStorage.setItem('ng_guild_joined', JSON.stringify({ guildId: gid, at: Date.now() })); }catch(e){}
          // Include the serverName when available so the dashboard shows the server name immediately after redirect
          const dest = gid ? `server-dashboard.html?id=${encodeURIComponent(gid)}&name=${encodeURIComponent(serverName || '')}` : '/dashboard.html';
          showToast(`Bot added. Redirecting…`, 'info', 1600);
          window.location.href = dest;
        }catch(e){}
        try{ win.close(); }catch(e){}
        clearInterval(popupChecker);
      }
    }catch(e){ /* cross-origin until popup returns to our site — ignore */ }
  }, 700);

  (async ()=>{
    const joined = await waitForBotInGuild(guildId, 180000, 3000);
    if (popupHandled){ return; } // already handled by popup redirect
    if (joined){
      // notify other tabs and refresh local dashboard
      try{ localStorage.setItem('ng_guild_joined', JSON.stringify({ guildId: guildId, at: Date.now() })); }catch(e){}
      showToast(`Bot added to ${serverName}. Redirecting…`, 'info', 3000);
      // if we're already on dashboard, trigger a refresh; otherwise navigate to server dashboard
      if (window.location.pathname.includes('dashboard.html')){ try{ loadAndRenderGuilds(); }catch(e){} }
      window.location.href = `server-dashboard.html?id=${encodeURIComponent(guildId)}&name=${encodeURIComponent(serverName)}`;
    } else {
      showToast(`Timed out waiting for the bot to be added to ${serverName}. If you already authorized on Discord, try refreshing this page.`, 'error', 7000);
      if (btn){ btn.disabled = false; btn.textContent = 'Setup'; }
    }
    try { if (win && !win.closed) win.close(); } catch(e){}
    clearInterval(popupChecker);
  })();
}

// Simple reveal animation for elements with .reveal and hero fade-in
function addRevealAnimations(){
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((el, i)=> setTimeout(()=> el.classList.add('show'), i * 80));

  // hero specific fade-in helpers
  const heroText = document.querySelector('.hero-text');
  const heroPreview = document.querySelector('.hero-preview');
  if (heroText) setTimeout(()=> heroText.classList.add('visible'), 160);
  if (heroPreview) setTimeout(()=> heroPreview.classList.add('visible'), 260);
}

// Page loader helpers
function hidePageLoader(){ const pl = document.getElementById('page-loader'); if (!pl) return; // clear any auto-hide
  if (pl._autoHideTimer) { clearTimeout(pl._autoHideTimer); pl._autoHideTimer = null; }
  pl.classList.add('hidden'); pl.dataset.visible = 'false'; setTimeout(()=> { if (pl) pl.style.display='none'; }, 350); }
function showPageLoader(){ const pl = document.getElementById('page-loader'); if (!pl) { return; }
  // If already visible, refresh auto-hide timer
  pl.style.display='flex'; pl.classList.remove('hidden'); pl.dataset.visible = 'true';
  if (pl._autoHideTimer) clearTimeout(pl._autoHideTimer);
  // auto-hide after 8s in case navigation stalls or load doesn't fire
  pl._autoHideTimer = setTimeout(()=>{ hidePageLoader(); }, 8000);
}

// Toast helper (global) — rich UI with icon, text and close button
function showToast(message, type='info', duration=4200){
  let t = document.querySelector('.toast');
  if (!t){
    t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<div class="toast-icon" aria-hidden="true"></div><div class="toast-text"></div><button class="toast-close" aria-label="Close">✕</button>';
    document.body.appendChild(t);
    // close button
    t.querySelector('.toast-close').addEventListener('click', ()=>{ t.classList.remove('show'); clearTimeout(t._hideTimeout); });
  }
  // ensure visible above everything
  try{ t.style.zIndex = 20000; }catch(e){}
  const txt = t.querySelector('.toast-text'); if (txt) txt.textContent = message;
  t.classList.remove('toast-error','toast-info');
  t.classList.add(type === 'error' ? 'toast-error' : 'toast-info');
  t.classList.add('show');
  clearTimeout(t._hideTimeout);
  t._hideTimeout = setTimeout(()=>{ t.classList.remove('show'); }, duration);
}

// Lightweight carousel for hero preview
function initCarousel(selector = '.carousel', interval = 3500){
  const car = document.querySelector(selector);
  if (!car) return;
  const slides = Array.from(car.querySelectorAll('.carousel-slide'));
  const next = car.querySelector('.carousel-next');
  const prev = car.querySelector('.carousel-prev');
  const dots = Array.from(car.querySelectorAll('.carousel-dot'));
  let idx = 0;
  let timer = null;

  function show(i){
    slides.forEach((s,j)=> s.classList.toggle('active', j===i));
    const offset = -i * 100;
    const container = car.querySelector('.carousel-slides');
    if (container) container.style.transform = `translateX(${offset}%)`;
    dots.forEach((d,j)=> d.classList.toggle('active', j===i));
    idx = i;
  }
  function nextSlide(){ show((idx+1) % slides.length); }
  function prevSlide(){ show((idx-1+slides.length) % slides.length); }
  function start(){ if (timer) clearInterval(timer); timer = setInterval(nextSlide, interval); }
  function stop(){ if (timer) { clearInterval(timer); timer = null; } }

  if (next) next.addEventListener('click', (e)=>{ e.preventDefault(); nextSlide(); stop(); start(); });
  if (prev) prev.addEventListener('click', (e)=>{ e.preventDefault(); prevSlide(); stop(); start(); });
  dots.forEach((d,i)=> d.addEventListener('click', ()=>{ show(i); stop(); start(); }));
  car.addEventListener('mouseenter', stop);
  car.addEventListener('mouseleave', start);

  show(0);
  start();
}

function initFeatureCardTilt(){
  // Only run on devices that support hover & fine pointer
  if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cards = Array.from(document.querySelectorAll('.card.feature'));
  const MAX = 10; // max degrees rotation
  cards.forEach(card => {
    let rect = null, raf = null;
    function updateTransform(rotX, rotY){
      card.style.transform = `translateY(-8px) translateZ(18px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    }
    function onMove(e){
      rect = rect || card.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const dx = (e.clientX - cx) / (rect.width/2); // -1..1
      const dy = (e.clientY - cy) / (rect.height/2);
      const rotY = Math.max(Math.min(dx * MAX, MAX), -MAX);
      const rotX = Math.max(Math.min(-dy * MAX, MAX), -MAX);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=> updateTransform(rotX, rotY));
    }
    function onEnter(){ rect = null; card.classList.add('tilt-active'); }
    function onLeave(){ cancelAnimationFrame(raf); card.style.transform = ''; card.classList.remove('tilt-active'); rect = null; }
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);
    // keyboard accessibility: simple focus transform
    card.addEventListener('focus', ()=> card.style.transform = 'translateY(-8px) translateZ(18px) rotateX(6deg) rotateY(0deg)');
    card.addEventListener('blur', ()=> card.style.transform = '');
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{ applySavedGlobalTheme(); addRevealAnimations(); initCarousel(); attachImageFallbacks(); initFeatureCardTilt();

  // Accent swatch UI: open native picker on swatch click and keep it visually in sync
  (function(){
    const sw = document.getElementById('accent-swatch');
    const colorIn = document.getElementById('accent-color');
    const hexIn = document.getElementById('accent-hex');
    if (sw && colorIn){
      try{ sw.style.background = colorIn.value || getComputedStyle(document.documentElement).getPropertyValue('--accent') || 'var(--accent)'; }catch(e){}
      // prefer modern showPicker (Chrome/Edge/Opera), fallback to click
      sw.addEventListener('click', ()=>{
        try{ if (typeof colorIn.showPicker === 'function') colorIn.showPicker(); else colorIn.click(); }catch(e){ colorIn.click(); }
      });
      // keyboard accessibility: Enter/Space opens picker
      sw.addEventListener('keydown', (ev)=>{ if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); try{ if (typeof colorIn.showPicker === 'function') colorIn.showPicker(); else colorIn.click(); }catch(e){ colorIn.click(); } } });
      colorIn.addEventListener('input', ()=>{ try{ sw.style.background = colorIn.value; }catch(e){} });
      if (hexIn){ hexIn.addEventListener('input', ()=>{
        const raw = (hexIn.value || '').replace(/^#/, '').trim();
        if (/^[0-9a-f]{6}$/i.test(raw)){
          hexIn.classList.remove('invalid'); colorIn.value = '#'+raw; sw.style.background = '#'+raw; document.documentElement.style.setProperty('--accent','#'+raw);
        } else {
          if (hexIn.value.length > 0) hexIn.classList.add('invalid'); else hexIn.classList.remove('invalid');
        }
      }); }
    }
  })();

  // Ensure any leftover page loader is hidden when DOM is ready; also hide again on window load and set a fallback
  hidePageLoader();
  window.addEventListener('load', ()=> hidePageLoader());
  setTimeout(()=> hidePageLoader(), 3000);
  const inviteBtn = document.getElementById('invite-btn');
  if (inviteBtn) inviteBtn.addEventListener('click', (e)=>{ e.preventDefault(); openInvite(); });

  // Update header auth UI for all pages (show user badge if authenticated)
  async function updateHeaderAuthUI(){
    const loginBtn = document.getElementById('login-btn');
    const actions = document.querySelector('.actions');

    // 1) Try server-side session
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok){
        const data = await res.json();
        if (data?.user){
          const user = data.user;
          const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : 'https://cdn.jsdelivr.net/gh/identicons/identicon.png';
          const badgeHtml = `<div class="user-badge header-badge"><img src="${avatarUrl}" alt="" class="user-avatar" style="width:36px;height:36px" onerror="this.onerror=null;this.src='placeholder.svg'"><div class="user-meta"><strong style="display:block">${user.username}#${user.discriminator}</strong></div><button id="header-logout" class="btn ghost">Logout</button></div>`;
          if (loginBtn) loginBtn.outerHTML = badgeHtml; else if (actions) actions.insertAdjacentHTML('beforeend', badgeHtml);
          // ensure fallback handlers run for the newly-inserted avatar
          attachImageFallbacks(actions || document);
          const headerLogout = document.getElementById('header-logout');
          if (headerLogout) headerLogout.addEventListener('click', ()=>{ window.location.href='/logout'; });

          // If user is signed in, change hero/invite login buttons to go to dashboard
          const heroLogin = document.getElementById('hero-login');
          if (heroLogin){ heroLogin.textContent = 'Dashboard'; heroLogin.href = '/dashboard.html'; heroLogin.classList.remove('ghost'); heroLogin.classList.add('primary'); }
          const inviteLogin = document.getElementById('invite-login');
          if (inviteLogin){ inviteLogin.textContent = 'Dashboard'; inviteLogin.href = '/dashboard.html'; inviteLogin.classList.remove('ghost'); inviteLogin.classList.add('primary'); }

          return;
        }
      }
    } catch(e){ /* ignore server errors, fall back to mock */ }

    // 2) Fallback to mock-local session if enabled
    if (USE_MOCK){
      const user = getUser();
      if (user && actions){
        const avatar = user.avatar || 'https://cdn.jsdelivr.net/gh/identicons/identicon.png';
        const badgeHtml = `<div class="user-badge header-badge"><img src="${avatar}" alt="" class="user-avatar" style="width:36px;height:36px" onerror="this.onerror=null;this.src='placeholder.svg'"><div class="user-meta"><strong style="display:block">${user.username}</strong></div><button id="header-logout" class="btn ghost">Logout</button></div>`;
        if (loginBtn) loginBtn.outerHTML = badgeHtml; else actions.insertAdjacentHTML('beforeend', badgeHtml);
        attachImageFallbacks(actions || document);
        const headerLogout = document.getElementById('header-logout');
        if (headerLogout) headerLogout.addEventListener('click', ()=>{ logout(); });

        const heroLogin = document.getElementById('hero-login');
        if (heroLogin){ heroLogin.textContent = 'Dashboard'; heroLogin.href = 'dashboard.html'; heroLogin.classList.remove('ghost'); heroLogin.classList.add('primary'); }
        const inviteLogin = document.getElementById('invite-login');
        if (inviteLogin){ inviteLogin.textContent = 'Dashboard'; inviteLogin.href = 'dashboard.html'; inviteLogin.classList.remove('ghost'); inviteLogin.classList.add('primary'); }

        return;
      }
    }

    // otherwise ensure login link behaves correctly for mock vs real
    if (loginBtn){
      const href = loginBtn.getAttribute('href') || '';
      loginBtn.addEventListener('click', (e)=>{ if (USE_MOCK && href.includes('mock-auth.html')) { e.preventDefault(); login(); } });

      // Ensure hero/invite remain as Login with Discord when not signed in
      const heroLogin = document.getElementById('hero-login');
      if (heroLogin){ heroLogin.textContent = 'Login with Discord'; heroLogin.href = '/auth'; heroLogin.classList.remove('primary'); heroLogin.classList.add('ghost'); }
      const inviteLogin = document.getElementById('invite-login');
      if (inviteLogin){ inviteLogin.textContent = 'Login with Discord'; inviteLogin.href = '/auth'; inviteLogin.classList.remove('primary'); inviteLogin.classList.add('ghost'); }
    }
  }

  updateHeaderAuthUI();

  if (window.location.pathname.includes('dashboard.html')) {
    const authInfo = document.getElementById('auth-info');

    async function loadAndRenderGuilds(){
      showLoading();
      try{
        const gRes = await fetch('/api/guilds', { credentials: 'include' });
        const serverList = document.getElementById('server-list');
        if (gRes.ok){
          const body = await gRes.json();
          const guilds = body?.guilds || [];
          renderGuilds(guilds, getUser() || { username: 'User' });
        } else if (gRes.status === 401){
          console.warn('/api/guilds returned 401 - not authenticated');
          showLoginPrompt();
          showToast('Not authenticated. Please sign in with Discord.', 'info');
        } else {
          const errText = await gRes.text();
          console.error('/api/guilds error', gRes.status, errText);
          if (serverList) serverList.innerHTML = '<p class="small-muted">Unable to fetch guilds.</p>';
          showToast('Unable to fetch guilds from server.', 'error');
        }
      }catch(e){ console.error('Failed to load guilds', e); }
      hideLoading();
    }

    // Listen for notifications that a guild was joined so we can refresh the list immediately
    window.addEventListener('storage', (ev)=>{
      if (!ev || !ev.key) return;
      if (ev.key === 'ng_guild_joined'){
        try{ const obj = JSON.parse(ev.newValue); if (obj && obj.guildId){ loadAndRenderGuilds(); } }catch(e){}
      }
      // other storage handlers (e.g., theme changes) handled elsewhere
    });

    // Poll the server for recent guild events (e.g., bot left/joined) for a short time after page load
    (function pollRecentGuildEvents(){
      let lastSeen = Date.now() - 10000;
      let elapsed = 0;
      const interval = setInterval(async ()=>{
        try{
          const r = await fetch('/api/recent-guild-events');
          if (r.ok){ const body = await r.json(); const evs = body?.events || [];
            const newEv = evs.find(e => e && e.at > lastSeen);
            if (newEv){ // if recent event affects our view, refresh
              console.log('Detected recent guild event', newEv);
              lastSeen = Date.now(); elapsed = 0; try{ loadAndRenderGuilds(); }catch(e){}
            }
          }
        }catch(e){ /* ignore transient errors */ }
        elapsed += 3000;
        if (elapsed > 2*60*1000) { clearInterval(interval); } // stop polling after 2 minutes
      }, 3000);
    })();

    // 1) Prefer server-side auth (cookies) if present
    let serverAuth = false;
    try {
      const meRes = await fetch('/api/me', { credentials: 'include' }); // include cookies so server-side session is sent
      if (meRes.ok) {
        const me = await meRes.json();
        if (me?.user) {
          serverAuth = true;

          // render user badge + logout
          const avatarUrl = me.user.avatar ? `https://cdn.discordapp.com/avatars/${me.user.id}/${me.user.avatar}.png` : 'https://cdn.jsdelivr.net/gh/identicons/identicon.png';
          if (authInfo) {
            authInfo.innerHTML = `<div class="user-badge"><img src="${avatarUrl}" alt="" class="user-avatar" onerror="this.onerror=null;this.src='placeholder.svg'"><div class="user-meta"><strong>${me.user.username}#${me.user.discriminator}</strong></div><button id="logout-btn" class="btn ghost">Logout</button></div>`;
            attachImageFallbacks(authInfo);
            document.getElementById('logout-btn').addEventListener('click', ()=>{ window.location.href='/logout'; });
          }

          // initial load
          await loadAndRenderGuilds();

          // clear any legacy local mock session to avoid "LocalTester" showing
          localStorage.removeItem('ng_token');
          localStorage.removeItem('ng_user');
        }
      }
    } catch (e) {
      console.error('Error checking server auth', e);
    }

    // 2) If no server auth, fall back to local mock token (for quick testing)
    if (!serverAuth) {
      const token = localStorage.getItem('ng_token');
      if (token && authInfo) {
        const user = getUser() || { username: 'TestUser#0001' };
        authInfo.innerHTML = `<div class="user-badge"><img src="${user.avatar || 'https://cdn.jsdelivr.net/gh/identicons/identicon.png'}" alt="" class="user-avatar" onerror="this.onerror=null;this.src='placeholder.svg'"><div class="user-meta"><strong>${user.username}</strong></div><button id="logout-btn" class="btn ghost">Logout</button></div>`;
        attachImageFallbacks(authInfo);
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);

        // populate mock servers
        const serverList = document.querySelector('.server-list');
        if (serverList) {
          serverList.innerHTML = '';
          for (let i=1;i<=6;i++){
            const div = document.createElement('div');
            div.className='server-item';
            const mockIsJoined = (i % 2 === 0);
            div.innerHTML = `<h3>Test Server ${i}</h3><p>Owner: ${user.username}</p><button class="btn primary ${mockIsJoined ? 'manage-btn' : 'setup-btn'}" data-id="server-${i}">${mockIsJoined ? 'Manage' : 'Setup'}</button>`;
            serverList.appendChild(div);
            // attach handlers
            const btn = div.querySelector('.manage-btn');
            if (btn) btn.addEventListener('click', ()=>{ window.location.href = `server-settings.html?id=${encodeURIComponent('Test Server '+i)}`; });
            const setupBtn = div.querySelector('.setup-btn');
            if (setupBtn) setupBtn.addEventListener('click', ()=>{ startInviteAndWait('server-'+i, 'Test Server '+i, setupBtn); });
          }
        }
      } else {
        showLoginPrompt();
      }
    }
  }
});
