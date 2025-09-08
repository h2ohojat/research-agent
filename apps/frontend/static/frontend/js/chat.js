// ==============================
// Pyamooz Chat — Frontend JS
// ==============================

// --- CSRF ---
function getCookie(name){
  const v=("; "+document.cookie).split("; "+name+"=");
  if(v.length===2) return v.pop().split(";").shift();
}
const csrftoken = getCookie("csrftoken");

// ---- tiny toast (inline) ----
let __toastBox;
function toast(msg, timeout=1400){
  if (!__toastBox){
    __toastBox = document.createElement('div');
    __toastBox.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:8px;flex-direction:column;";
    document.body.appendChild(__toastBox);
  }
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = "background:var(--bg-surface);color:var(--text);border:1px solid var(--border-light);padding:8px 12px;border-radius:10px;box-shadow:var(--shadow);font-size:14px;";
  __toastBox.appendChild(t);
  setTimeout(()=>t.remove(), timeout);
}

// --- robust clipboard helper (with fallback) ---
async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch(_){
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly','');
      ta.style.position='fixed';
      ta.style.opacity='0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }catch(__){ return false; }
  }
}

// --- Jump to bottom (FAB) ---
const jumpBtn = document.getElementById('jumpToBottom');
function getDocHeights(){
  const d=document.documentElement,b=document.body;
  const scrollTop = window.pageYOffset||d.scrollTop||b.scrollTop||0;
  const viewport  = window.innerHeight || d.clientHeight || b.clientHeight || 0;
  const fullHeight= Math.max(b.scrollHeight,d.scrollHeight,b.offsetHeight,d.offsetHeight,b.clientHeight,d.clientHeight);
  return {scrollTop,viewport,fullHeight};
}
function atBottom(){
  const near=40; const {scrollTop,viewport,fullHeight}=getDocHeights();
  return (scrollTop+viewport)>=(fullHeight-near);
}
function scrollBottom(smooth=true){
  const h=document.documentElement.scrollHeight||document.body.scrollHeight;
  window.scrollTo({top:h,behavior:smooth?'smooth':'auto'});
}
function updateJump(){ jumpBtn?.classList.toggle('show', !atBottom()); }
window.addEventListener('scroll', updateJump, {passive:true});
window.addEventListener('resize', updateJump);
jumpBtn?.addEventListener('click', ()=>scrollBottom(true));

// ===== Theme (mini + highlight.js theme toggle) =====
const THEME_KEY="py_theme";
function setTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  try{ localStorage.setItem(THEME_KEY,t); }catch(_){}
  const light=document.getElementById("hljsThemeLight");
  const dark =document.getElementById("hljsThemeDark");
  if(light&&dark){ if(t==="dark"){dark.disabled=false; light.disabled=true;} else {dark.disabled=true; light.disabled=false;} }
  // ممکن است ارتفاع کامپوزر تحت تم تغییر کند
  queueMicrotask(updateComposerOffset);
}
(function initTheme(){
  const saved=(typeof localStorage!=="undefined")?localStorage.getItem(THEME_KEY):null;
  setTheme(saved||"light");
  document.getElementById("themeToggleBtn")?.addEventListener("click", ()=>{
    const cur=document.documentElement.getAttribute("data-theme")||"light";
    setTheme(cur==="dark"?"light":"dark");
  });
})();

// --- Sticky Composer offset (برای جلوگیری از پوشش لیست) ---
const composerEl = document.getElementById('composer') || document.querySelector('.toolbar');
function updateComposerOffset(){
  try{
    const pad=12;
    const h = composerEl ? composerEl.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--composer-offset', Math.ceil(h+pad)+'px');
    updateJump();
  }catch(_){}
}
if (composerEl){
  try{
    const ro=new ResizeObserver(()=>updateComposerOffset());
    ro.observe(composerEl);
  }catch(_){}
  window.addEventListener('resize', updateComposerOffset);
  window.addEventListener('load', updateComposerOffset);
  setTimeout(updateComposerOffset,0);
}

// --- Markdown render (Marked + DOMPurify + highlight.js + code-copy) ---
function renderMarkdownTo(targetEl, rawText){
  if (!window.marked || !window.DOMPurify){ targetEl.textContent=rawText; return; }
  marked.setOptions({ breaks:true, gfm:true, langPrefix:'language-' });
  const html  = marked.parse(rawText);
  const clean = DOMPurify.sanitize(html, { USE_PROFILES:{html:true} });
  targetEl.innerHTML = `<div class="markdown-body">${clean}</div>`;
  if (window.hljs){
    targetEl.querySelectorAll('pre code').forEach(block=>{ try{ hljs.highlightElement(block);}catch(_){}} );
  }
  // Copy button برای هر کدبلاک
  targetEl.querySelectorAll('.markdown-body pre').forEach(pre=>{
    if (pre.querySelector('.code-copy-btn')) return;
    const btn=document.createElement('button');
    btn.type='button'; btn.className='code-copy-btn';
    btn.setAttribute('aria-label','کپی کد'); btn.textContent='Copy';
    btn.addEventListener('click', async ()=>{
      const code=pre.querySelector('code');
      const txt =(code?.innerText||code?.textContent||'').trim();
      const ok  = await copyToClipboard(txt);
      btn.textContent = ok?'Copied!':'Failed';
      toast(ok?'کد کپی شد':'کپی نشد');
      setTimeout(()=>btn.textContent='Copy',1200);
    });
    pre.appendChild(btn);
  });
}

// --- HTTP Helpers ---
const GET  =(url,opts={})=>fetch(url,{credentials:'same-origin',...opts});
const POST =(url,body,opts={})=>fetch(url,{
  method:'POST', credentials:'same-origin',
  headers:{'Content-Type':'application/json','X-CSRFToken':csrftoken||''},
  body:JSON.stringify(body), ...opts
});

// --- UI Elements ---
const list        = document.getElementById('list');
const inp         = document.getElementById('inp');
const sendBtn     = document.getElementById('send');
const newBtn      = document.getElementById('new');
const refreshBtn  = document.getElementById('refresh');
const titleEl     = document.getElementById('conv-title');
const convListEl  = document.getElementById('conv-list');
const providerSel = document.getElementById('provider');
const modelSel    = document.getElementById('model');

// --- State / Models ---
let conversationId = sessionStorage.getItem('conv_id');
const PROVIDERS = { avalai:["gpt-4o-mini","gpt-4o","gpt-4o-mini-transcribe"], fake:["echo"] };
const savedProv = sessionStorage.getItem('provider') || 'avalai';
if (providerSel) providerSel.value = savedProv;

function fillModels(presetModel){
  if (!providerSel || !modelSel) return;
  const p=providerSel.value; modelSel.innerHTML='';
  (PROVIDERS[p]||[]).forEach(m=>{
    const opt=document.createElement('option'); opt.value=m; opt.textContent=m; modelSel.appendChild(opt);
  });
  if (presetModel && (PROVIDERS[p]||[]).includes(presetModel)) modelSel.value=presetModel;
  else {
    const savedModel=sessionStorage.getItem('model');
    modelSel.value=(savedModel&&(PROVIDERS[p]||[]).includes(savedModel))?savedModel:((PROVIDERS[p]||[])[0]||'');
  }
}
fillModels(sessionStorage.getItem('model'));
providerSel?.addEventListener('change', ()=>{
  fillModels(null);
  sessionStorage.setItem('provider', providerSel.value);
  sessionStorage.setItem('model', modelSel.value);
});
modelSel?.addEventListener('change', ()=>{
  sessionStorage.setItem('provider', providerSel.value);
  sessionStorage.setItem('model', modelSel.value);
});

// ---- message helpers ----
function addBubble(role, text, streaming=false){
  const el=document.createElement('div');
  el.className='msg '+(role==='user'?'user':role==='assistant'?'assistant':'sys');

  const content=document.createElement('div'); content.className='msg-content';
  if (streaming){
    const span=document.createElement('span'); span.className='stream typing'; span.textContent='در حال نوشتن…'; content.appendChild(span);
  }else{
    if (role==='assistant'||role==='user') renderMarkdownTo(content,text);
    else content.textContent=text;
  }
  el.appendChild(content);

  const actions=document.createElement('div'); actions.className='msg-actions';
  const copyBtn=document.createElement('button'); copyBtn.type='button'; copyBtn.className='msg-action'; copyBtn.title='کپی متن پیام'; copyBtn.textContent='Copy';
  copyBtn.addEventListener('click', async ()=>{
    const txt=(content.innerText||content.textContent||'').trim();
    toast(await copyToClipboard(txt)?'کپی شد':'کپی نشد');
  });
  actions.appendChild(copyBtn); el.appendChild(actions);

  const wasBottom=atBottom(); list.appendChild(el);
  if (wasBottom) scrollBottom(true);
  updateComposerOffset(); updateJump();
  return el;
}
function addSys(text){
  const el=document.createElement('div'); el.className='msg sys'; el.textContent=text;
  const wasBottom=atBottom(); list.appendChild(el);
  if (wasBottom) scrollBottom(true);
  updateComposerOffset(); updateJump();
}

// --- Conversations list / title ---
async function loadHistory(convId){
  if(!convId) return;
  try{
    const res=await GET(`/api/v1/conversations/${convId}/messages`);
    if(!res.ok){
      if(res.status===404||res.status===403){
        sessionStorage.removeItem('conv_id'); conversationId=null;
        list.innerHTML=''; titleEl.textContent='';
        addSys('این گفتگو در دسترس نیست؛ احتمالاً متعلق به کاربر دیگری است یا حذف شده. لطفاً گفتگوی جدیدی شروع کنید.');
        return;
      }
      throw new Error('HTTP '+res.status);
    }
    const msgs=await res.json();
    list.innerHTML='';
    for(const m of msgs){
      const role=(m.role==='user')?'user':(m.role==='assistant'?'assistant':'sys');
      addBubble(role,m.content);
    }
    updateComposerOffset(); updateJump();
  }catch(e){ console.warn('history load failed', e); }
}
async function refreshTitle(){
  if(!conversationId){ titleEl.textContent=''; document.title='Pyamooz AI — Chat'; return; }
  try{
    const res=await GET('/api/v1/conversations'); const data=await res.json();
    const arr=data.results||data; const item=Array.isArray(arr)?arr.find(c=>String(c.id)===String(conversationId)):null;
    titleEl.textContent=item?.title?`عنوان گفتگو: ${item.title}`:'';
    if(item?.title) document.title=`Pyamooz AI — ${item.title}`;
  }catch(_e){}
}
function markActiveConv(){
  const nodes=convListEl?.querySelectorAll('.conv-item')||[];
  nodes.forEach(n=>{ if(conversationId&&n.dataset.id===String(conversationId)) n.classList.add('active'); else n.classList.remove('active'); });
}
async function loadConversationsList(){
  try{
    const res=await GET('/api/v1/conversations'); const data=await res.json(); const arr=data.results||data||[];
    if (convListEl) convListEl.innerHTML='';
    (arr||[]).forEach(c=>{
      const item=document.createElement('div'); item.className='conv-item'; item.dataset.id=c.id;
      item.innerHTML=`<div class="ttl">${c.title||'(بدون عنوان)'}</div><div class="meta">#${c.id}</div>`;
      item.onclick=async ()=>{
        sessionStorage.setItem('conv_id',String(c.id));
        conversationId=String(c.id);
        await loadHistory(conversationId); await refreshTitle(); markActiveConv();
      };
      convListEl?.appendChild(item);
    });
    const exists=arr.some(c=>String(c.id)===String(conversationId));
    if(!exists){
      if(arr.length){
        conversationId=String(arr[0].id);
        sessionStorage.setItem('conv_id',conversationId);
        await loadHistory(conversationId); await refreshTitle(); markActiveConv();
      }else{
        sessionStorage.removeItem('conv_id'); conversationId=null; list.innerHTML=''; titleEl.textContent='';
      }
    }else{ markActiveConv(); }
    updateComposerOffset(); updateJump();
  }catch(e){ console.warn('conv list failed', e); }
}
async function getLastAssistant(convId){
  if(!convId) return null;
  const res=await GET(`/api/v1/conversations/${convId}/messages`);
  if(!res.ok) return null;
  const msgs=await res.json();
  for(let i=msgs.length-1;i>=0;i--){ if(msgs[i].role==='assistant') return msgs[i]; }
  return null;
}

// ---- Send/Stream: one-button (Send ↔ Stop) ----
let isStreaming=false, currentWS=null, activeStreamCtx=null;

function setSendButton(mode){ // 'send' | 'stop'
  if(!sendBtn) return;
  sendBtn.dataset.mode=mode;
  if(mode==='stop'){
    sendBtn.classList.remove('icon-btn--primary');
    sendBtn.classList.add('icon-btn--danger');
    sendBtn.title='توقف تولید'; sendBtn.setAttribute('aria-label','توقف تولید');
    sendBtn.innerHTML=`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"></rect></svg>`;
  }else{
    sendBtn.classList.remove('icon-btn--danger');
    sendBtn.classList.add('icon-btn--primary');
    sendBtn.title='ارسال'; sendBtn.setAttribute('aria-label','ارسال');
    sendBtn.innerHTML=`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M12 5l-6 6M12 5l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
}
setSendButton('send');

function abortStream(){
  if(!isStreaming||!currentWS||!activeStreamCtx) return;
  try{ currentWS.close(1000); }catch(_){}
  const {bubble,contentEl,spanEl}=activeStreamCtx;
  const raw = spanEl ? (spanEl.textContent||'') : '';
  spanEl?.remove();
  if(contentEl) renderMarkdownTo(contentEl, raw);
  const meta=document.createElement('div'); meta.className='meta'; meta.textContent='⏹ تولید متوقف شد'; bubble.appendChild(meta);
  isStreaming=false; currentWS=null; activeStreamCtx=null; setSendButton('send'); updateJump();
}

async function send(){
  const text=inp?.value?.trim();
  if(!text) return;
  inp.value=''; addBubble('user', text);

  const basePayload={ content:text, provider:providerSel?.value||undefined, model:modelSel?.value||undefined };
  if(conversationId) basePayload.conversation_id=parseInt(conversationId);

  let res = await POST('/api/v1/messages/stream', basePayload);

  if(!res.ok && conversationId && (res.status===404||res.status===403)){
    sessionStorage.removeItem('conv_id'); conversationId=null;
    res = await POST('/api/v1/messages/stream', { content:text, provider:basePayload.provider, model:basePayload.model });
  }
  if(!res.ok){
    let err=''; try{ err=(await res.json()).detail||''; }catch(_){}
    if(res.status===429) addSys(`درخواست‌ها زیاد است (429). کمی صبر کنید و دوباره تلاش کنید. ${err? 'جزئیات: '+err:''}`);
    else if(res.status===413) addSys(`طول پیام بیش از حد مجاز است (413). ${err}`);
    else if(res.status===400) addSys(`درخواست نامعتبر (400). ${err}`);
    else if(res.status===404||res.status===403) addSys(`گفتگو در دسترس نیست. لطفاً گفتگوی جدیدی را شروع کنید.`);
    else addSys(`خطا در ایجاد پیام (${res.status}). ${err}`);
    return;
  }

  const mk=await res.json();

  if(!conversationId){
    conversationId=String(mk.conversation_id);
    sessionStorage.setItem('conv_id', conversationId);
    await loadConversationsList(); await refreshTitle();
  }

  const wsScheme=(location.protocol==='https:')?'wss':'ws';
  const ws=new WebSocket(`${wsScheme}://${location.host}${mk.ws_path}`);
  currentWS=ws;
  const streamBubble=addBubble('assistant','',true);

  const contentEl=streamBubble.querySelector('.msg-content');
  let streamSpan=contentEl?contentEl.querySelector('.stream'):null;
  activeStreamCtx={bubble:streamBubble,contentEl,spanEl:streamSpan};
  isStreaming=true; setSendButton('stop');

  ws.onmessage=async (e)=>{
    const ev=JSON.parse(e.data);
    let span=activeStreamCtx?.spanEl;
    if(!span && contentEl){
      span=document.createElement('span'); span.className='stream'; contentEl.appendChild(span);
      activeStreamCtx.spanEl=span;
    }
    if(ev.type==='token'){
      if(span&&span.classList.contains('typing')){ span.classList.remove('typing'); span.textContent=''; }
      span.textContent += (ev.delta ?? '');
      if(atBottom()) scrollBottom(true); else updateJump();
    }
    if(ev.type==='error'){
      if(span&&span.classList.contains('typing')){ span.classList.remove('typing'); span.textContent=''; }
      if(span) span.textContent += `\n[خطا: ${ev.error}]`;
      updateJump();
    }
    if(ev.type==='done'){
      const raw=span?(span.textContent||''):'';
      span?.remove();
      if(contentEl) renderMarkdownTo(contentEl, raw);
      refreshTitle(); loadConversationsList(); updateJump();

      try{
        if(conversationId){
          const last=await getLastAssistant(conversationId);
          if(last){
            const meta=document.createElement('div'); meta.className='meta';
            const ms=(last.latency_ms??0), prov=last.provider||'-', model=last.model_name||'-', toks=(last.tokens_output??0);
            meta.textContent=`⏱ ${ms}ms · ☁️ ${prov}/${model} · ✂️ ${toks}`;
            streamBubble.appendChild(meta);
          }
        }
      }catch(_e){}

      isStreaming=false; currentWS=null; activeStreamCtx=null; setSendButton('send');
    }
  };

  ws.onclose=()=>{ if(isStreaming && activeStreamCtx) abortStream(); };
}

// --- Events ---
newBtn?.addEventListener('click', ()=>{
  sessionStorage.removeItem('conv_id'); conversationId=null;
  list.innerHTML=''; titleEl.textContent=''; document.title='Pyamooz AI — Chat';
  (convListEl?.querySelectorAll('.conv-item')||[]).forEach(n=>n.classList.remove('active'));
  inp?.focus(); updateComposerOffset(); updateJump();
});
refreshBtn?.addEventListener('click', ()=>{ loadConversationsList(); refreshTitle(); });

// One-button (Send ↔ Stop)
sendBtn?.addEventListener('click', ()=>{
  const mode=sendBtn.dataset.mode||'send';
  if(mode==='stop') abortStream(); else send();
});
inp?.addEventListener('keydown', e=>{
  // Enter = ارسال / در حالت استریم = توقف ; Shift+Enter = خط جدید
  if(e.key==='Enter' && !e.shiftKey){
    e.preventDefault();
    const mode=sendBtn?.dataset.mode||'send';
    if(mode==='stop') abortStream(); else send();
  }
});

// --- Initial load ---
window.addEventListener('load', async ()=>{
  await loadConversationsList();
  if(conversationId){ await loadHistory(conversationId); await refreshTitle(); }
  inp?.focus(); updateComposerOffset(); updateJump();
});
