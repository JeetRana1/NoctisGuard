
  // Plugins limited to Moderation, Levels, and Giveaways
  // Add `icon` property (emoji or inline SVG) for a nicer UI
  const PLUGINS = [
    { id: 'moderation', title: 'Moderation', description: 'Auto moderation and moderation tools', icon: '🛡️' },
    { id: 'level', title: 'Levels', description: 'XP and level rewards for active members', icon: '⭐' },
    { id: 'giveaway', title: 'giveaway', titleNice: 'Giveaways', description: 'Create and manage giveaways', icon: '🎉' },
    { id: 'misc', title: 'Misc', description: 'Utility commands and helpers (timers, reminders, etc.)', icon: '🧰' },
    { id: 'info', title: 'Info', description: 'Server and bot information commands (stats, uptime, version)', icon: 'ℹ️' },
    { id: 'welcome', title: 'Welcome', description: 'Welcome messages, auto-roles and greeting configuration', icon: '🎊' }
  ];

  // close helpers
  window.closePluginConfig = function(){ const modal = document.getElementById('plugin-modal'); if (!modal) return; modal.setAttribute('aria-hidden','true'); setTimeout(()=>{ modal.style.display='none'; }, 220); };
  window.closeWelcomeConfig = function(){ const modal = document.getElementById('plugin-modal-welcome'); if (!modal) return; modal.setAttribute('aria-hidden','true'); setTimeout(()=>{ modal.style.display='none'; }, 220); };
  window.closeGiveawayConfig = function(){ const modal = document.getElementById('plugin-modal-giveaway'); if (!modal) return; modal.setAttribute('aria-hidden','true'); setTimeout(()=>{ modal.style.display='none'; }, 220); };

  const params = new URLSearchParams(location.search);
  const serverId = params.get('id') || 'unknown';
  const serverName = params.get('name') || 'Server';

  document.getElementById('server-title').textContent = serverName;

  // Modal theme helper (same behavior as server-dashboard) 
  function modalShouldUseLight(){
    try{ const sRaw = localStorage.getItem('ng_theme_' + serverId); if (sRaw){ const sObj = JSON.parse(sRaw); if (sObj && sObj.bgMode === 'light') return true; } }catch(e){}
    try{ const gRaw = localStorage.getItem('ng_theme_global'); if (gRaw){ const gObj = JSON.parse(gRaw); if (gObj && gObj.bgMode === 'light') return true; } }catch(e){}
    const t = localStorage.getItem('ng_theme'); if (t === 'light') return true; return false;
  }
  function syncModalTheme(modal){ if (!modal) return; const isLight = modalShouldUseLight() || document.documentElement.classList.contains('theme-light'); console.log('syncModalTheme', {serverId: serverId, isLight}); modal.classList.toggle('light-theme', isLight);
  const content = modal.querySelector('.modal-content');
  if (isLight){ modal.style.background = 'rgba(11,15,18,0.06)'; if (content){ content.style.background = 'rgba(255,255,255,0.98)'; content.style.border = '1px solid rgba(16,20,24,0.06)'; content.style.color = 'var(--text)'; } modal.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el=>{ el.style.background='rgba(255,255,255,0.98)'; el.style.color='var(--text)'; el.style.border='1px solid rgba(16,20,24,0.06)'; }); }
  else { modal.style.background = ''; if (content){ content.style.background = ''; content.style.border = ''; content.style.color = ''; } modal.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el=>{ el.style.background=''; el.style.color=''; el.style.border=''; }); } }

  // Ensure autofill styling persists when plugin modals are reopened
  function syncAutofillInModal(modal){
    if (!modal) return;
    const isLight = modal.classList.contains('light-theme') || modalShouldUseLight();
    const inputs = modal.querySelectorAll('input[type="text"], input[type="number"], textarea');
    inputs.forEach(input=>{
      try{
        const hasValue = input.value && String(input.value).trim() !== '';
        if (hasValue) input.dataset.autofilled = 'true'; else delete input.dataset.autofilled;

        if (input.dataset.autofilled === 'true'){
          const docStyle = getComputedStyle(document.documentElement);
          const bg = isLight ? 'rgba(255,255,255,0.98)' : (docStyle.getPropertyValue('--card') || 'var(--card)');
          const txt = (docStyle.getPropertyValue('--text') || '#e9eef6').trim();
          const bdr = isLight ? '1px solid rgba(16,20,24,0.06)' : '1px solid var(--border)';
          try{
            input.style.background = bg;
            input.style.color = txt;
            input.style.border = bdr;
            input.style.setProperty('box-shadow', 'inset 0 0 0 1000px ' + bg, 'important');
            input.style.setProperty('-webkit-box-shadow', 'inset 0 0 0 1000px ' + bg, 'important');
            input.style.setProperty('-webkit-text-fill-color', txt, 'important');
            const cur = input.value;
            try{ input.value = ''; setTimeout(()=>{ input.value = cur; }, 20); }catch(e){}
          }catch(e){}
        } else {
          try{
            input.style.removeProperty('box-shadow');
            input.style.removeProperty('-webkit-box-shadow');
            input.style.removeProperty('background');
            input.style.removeProperty('color');
            input.style.removeProperty('-webkit-text-fill-color');
          }catch(e){}
        }

        if (!input._autofillHandlerAttached){
          input.addEventListener('input', ()=>{ if (input.value && String(input.value).trim() !== '') input.dataset.autofilled = 'true'; else delete input.dataset.autofilled; syncAutofillInModal(modal); });
          input._autofillHandlerAttached = true;
        }
      }catch(e){ }
    });
  }

  // Apply saved theme on load (system = use default prefers-color-scheme) and react to system changes
  (function(){
    const savedTheme = localStorage.getItem('ng_theme') || 'system';
    function applySys(theme){
      if (theme === 'light') document.documentElement.classList.add('theme-light');
      else if (theme === 'dark') document.documentElement.classList.remove('theme-light');
      else {
        const isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        if (isLight) document.documentElement.classList.add('theme-light'); else document.documentElement.classList.remove('theme-light');
      }
    }
    applySys(savedTheme);
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
    if (mq && mq.addEventListener){ mq.addEventListener('change', ()=>{ if ((localStorage.getItem('ng_theme')||'system') === 'system') applySys('system'); }); }
    else if (mq && mq.addListener){ mq.addListener(()=>{ if ((localStorage.getItem('ng_theme')||'system') === 'system') applySys('system'); }); }
  })();

  // Add a compact server info panel (fills empty space and gives quick actions)
  const headerMeta = document.createElement('div'); headerMeta.style.display='flex'; headerMeta.style.gap='18px'; headerMeta.style.marginTop='6px';
  const infoCard = document.createElement('div'); infoCard.className='server-info-card';
  infoCard.innerHTML = `<strong>Server ID</strong><div class="small-muted" id="server-id">${serverId}</div>`;
  const actionsCard = document.createElement('div'); actionsCard.className='server-info-card';
  actionsCard.innerHTML = `<strong>Actions</strong><div style="margin-top:8px"><button id="sync-plugins" class="btn ghost">Sync plugins</button> <button id="refresh-guilds" class="btn ghost">Refresh</button></div>`;
  headerMeta.appendChild(infoCard); headerMeta.appendChild(actionsCard);
  const header = document.getElementById('server-header'); if (header) header.appendChild(headerMeta);

  // Modal markup (inserted early so it's available before handlers run)
  (function(){
    const existing = document.getElementById('plugin-modal'); if (existing) return;
    const modal = document.createElement('div'); modal.className='modal'; modal.id='plugin-modal'; modal.setAttribute('aria-hidden','true'); modal.innerHTML = `
      <div class="modal-content modal-config">
        <button class="modal-close" onclick="closePluginConfig()">✕</button>
        <div class="modal-side">
          <div style="padding:10px 12px;color:var(--muted);font-weight:700">Settings</div>

          <button class="panel-option active" data-section="welcome">WelcomeMessage</button>
          <button class="panel-option" data-section="bye">ByeMessage</button>
        </div>
        <div class="modal-section" id="plugin-modal-body">
          <h3 id="plugin-modal-title">Plugin</h3>
          <p id="plugin-modal-desc" class="small-muted"></p>

          <div class="section-block" data-section="welcome">
            <div style="margin-top:12px">
              <label style="display:block;margin-bottom:6px">Welcome channel ID</label>
              <input id="plugin-modal-welcome-channel" type="text" placeholder="Channel ID (optional)" />
            </div>
            <div style="margin-top:12px">
              <label style="display:block;margin-bottom:6px">Welcome message</label>
              <textarea id="plugin-modal-welcome-message" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text)">Welcome {user} to our server!</textarea>
              <div class="small-muted" style="margin-top:6px;font-size:0.82rem">Tips: use <code>{mention}</code> to mention the user (pings), <code>{user}</code> for username, and <code>{server}</code> for the server name.</div>
            </div>
          </div>

          <div class="section-block" data-section="bye" style="display:none">
            <div style="margin-top:12px">
              <label style="display:block;margin-bottom:6px">Bye channel ID</label>
              <input id="plugin-modal-bye-channel" type="text" placeholder="Channel ID (optional)" />
            </div>
            <div style="margin-top:12px">
              <label style="display:block;margin-bottom:6px">Bye message</label>
              <textarea id="plugin-modal-bye-message" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text)">Goodbye {user}!</textarea>
              <div class="small-muted" style="margin-top:6px;font-size:0.82rem">Tips: use <code>{mention}</code> to mention the user (pings), <code>{user}</code> for username, and <code>{server}</code> for the server name.</div>
            </div>
          </div>



          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn ghost" onclick="closePluginConfig()">Cancel</button>
            <button id="plugin-modal-reset" class="btn ghost">Reset</button>
            <button id="plugin-modal-test" class="btn ghost">Send test</button>
            <button id="plugin-modal-save" class="btn primary">Save</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

// Theme controls: apply saved theme and wire up buttons
(function(){
  const saved = localStorage.getItem('ng_theme') || 'system';
  function applyTheme(theme){
    if (theme === 'light'){
      document.documentElement.classList.add('theme-light');
    } else if (theme === 'dark'){
      document.documentElement.classList.remove('theme-light');
    } else {
      // system
      const isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      if (isLight) document.documentElement.classList.add('theme-light'); else document.documentElement.classList.remove('theme-light');
    }
    localStorage.setItem('ng_theme', theme);
    const btns = modal.querySelectorAll('.theme-btn');
    btns.forEach(b=>{ if (b.dataset.theme === theme){ b.classList.add('active'); b.setAttribute('aria-pressed','true'); } else { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); } });
  }
  // Modal theme is driven by server/global settings; sync on open and listen for storage changes
  (function(){ function update(){ modal.classList.toggle('light-theme', modalShouldUseLight()); } update(); window.addEventListener('storage', update); })();

  // react to system changes when in 'system' mode
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
  if (mq && mq.addEventListener){ mq.addEventListener('change', ()=>{ if ((localStorage.getItem('ng_theme')||'system') === 'system') applyTheme('system'); }); }
  else if (mq && mq.addListener){ mq.addListener(()=>{ if ((localStorage.getItem('ng_theme')||'system') === 'system') applyTheme('system'); }); }

  applyTheme(saved);
})();

    // close when clicking outside content
    modal.addEventListener('click', (e)=>{ if (e.target === modal) { if (typeof window.closePluginConfig === 'function') window.closePluginConfig(); } });
    // close on Escape
    window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape'){ const m = document.getElementById('plugin-modal'); if (m && m.getAttribute('aria-hidden') === 'false') { if (typeof window.closePluginConfig === 'function') window.closePluginConfig(); } } });

    // create a reusable custom confirm modal (replaces native confirm())
    (function(){
      if (document.getElementById('confirm-modal')) return;
      const c = document.createElement('div'); c.id = 'confirm-modal'; c.className='modal'; c.setAttribute('aria-hidden','true');
      c.innerHTML = `
        <div class="modal-content confirm-modal">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <div class="confirm-icon" aria-hidden="true">⚠️</div>
            <div style="flex:1;min-width:0">
              <h3 id="confirm-modal-title">Reset</h3>
              <p id="confirm-modal-msg" class="small-muted">Are you sure you want to reset this setting to defaults?</p>
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
            <button id="confirm-cancel" class="btn ghost">Cancel</button>
            <button id="confirm-ok" class="btn danger">Reset</button>
          </div>
        </div>`;
      document.body.appendChild(c);

      const okBtn = c.querySelector('#confirm-ok');
      const cancelBtn = c.querySelector('#confirm-cancel');
      let _confirmResolve = null;
      function openConfirm(msg, title){
        c.setAttribute('aria-hidden','false'); c.style.display='flex';
        const t = document.getElementById('confirm-modal-title'); if (t) t.textContent = title || 'Reset';
        const m = document.getElementById('confirm-modal-msg'); if (m) m.textContent = msg || '';
        // focus primary
        setTimeout(()=>{ if (okBtn) okBtn.focus(); }, 50);
        return new Promise((resolve)=>{ _confirmResolve = resolve; });
      }
      function closeConfirm(val){
        c.setAttribute('aria-hidden','true'); setTimeout(()=>{ c.style.display='none'; }, 200);
        if (_confirmResolve){ _confirmResolve(Boolean(val)); _confirmResolve = null; }
      }
      okBtn.addEventListener('click', ()=> closeConfirm(true));
      cancelBtn.addEventListener('click', ()=> closeConfirm(false));
      c.addEventListener('click', (e)=>{ if (e.target === c) closeConfirm(false); });
      // keyboard: Enter to confirm, Escape to cancel
      c.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeConfirm(false); if (e.key === 'Enter') closeConfirm(true); });
      window.showConfirm = openConfirm; // global helper
    })();

    // Welcome modal (separate from generic modal)
    (function(){
      if (document.getElementById('plugin-modal-welcome')) return;
      const modal = document.createElement('div'); modal.id='plugin-modal-welcome'; modal.className='modal'; modal.setAttribute('aria-hidden','true');
      modal.innerHTML = `
        <div class="modal-content modal-config">
          <button class="modal-close" onclick="closeWelcomeConfig()">✕</button>
          <div class="modal-side">
            <div style="padding:10px 12px;color:var(--muted);font-weight:700">Welcome</div>
            <button class="panel-option active" data-section="welcome">Welcome message</button>
            <button class="panel-option" data-section="bye">Bye message</button>
          </div>
          <div class="modal-section" style="min-width:0">
            <h3>Welcome Plugin Settings</h3>
            <p class="small-muted">Configure welcome and goodbye messages for this server.</p>

            <div class="section-block" data-section="welcome">
              <div style="margin-top:12px">
                <label style="display:block;margin-bottom:6px">Welcome channel ID</label>
                <input id="welcome-modal-welcome-channel" type="text" placeholder="Channel ID (optional)" />
              </div>
              <div style="margin-top:12px">
                <label style="display:block;margin-bottom:6px">Welcome message</label>
                <textarea id="welcome-modal-welcome-message" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text)"></textarea>
              </div>
            </div>

            <div class="section-block" data-section="bye" style="display:none">
              <div style="margin-top:12px">
                <label style="display:block;margin-bottom:6px">Bye channel ID</label>
                <input id="welcome-modal-bye-channel" type="text" placeholder="Channel ID (optional)" />
              </div>
              <div style="margin-top:12px">
                <label style="display:block;margin-bottom:6px">Bye message</label>
                <textarea id="welcome-modal-bye-message" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text)"></textarea>
              </div>
            </div>

            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
              <button class="btn ghost" onclick="closeWelcomeConfig()">Cancel</button>
              <button id="welcome-modal-reset" class="btn ghost">Reset</button>
              <button id="welcome-modal-test" class="btn ghost">Send test</button>
              <button id="welcome-modal-save" class="btn primary">Save</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);

      // simple helper functions wired below by openWelcomeConfig
    })();

    // Giveaway modal (separate)
    (function(){
      if (document.getElementById('plugin-modal-giveaway')) return;
      const modal = document.createElement('div'); modal.id='plugin-modal-giveaway'; modal.className='modal'; modal.setAttribute('aria-hidden','true');
      modal.innerHTML = `
        <div class="modal-content modal-config">
          <button class="modal-close" onclick="closeGiveawayConfig()">✕</button>
          <div class="modal-section">
            <h3>Giveaway Defaults</h3>
            <p class="small-muted">Set default giveaway settings for this server.</p>
            <div style="margin-top:12px">
              <label style="display:block;margin-bottom:6px">Default duration (minutes)</label>
              <input id="giveaway-modal-duration" type="number" min="1" placeholder="Duration in minutes" />
            </div>
            <div style="margin-top:12px">
              <label style="display:block;margin-bottom:6px">Announcement channel ID</label>
              <input id="giveaway-modal-channel" type="text" placeholder="Channel ID (optional)" />
            </div>
            <div style="margin-top:12px">
              <label style="display:block;margin-bottom:6px">Default prize text</label>
              <input id="giveaway-modal-prize" type="text" placeholder="e.g., Nitro subscription" />
            </div>
            <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
              <label class="switch" style="margin:0"><input id="giveaway-modal-mention" type="checkbox" /><span class="switch-ui"></span><span class="switch-label">Mention winners by default</span></label>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
              <button class="btn ghost" onclick="closeGiveawayConfig()">Cancel</button>
              <button id="giveaway-modal-reset" class="btn ghost">Reset</button>
              <button id="giveaway-modal-save" class="btn primary">Save</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);

      // simple helper functions wired below by openGiveawayConfig
    })();
  })();

  // load plugin state: prefer server-side if authenticated, otherwise localStorage
  let serverAuth = false;
  function getPluginKey(id){ return `ng_plugins_${serverId}`; }
  async function detectServerAuth(){
    try{
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok){ const data = await res.json(); if (data?.user) { serverAuth = true; document.querySelector('.section-lead').textContent = 'Enable or configure plugins for this server. Changes are saved to the server.'; return; } }
    }catch(e){ /* ignore */ }
    serverAuth = false;
  }
  async function loadPluginState(){
    if (serverAuth){
      try{
        const res = await fetch(`/api/server-plugins/${encodeURIComponent(serverId)}`, { credentials: 'include' });
        if (res.ok){ const body = await res.json(); return body.state || {}; }
        if (res.status === 401){ serverAuth = false; }
      }catch(e){ showToast('Failed to fetch plugin state from server; using local values', 'error'); }
    }
    try{ const raw = localStorage.getItem(getPluginKey(serverId)); if (!raw) return {}; return JSON.parse(raw) || {}; }catch(e){ return {}; }
  }
  async function savePluginState(state){
    if (serverAuth){
      try{
        const res = await fetch(`/api/server-plugins/${encodeURIComponent(serverId)}`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ state }) });
        if (res.ok) { showToast('Saved to server', 'info'); return; }
        if (res.status === 401){ serverAuth = false; }
      }catch(e){ showToast('Failed to save to server; falling back to local', 'error'); }
    }

    try{ localStorage.setItem(getPluginKey(serverId), JSON.stringify(state)); showToast('Saved locally', 'info'); }catch(e){ showToast('Failed to save', 'error'); }
  }

  // Wire up header actions
  document.addEventListener('click', (ev)=>{
    if (ev.target && ev.target.id === 'sync-plugins'){
      // attempt to re-fetch from server and re-render
      (async ()=>{ showToast('Syncing plugin state…', 'info'); await detectServerAuth(); await renderPlugins(); showToast('Sync complete', 'info'); })();
    }
    if (ev.target && ev.target.id === 'refresh-guilds'){
      window.location.reload();
    }
    if (ev.target && ev.target.id === 'refresh-members'){
      (async ()=>{ showToast('Refreshing members…', 'info'); await loadMembers(); showToast('Members refreshed', 'info'); })();
    }
  });

  function showToast(message, type='info', duration=1400){
    if (window.showToast && window.showToast !== showToast && typeof window.showToast === 'function'){
      return window.showToast(message, type, duration);
    }
    let t = document.querySelector('.toast');
    if (!t){ t = document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.innerHTML = '<div class="toast-icon" aria-hidden="true"></div><div class="toast-text"></div><button class="toast-close" aria-label="Close">✕</button>'; document.body.appendChild(t); t.querySelector('.toast-close').addEventListener('click', ()=>{ t.classList.remove('show'); clearTimeout(t._hide); }); }
    try{ t.style.zIndex = 20000; }catch(e){}
    const txt = t.querySelector('.toast-text'); if (txt) txt.textContent = message; t.classList.remove('toast-error','toast-info'); t.classList.add(type==='error'? 'toast-error':'toast-info'); t.classList.add('show'); clearTimeout(t._hide); t._hide = setTimeout(()=> t.classList.remove('show'), duration);

  async function renderPlugins(){
    const grid = document.getElementById('plugin-grid');
    grid.innerHTML = '';
    const state = await loadPluginState();
    PLUGINS.forEach(p => {
      const pid = p.id || p.title?.toLowerCase();
      const enabled = (pid in state) ? !!state[pid] : true; // default to enabled
      const div = document.createElement('div'); div.className = 'plugin-card';
      div.innerHTML = `
        <span class="plugin-card-status ${enabled ? 'enabled' : 'disabled'}" title="Status: ${enabled ? 'Enabled' : 'Disabled'}"></span>
        <div style="display:flex;gap:12px;align-items:center;width:100%">
          <div class="plugin-icon" aria-hidden="true">${p.icon || '❔'}</div>
          <div style="flex:1">
            <h4 style="margin:0">${p.title || p.titleNice || pid}</h4>
            <p style="margin:6px 0 0">${p.description}</p>
            <div class="small-muted" style="margin-top:8px;font-size:0.85rem">Status: <strong>${enabled ? 'Enabled' : 'Disabled'}</strong></div>
          </div>
        </div>
        <div class="plugin-actions">
          <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
            <button class="btn ${enabled ? 'ghost' : 'primary'} toggle-btn" data-id="${pid}">${enabled ? 'Disable' : 'Enable'}</button>
            <button class="btn ghost configure-btn" data-id="${pid}">Configure</button>
          </div>
        </div>
      `;
      grid.appendChild(div);
    });

    // attach handlers
    grid.querySelectorAll('.toggle-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.dataset.id;
        const st = await loadPluginState();
        const current = (id in st) ? !!st[id] : true;
        st[id] = !current;
        // optimistic UI update
        const enabled = !!st[id];
        btn.classList.toggle('primary', !enabled);
        btn.classList.toggle('ghost', enabled);
        btn.textContent = enabled ? 'Disable' : 'Enable';
        const plugin = PLUGINS.find(x=> (x.id===id) || (x.title && x.title.toLowerCase()===id) );
        // update status dot on card
        const card = btn.closest('.plugin-card'); if (card){ const dot = card.querySelector('.plugin-card-status'); if (dot){ dot.classList.toggle('enabled', !!enabled); dot.classList.toggle('disabled', !enabled); dot.title = enabled ? 'Status: Enabled' : 'Status: Disabled'; } }
        // save change (server or local) - try sending only the delta for efficiency
        if (serverAuth){
          try{
            const res = await fetch(`/api/server-plugins/${encodeURIComponent(serverId)}`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pluginId: id, enabled }) });
            if (res.ok){ showToast(`${enabled ? 'Enabled' : 'Disabled'} plugin: ${plugin ? (plugin.title || plugin.titleNice) : id}`, 'info'); return; }
            if (res.status === 401){ serverAuth = false; showToast('Not authenticated; changes will be saved locally', 'error'); }
          }catch(e){ showToast('Failed to save to server; change saved locally', 'error'); }
        }

        // fallback to local save
        savePluginState(st);
        showToast(`${enabled ? 'Enabled' : 'Disabled'} plugin: ${plugin ? (plugin.title || plugin.titleNice) : id}`, 'info');
      });
    });

    // configure button handlers
    grid.querySelectorAll('.configure-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.id;
        openPluginConfig(id);
      });
    });

    // plugin configuration modal
    // expose as globals so modal inline handlers can access them reliably
    // Dispatcher to open plugin-specific modals
    window.openPluginConfig = function(id){
      if (id === 'welcome') return (typeof window.openWelcomeConfig === 'function') ? window.openWelcomeConfig(id) : showToast('Welcome modal not ready', 'error');
      if (id === 'giveaway') {
        if (typeof window.openGiveawayConfig === 'function') return window.openGiveawayConfig(id);
        const gm = document.getElementById('plugin-modal-giveaway'); if (gm){ gm.setAttribute('aria-hidden','false'); gm.style.display='flex'; syncAutofillInModal(gm); return; }
        return showToast('Giveaway modal not ready', 'error');
      }
      // fallback: open generic modal
      const modal = document.getElementById('plugin-modal');
      const title = document.getElementById('plugin-modal-title');
      const desc = document.getElementById('plugin-modal-desc');
      const plugin = PLUGINS.find(p => p.id === id || (p.title && p.title.toLowerCase()===id));
      if (title) title.textContent = (plugin && (plugin.title || plugin.titleNice)) ? (plugin.title || plugin.titleNice) : id.charAt(0).toUpperCase()+id.slice(1);
      if (desc) desc.textContent = plugin ? plugin.description : 'This plugin has no configurable options via the dashboard.';
      if (modal){ syncModalTheme(modal); modal.setAttribute('aria-hidden','false'); modal.style.display='flex'; syncAutofillInModal(modal); }
    };

    // Welcome plugin modal handlers
    window.openWelcomeConfig = async function(id){
      const modal = document.getElementById('plugin-modal-welcome'); if (!modal) return showToast('Modal not available', 'error');
      const wCh = document.getElementById('welcome-modal-welcome-channel');
      const wMsg = document.getElementById('welcome-modal-welcome-message');
      const bCh = document.getElementById('welcome-modal-bye-channel');
      const bMsg = document.getElementById('welcome-modal-bye-message');
      const saveBtn = document.getElementById('welcome-modal-save');
      const resetBtn = document.getElementById('welcome-modal-reset');
      const welcomeTestBtn = document.getElementById('welcome-modal-test');

      // load saved settings (server or local)
      let obj = { welcome:{channel:'',message:'Welcome {user} to our server!'}, bye:{channel:'',message:'Goodbye {user}!'} };
      try{
        if (serverAuth){
          const res = await fetch(`/api/server-plugin-config/${encodeURIComponent(serverId)}`, { credentials: 'include' });
          if (res.ok){ const body = await res.json(); if (body && body.config){ const cfg = body.config[id] || body.config; if (cfg.welcome || cfg.bye){ obj.welcome = Object.assign({}, obj.welcome, cfg.welcome || {}); obj.bye = Object.assign({}, obj.bye, cfg.bye || {}); } else { obj = Object.assign({}, obj, cfg); } } }
          if (res.status === 401) serverAuth = false;
        }else{
          const raw = localStorage.getItem(`ng_plugin_config_${serverId}_${id}`); if (raw) obj = JSON.parse(raw);
        }
      }catch(e){ console.warn('Failed to load welcome config', e); }

      wCh.value = (obj.welcome && obj.welcome.channel) || '';
      wMsg.value = (obj.welcome && obj.welcome.message) || 'Welcome {user} to our server!';
      bCh.value = (obj.bye && obj.bye.channel) || '';
      bMsg.value = (obj.bye && obj.bye.message) || 'Goodbye {user}!';

      // setup side buttons (Welcome/Bye) inside modal
      const sideButtons = modal.querySelectorAll('.panel-option') || [];
      function setActiveSectionWelcome(s){
        modal.querySelectorAll('.section-block').forEach(sb=>{ sb.style.display = (sb.dataset.section === s) ? 'block' : 'none'; });
        sideButtons.forEach(b=> b.classList.toggle('active', b.dataset.section === s));
      }
      sideButtons.forEach(b=> b.onclick = ()=> setActiveSectionWelcome(b.dataset.section));
      // default
      setActiveSectionWelcome('welcome');

      syncModalTheme(modal); modal.setAttribute('aria-hidden','false'); modal.style.display='flex';

      if (saveBtn){ saveBtn.onclick = async ()=>{
        const data = { welcome:{ channel: (wCh? wCh.value.trim() : ''), message: (wMsg? wMsg.value.trim(): '') }, bye:{ channel: (bCh? bCh.value.trim(): ''), message: (bMsg? bMsg.value.trim(): '') } };
        if (serverAuth){ try{ const res = await fetch(`/api/server-plugin-config/${encodeURIComponent(serverId)}`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pluginId: id, config: data }) }); if (res.ok){ showToast('Saved settings to server', 'info'); closeWelcomeConfig(); return; } if (res.status === 401) { serverAuth = false; showToast('Not authenticated; changes saved locally', 'error'); } }catch(e){ showToast('Failed to save to server; saved locally', 'error'); } }
        localStorage.setItem(`ng_plugin_config_${serverId}_${id}`, JSON.stringify(data)); showToast('Saved locally', 'info'); closeWelcomeConfig(); } }

    // Reset/test handlers wired after this block

    // Giveaway plugin modal handlers
    window.openGiveawayConfig = async function(id){
      const modal = document.getElementById('plugin-modal-giveaway'); if (!modal) return showToast('Modal not available', 'error');
      const dur = document.getElementById('giveaway-modal-duration');
      const ch = document.getElementById('giveaway-modal-channel');
      const prize = document.getElementById('giveaway-modal-prize');
      const mention = document.getElementById('giveaway-modal-mention');
      const saveBtn = document.getElementById('giveaway-modal-save');
      const resetBtn = document.getElementById('giveaway-modal-reset');

      // load
      let obj = { giveaway:{ duration:60, channel:'', prize:'', mention:true } };
      try{ if (serverAuth){ const res = await fetch(`/api/server-plugin-config/${encodeURIComponent(serverId)}`, { credentials: 'include' }); if (res.ok){ const body = await res.json(); if (body && body.config){ const cfg = body.config[id] || body.config; if (cfg.giveaway) obj.giveaway = Object.assign({}, obj.giveaway, cfg.giveaway); else obj = Object.assign({}, obj, cfg); } } if (res.status === 401) serverAuth=false; } else { const raw = localStorage.getItem(`ng_plugin_config_${serverId}_${id}`); if (raw) obj = JSON.parse(raw); } }catch(e){ console.warn('Failed to load giveaway config', e); }

      dur.value = (obj.giveaway && obj.giveaway.duration) ? String(obj.giveaway.duration) : '60';
      ch.value = (obj.giveaway && obj.giveaway.channel) || '';
      prize.value = (obj.giveaway && obj.giveaway.prize) || '';
      mention.checked = (obj.giveaway && typeof obj.giveaway.mention !== 'undefined') ? !!obj.giveaway.mention : true;

      syncModalTheme(modal); modal.setAttribute('aria-hidden','false'); modal.style.display='flex';

      if (saveBtn){ saveBtn.onclick = async ()=>{ const data = { giveaway:{ duration: (dur && !isNaN(Number(dur.value))) ? Number(dur.value) : 60, channel: (ch? ch.value.trim() : ''), prize: (prize? prize.value.trim() : ''), mention: (mention? !!mention.checked : true) } };
        if (serverAuth){ try{ const res = await fetch(`/api/server-plugin-config/${encodeURIComponent(serverId)}`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pluginId: id, config: data }) }); if (res.ok){ showToast('Saved giveaway settings to server', 'info'); closeGiveawayConfig(); return; } if (res.status === 401){ serverAuth=false; showToast('Not authenticated; saved locally', 'error'); } }catch(e){ showToast('Failed to save to server; saved locally', 'error'); } }
        localStorage.setItem(`ng_plugin_config_${serverId}_${id}`, JSON.stringify(data)); showToast('Saved locally', 'info'); closeGiveawayConfig(); } }
    };

    // Reset/test handlers for welcome
    (function(){
      const resetBtn = document.getElementById('welcome-modal-reset');
      const welcomeTestBtn = document.getElementById('welcome-modal-test');
      if (resetBtn){ resetBtn.onclick = async ()=>{
        const ok = (typeof window.showConfirm === 'function') ? await window.showConfirm('Reset Welcome & Bye settings to defaults? This will clear any custom messages.','Reset Welcome/Bye') : confirm('Reset Welcome & Bye settings to defaults?');
        if (!ok) return;
        const pluginConfig = { welcome: { channel: '', message: null }, bye: { channel: '', message: null } };
        if (serverAuth){ try{ const res = await fetch(`/api/server-plugin-config/${encodeURIComponent(serverId)}`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pluginId: 'welcome', config: pluginConfig }) }); if (res.ok){ showToast('Reset settings on server', 'info'); const wCh=document.getElementById('welcome-modal-welcome-channel'), wMsg=document.getElementById('welcome-modal-welcome-message'), bCh=document.getElementById('welcome-modal-bye-channel'), bMsg=document.getElementById('welcome-modal-bye-message'); if (wCh) wCh.value=''; if (wMsg) wMsg.value='Welcome {user} to our server!'; if (bCh) bCh.value=''; if (bMsg) bMsg.value='Goodbye {user}!'; return; } if (res.status===401){ serverAuth=false; showToast('Not authenticated; reset locally', 'error'); } }catch(e){ showToast('Failed to reset on server; reset locally', 'error'); } }
        // local reset
        try{ const raw = localStorage.getItem(`ng_plugin_config_${serverId}_welcome`); let obj = { welcome:{channel:'',message:'Welcome {user} to our server!'}, bye:{channel:'',message:'Goodbye {user}!'} }; try{ if (raw) obj = JSON.parse(raw); }catch(e){} obj.welcome.channel=''; obj.welcome.message=null; obj.bye.channel=''; obj.bye.message=null; localStorage.setItem(`ng_plugin_config_${serverId}_welcome`, JSON.stringify(obj)); const wCh=document.getElementById('welcome-modal-welcome-channel'), wMsg=document.getElementById('welcome-modal-welcome-message'), bCh=document.getElementById('welcome-modal-bye-channel'), bMsg=document.getElementById('welcome-modal-bye-message'); if (wCh) wCh.value=''; if (wMsg) wMsg.value='Welcome {user} to our server!'; if (bCh) bCh.value=''; if (bMsg) bMsg.value='Goodbye {user}!'; showToast('Reset locally', 'info'); }catch(e){ showToast('Failed to reset', 'error'); }
      }; }

      if (welcomeTestBtn){ welcomeTestBtn.onclick = async ()=>{
        showToast('Sending welcome test…', 'info');
        try{ const res = await fetch(`/api/server-plugin-test/${encodeURIComponent(serverId)}`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pluginId: 'welcome', testType: 'welcome' }) }); if (res.ok) { showToast('Test sent to bot', 'info'); return; } if (res.status===401) showToast('Not authenticated; cannot send test', 'error'); }catch(e){ showToast('Failed to send test', 'error'); }
      }; }
    })();

    // Reset handlers for giveaway
    (function(){
      const resetBtn = document.getElementById('giveaway-modal-reset');
      if (resetBtn){ resetBtn.onclick = async ()=>{
        const ok = (typeof window.showConfirm === 'function') ? await window.showConfirm('Reset Giveaway defaults to original values?','Reset Giveaway') : confirm('Reset Giveaway defaults to original values?');
        if (!ok) return;
        const pluginConfig = { giveaway: { duration: 60, channel: '', prize: null, mention: true } };
        if (serverAuth){ try{ const res = await fetch(`/api/server-plugin-config/${encodeURIComponent(serverId)}`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pluginId: 'giveaway', config: pluginConfig }) }); if (res.ok){ showToast('Reset giveaway defaults on server', 'info'); const d=document.getElementById('giveaway-modal-duration'), ch=document.getElementById('giveaway-modal-channel'), pr=document.getElementById('giveaway-modal-prize'), mn=document.getElementById('giveaway-modal-mention'); if (d) d.value='60'; if (ch) ch.value=''; if (pr) pr.value=''; if (mn) mn.checked=true; return; } if (res.status===401){ serverAuth=false; showToast('Not authenticated; reset locally', 'error'); } }catch(e){ showToast('Failed to reset on server; reset locally', 'error'); } }
        // local fallback
        try{ const raw = localStorage.getItem(`ng_plugin_config_${serverId}_giveaway`); let obj = { giveaway:{ duration:60, channel:'', prize:'', mention:true } }; try{ if (raw) obj = JSON.parse(raw); }catch(e){} obj.giveaway.duration=60; obj.giveaway.channel=''; obj.giveaway.prize=''; obj.giveaway.mention=true; localStorage.setItem(`ng_plugin_config_${serverId}_giveaway`, JSON.stringify(obj)); const d=document.getElementById('giveaway-modal-duration'), ch=document.getElementById('giveaway-modal-channel'), pr=document.getElementById('giveaway-modal-prize'), mn=document.getElementById('giveaway-modal-mention'); if (d) d.value='60'; if (ch) ch.value=''; if (pr) pr.value=''; if (mn) mn.checked=true; showToast('Reset locally', 'info'); }catch(e){ showToast('Failed to reset', 'error'); }
      }; }
    })();

    };

    window.closePluginConfig = function(){ const modal = document.getElementById('plugin-modal'); if (!modal) return; modal.setAttribute('aria-hidden','true'); setTimeout(()=>{ modal.style.display='none'; }, 220); }; 

    // refresh activity and members when rendering plugins
    loadActivityFeed();
    loadMembers();
  }
  

  async function loadActivityFeed(){
    const feed = document.getElementById('activity-feed'); if (!feed) return;
    feed.innerHTML = '<p class="small-muted">Loading activity…</p>';
    try{
      const res = await fetch(`/api/server-activity/${encodeURIComponent(serverId)}`);
      if (res.ok){ const body = await res.json(); const arr = body.activity || [];
        if (arr.length === 0) { feed.innerHTML = '<p class="small-muted">No recent activity for this server.</p>'; return; }
        feed.innerHTML = '';
        arr.slice(0,30).forEach(a => {
          const d = new Date(a.ts || Date.now());
          const who = a.user ? (a.user.username) : 'System';
          const p = document.createElement('div'); p.className = 'activity-item';
          p.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><div style="width:10px;height:10px;border-radius:999px;background:${a.enabled ? 'var(--accent)' : 'var(--danger)'}"></div><div style="flex:1"><strong>${a.pluginId}</strong> ${a.enabled ? 'enabled' : 'disabled'} <div class="small-muted">by ${who} · ${d.toLocaleString()}</div></div></div>`;
          feed.appendChild(p);
        });
        return;
      }
    }catch(e){ console.warn('Failed to load activity', e); }
    feed.innerHTML = '<p class="small-muted">Failed to load activity.</p>';
  }

  async function loadMembers(){
    const list = document.getElementById('members-list'); if (!list) return;
    list.innerHTML = '<p class="small-muted">Loading members…</p>';
    try{
      const res = await fetch(`/api/guild-members/${encodeURIComponent(serverId)}?limit=30`);
      if (res.ok){ const body = await res.json(); const members = body.members || [];
        if (members.length === 0) { list.innerHTML = '<p class="small-muted">No members found or bot not present in this guild.</p>'; return; }
        list.innerHTML = '';
        const listContainer = document.createElement('div'); listContainer.className = 'member-list';

        // Fetch presences from server proxy (optional)
        let presenceMap = {};
        try{
          const pRes = await fetch(`/api/guild-presences/${encodeURIComponent(serverId)}`);
          if (pRes.ok){ const pBody = await pRes.json(); const presences = pBody.presences || pBody || [];
            presences.forEach(p => { if (p && p.id) presenceMap[p.id] = (p.status || p.presence || 'unknown').toLowerCase(); });
          }
        }catch(e){ console.warn('Failed to fetch presences', e); }

        members.forEach(m => {
          const item = document.createElement('div'); item.className='member-item';
          const avatar = m.avatar ? ('https://cdn.discordapp.com/avatars/' + m.id + '/' + m.avatar + (String(m.avatar).startsWith('a_') ? '.gif' : '.png') + '?size=64') : 'https://cdn.jsdelivr.net/gh/identicons/identicon.png';
          const status = (presenceMap[m.id] || m.status || m.presence || 'unknown').toLowerCase();
          item.innerHTML = `
            <div style="display:flex;gap:12px;align-items:center;width:100%">
              <div class="avatar-wrap" style="position:relative;flex:0 0 48px">
                <img src="${avatar}" alt="${m.username}" class="member-avatar" data-member-id="${m.id}">
                <span class="status-dot status-${status}" data-member-id="${m.id}" title="Status: ${status}"></span>
              </div>
              <div style="flex:1;min-width:0">
                <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.username}</strong>
                <div class="small-muted" style="font-size:0.85rem;margin-top:4px">ID: ${m.id}</div>
              </div>
            </div>`;
          listContainer.appendChild(item);
        });
        list.appendChild(listContainer);
        // ensure images have fallback if available
        try{ if (typeof attachImageFallbacks === 'function') attachImageFallbacks(list); }catch(e){ console.warn('attachImageFallbacks not available', e); }
        return;
      } else {
        const text = await res.text().catch(()=>null);
        console.warn('Members fetch returned', res.status, text);
        list.innerHTML = `<p class="small-muted">Failed to load members (status ${res.status}). ${text ? 'See console for details.' : ''}</p>`;
        return;
      }
    }catch(e){ console.warn('Failed to load members', e); }
    list.innerHTML = '<p class="small-muted">Failed to load members.</p>';
  }

  // Poll presences every 30s when this page is open
  let _presencePoll = null;
  async function refreshPresences(){
    try{
      const res = await fetch(`/api/guild-presences/${encodeURIComponent(serverId)}`);
      if (res.ok){ const body = await res.json(); const pres = body.presences || body || [];
        pres.forEach(p => {
          const id = p.id;
          const status = (p.status || p.presence || 'unknown').toLowerCase();
          // update any dots
          document.querySelectorAll(`.status-dot[data-member-id="${id}"]`).forEach(el => {
            el.className = 'status-dot status-'+status;
            el.title = 'Status: '+status;
          });
        });
      }
    }catch(e){ /* ignore */ }
  }

  (async ()=>{ await detectServerAuth(); await renderPlugins(); // start polling after initial render
    try{ await refreshPresences(); }catch(e){}
    if (_presencePoll) clearInterval(_presencePoll); _presencePoll = setInterval(refreshPresences, 30_000);
  })();

}
