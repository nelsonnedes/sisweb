// Landing Vendas — Diagrama animado (sem expor admin.html) + Carrosseis da vitrine e do hero.
// Hooks publicos: #lv-diagram, #lv-diagram-tooltip, .lv-node[data-module],
// #lv-hero-carousel, #lv-phone-carousel, #lv-desk-carousel (.lv-slide, .lv-dot, .lv-prev, .lv-next).
// Nao renomear sem atualizar landing-vendas.html e landing-vendas.css.
const TOOLTIPS = {
  "RTDB": "Banco unico Firebase: todos os modulos leem e escrevem aqui, com dados separados por empresa.",
  "clientes": "client.html — o cliente e cadastrado uma vez e serve a vendas, romaneio e financeiro.",
  "tora": "romaneiotora.html — romaneio de toras com cubagem Francon e geometrica.",
  "estoque": "estoque.html — saldo real do patio com baixa automatica vinculada ao romaneio serrado.",
  "vendas": "vendas.html — orcamento e pedido que ja alimentam o financeiro.",
  "financeiro": "financas.html — contas a pagar e receber, com juros por dia civil (America/Sao_Paulo).",
  "folha": "Folha de pagamento — lancamentos, filtros e banco de horas da serraria.",
  "fiscal": "notas-fiscais.html — NF-e e MDF-e para o carregamento sair documentado.",
  "compras": "compras.html — pedido de compra que entra direto no estoque e no contas a pagar."
};

// Texto comercial para compartilhamento no WhatsApp
const SHARE_COMMERCIAL_TEXT = `🪵 *Sisweb - Sistema de Gestão de Serraria*

🎯 *Sua madeireira do pátio à nota em um só sistema.*

Chega de romaneio no papel, cubagem na calculadora e estoque na cabeça do apontador. O Sisweb junta *romaneio de toras e serrados, cubagem Francon e geométrica, estoque de pátio, AUTEF/DOF, financeiro e NF-e/MDF-e* num login único — feito no Pará, para o ritmo de quem carrega caminhão todo dia.

✅ *14 Módulos Integrados:*
• Vendas — Orçamento → pedido → financeiro sincronizado
• Compras — Pedido → estoque → contas a pagar
• Estoque de pátio — Saldo real + cubagem Francon/geométrica
• Financeiro — Pagar, receber e juros por dia civil
• Romaneios — Tora / PCT / TL / PES / Pré (5 tipos)
• NF-e / MDF-e — Emissão e impressão do carregamento
• Folha + Banco de horas — Lançamentos, filtros, relatórios
• Cadastros — Clientes, espécies, fornecedores, empresa
• Governança — SuperAdmin, assinatura segura

🏆 *5 Pilares que resolvem a dor do pátio:*
⚡ Romaneio sem fila — Grade com Enter contínuo, imprime em 1 clique
⚖️ CONAMA 411 sem susto — Resumos técnicos prontos para auditoria
📃 Excel vira romaneio — Arraste a planilha, valida e cria em segundos
🛠️ Cubagem auditável — Francon + geométrica, X1–X4, custódia, volume
🔗 Rastro tora → prancha — Baixa automática, prova de origem em 1 clique

🔄 *Do pátio à nota em 4 passos:*
1. Aponta no pátio (estoque.html)
2. Romeia e cuba (romaneiotora.html)
3. Carrega documentado (NF-e/MDF-e + AUTEF/DOF)
4. Recebe e controla (financeiro + folha)

💚 *Feito no Pará • Suporte WhatsApp (91) 99131-1049 • 0 planilha paralela*

🔗 Acesse: https://sisweb-7ce82.web.app/landing-vendas.html

📲 *Teste grátis:* https://sisweb-7ce82.web.app/login.html?mode=register

---`;

(function(){
  const diagram = document.getElementById('lv-diagram');
  const tooltip = document.getElementById('lv-diagram-tooltip');
  if(!diagram || !tooltip) return;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idx=0;
  const nodes=[...diagram.querySelectorAll('.lv-node')];
  function clampX(x){
    const max = diagram.clientWidth - tooltip.offsetWidth - 4;
    if(max <= 4) return 4;
    return Math.max(4, Math.min(x, max));
  }
  function showTip(node){
    const key=node.getAttribute('data-module');
    const text=TOOLTIPS[key]||key;
    tooltip.textContent=text;
    tooltip.hidden=false;
    const r=node.getBoundingClientRect();
    const pr=diagram.getBoundingClientRect();
    tooltip.style.left=clampX(r.left - pr.left + r.width/2 - tooltip.offsetWidth/2) + 'px';
    tooltip.style.top=(r.top - pr.top - tooltip.offsetHeight - 8) + 'px';
  }
  function hideTip(){ tooltip.hidden=true; }
  nodes.forEach(n=>{
    n.addEventListener('mouseenter',()=>showTip(n));
    n.addEventListener('mouseleave',hideTip);
    n.addEventListener('click',()=>showTip(n));
    // Teclado: Tab alcanca a tora, Enter/Espaco abre, Escape fecha.
    n.setAttribute('tabindex','0');
    n.addEventListener('focus',()=>showTip(n));
    n.addEventListener('blur',hideTip);
    n.addEventListener('keydown',(e)=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); showTip(n); }
      if(e.key==='Escape'){ hideTip(); n.blur(); }
    });
  });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') hideTip(); });
  // Autoplay desligado para quem prefere movimento reduzido.
  if(reduceMotion) return;
  setInterval(()=>{
    if(document.activeElement && diagram.contains(document.activeElement)) return;
    hideTip();
    const n=nodes[idx % nodes.length];
    showTip(n);
    idx++;
    setTimeout(hideTip, 2500);
  }, 4000);
})();

// Vitrine "Veja o Sisweb por dentro" + hero "Painel real" — carrossel vanilla (sem dependencias).
// Autoplay com pausa em hover/focus, setas, dots clicaveis, teclado e swipe.
// O hero (#lv-hero-carousel) reaproveita tudo sem dots: setas + autoplay de 6s.
(function(){
  function initCarousel(id){
    const root = document.getElementById(id);
    if(!root) return;
    const slides = [...root.querySelectorAll('.lv-slide')];
    const dots = [...root.querySelectorAll('.lv-dot')];
    const prev = root.querySelector('.lv-prev');
    const next = root.querySelector('.lv-next');
    if(!slides.length) return;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = parseInt(root.getAttribute('data-autoplay'), 10) || 5500;
    let i = 0;
    let timer = null;
    function go(n){
      i = ((n % slides.length) + slides.length) % slides.length;
      slides.forEach((s, k)=>{
        const active = k === i;
        s.classList.toggle('is-active', active);
        if(active){ s.removeAttribute('aria-hidden'); }
        else{ s.setAttribute('aria-hidden', 'true'); }
      });
      dots.forEach((d, k)=>{
        const active = k === i;
        d.setAttribute('aria-selected', active ? 'true' : 'false');
        if(active){ d.removeAttribute('tabindex'); }
        else{ d.setAttribute('tabindex', '-1'); }
      });
    }
    function stop(){ if(timer){ clearInterval(timer); timer = null; } }
    function start(){
      if(reduceMotion || timer) return;
      timer = setInterval(()=>go(i + 1), delay);
    }
    if(prev) prev.addEventListener('click', ()=>{ go(i - 1); });
    if(next) next.addEventListener('click', ()=>{ go(i + 1); });
    dots.forEach((d, k)=>d.addEventListener('click', ()=>go(k)));
    // Teclado: setas navegam quando o carrossel (ou controle) tem foco.
    root.addEventListener('keydown', (e)=>{
      if(e.key === 'ArrowLeft'){ e.preventDefault(); go(i - 1); }
      else if(e.key === 'ArrowRight'){ e.preventDefault(); go(i + 1); }
    });
    // Pausa no hover e no foco dentro do carrossel.
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    // Swipe basico por touch.
    let touchX = null;
    root.addEventListener('touchstart', (e)=>{
      if(e.touches && e.touches.length === 1) touchX = e.touches[0].clientX;
    }, { passive: true });
    root.addEventListener('touchend', (e)=>{
      if(touchX === null) return;
      const dx = (e.changedTouches && e.changedTouches[0].clientX) - touchX;
      touchX = null;
      if(Math.abs(dx) < 40) return;
      go(dx < 0 ? i + 1 : i - 1);
    }, { passive: true });
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) stop(); else start();
    });
    go(0);
    start();
  }
  initCarousel('lv-hero-carousel');
  initCarousel('lv-hero-phone-carousel');
  initCarousel('lv-phone-carousel');
  initCarousel('lv-desk-carousel');
  loadActiveCoupons();
  initShareButton();
  initRoiCalculator();
})();

// Botão de compartilhar no WhatsApp
function initShareButton(){
  const btn = document.getElementById('lv-share-btn');
  const popover = document.getElementById('lv-share-popover');
  const waLink = document.getElementById('lv-share-wa');
  const copyBtn = document.getElementById('lv-share-copy');
  if(!btn || !popover || !waLink || !copyBtn) return;

  // Prepara link do WhatsApp com texto comercial codificado
  const waUrl = 'https://wa.me/5591991311049?text=' + encodeURIComponent(SHARE_COMMERCIAL_TEXT);
  waLink.href = waUrl;

  // Toggle popover
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const isOpen = !popover.hasAttribute('hidden');
    popover.hidden = isOpen;
    btn.setAttribute('aria-expanded', !isOpen);
  });

  // Fecha ao clicar fora
  document.addEventListener('click', (e)=>{
    if(!popover.hasAttribute('hidden') && !popover.contains(e.target) && e.target !== btn){
      popover.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Fecha com Escape
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !popover.hasAttribute('hidden')){
      popover.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

  // Copiar link da landing
  copyBtn.addEventListener('click', async ()=>{
    const url = 'https://sisweb-7ce82.web.app/landing-vendas.html';
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(url);
      } else {
        const t = document.createElement('textarea');
        t.value = url;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        t.remove();
      }
      copyBtn.innerHTML = '<i class="fas fa-check"></i> <span>Copiado!</span><small>Link da landing</small>';
      setTimeout(()=>{
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> <span>Copiar link</span><small>Link da landing</small>';
      }, 2000);
    }catch(_){}
  });
}

// Cupons ativos (vitrine pública, sem login). Falha silenciosa: esconde a seção.
async function loadActiveCoupons(){
  var section = document.getElementById('cupons');
  var host = document.getElementById('lv-coupon-list');
  if (!host || !section) return;
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function planNames(plans){
    var map = { monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Trimestral', premium: 'Anual' };
    var list = Array.isArray(plans) ? plans : [];
    var names = list.map(function(p){ return map[String(p || '').toLowerCase()] || String(p || ''); }).filter(Boolean);
    return names.length ? names.join(' • ') : 'Todos os planos';
  }
  function validity(expiresAt){
    if (!expiresAt) return 'Por tempo limitado';
    var d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return 'Por tempo limitado';
    return 'Válido até ' + d.toLocaleDateString('pt-BR');
  }
  function urgencyBadge(expiresAt){
    if (!expiresAt) return '';
    var d = new Date(expiresAt);
    var now = new Date();
    if (Number.isNaN(d.getTime())) return '';
    var diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (diff >= 0 && diff <= 30) return '<span class="lv-coupon-urgency"><i class="fas fa-clock"></i> Expira em ' + diff + 'd</span>';
    return '';
  }
  try {
    var ctrl = null, timer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function(){ try { ctrl.abort(); } catch (_) {} }, 8000);
    } catch (_) { ctrl = null; }
    var res = await fetch('https://us-central1-sisweb-7ce82.cloudfunctions.net/listActivePromoCodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
      signal: ctrl ? ctrl.signal : undefined
    });
    if (timer) clearTimeout(timer);
    if (!res || !res.ok) throw new Error('http ' + (res && res.status));
    var body = await res.json();
    var coupons = body && body.result && Array.isArray(body.result.coupons) ? body.result.coupons : [];
    if (!coupons.length) { section.style.display = 'none'; return; }
    host.innerHTML = coupons.map(function(c){
      var code = String(c.code || '');
      var link = 'https://sisweb-7ce82.web.app/subscription.html?cupom=' + encodeURIComponent(code);
      return '<article class="lv-coupon-card">'
        + '<div class="lv-coupon-off">' + esc(c.discountText || 'Desconto') + '</div>'
        + '<div><span class="lv-coupon-code">' + esc(code) + '</span>' + urgencyBadge(c.expiresAt) + '</div>'
        + '<p class="lv-coupon-meta">' + esc(validity(c.expiresAt)) + ' • ' + esc(planNames(c.allowedPlans)) + '</p>'
        + '<div class="lv-coupon-actions">'
        + '<button type="button" class="lv-btn lv-btn-secondary" data-coupon-copy="' + esc(code) + '"><i class="fas fa-copy"></i> Copiar</button>'
        + '<a class="lv-btn lv-btn-primary" href="' + esc(link) + '">Usar cupom</a>'
        + '</div></article>';
    }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('[data-coupon-copy]'), function(btn){
      btn.addEventListener('click', function(){
        var code = btn.getAttribute('data-coupon-copy') || '';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code);
          else {
            var t = document.createElement('textarea');
            t.value = code;
            document.body.appendChild(t);
            t.select();
            try { document.execCommand('copy'); } catch (_) {}
            t.remove();
          }
          btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
          setTimeout(function(){ btn.innerHTML = '<i class="fas fa-copy"></i> Copiar'; }, 2000);
        } catch (_) {}
      });
    });
  } catch (_) {
    section.style.display = 'none';
  }
}

// Simulador de Economia / ROI de Pátio
function initRoiCalculator(){
  var trucksInput = document.getElementById('lv-sim-trucks');
  var hoursInput = document.getElementById('lv-sim-hours');
  var costInput = document.getElementById('lv-sim-cost');

  var trucksVal = document.getElementById('lv-sim-trucks-val');
  var hoursVal = document.getElementById('lv-sim-hours-val');
  var costVal = document.getElementById('lv-sim-cost-val');

  var savedHoursEl = document.getElementById('lv-sim-saved-hours');
  var savedDaysEl = document.getElementById('lv-sim-saved-days');
  var savedMoneyEl = document.getElementById('lv-sim-saved-money');
  var waBtn = document.getElementById('lv-sim-btn-wa');

  if (!trucksInput || !hoursInput || !costInput || !savedHoursEl || !savedMoneyEl) return;

  function formatMoney(num){
    return 'R$ ' + Number(num || 0).toLocaleString('pt-BR');
  }

  function updateCalc(){
    var trucks = parseInt(trucksInput.value, 10) || 40;
    var hours = parseFloat(hoursInput.value) || 3;
    var cost = parseFloat(costInput.value) || 25;

    // Atualiza labels dos sliders
    if (trucksVal) trucksVal.textContent = trucks + (trucks === 1 ? ' carga' : ' cargas');
    if (hoursVal) hoursVal.textContent = hours.toFixed(1) + ' horas/dia';
    if (costVal) costVal.textContent = 'R$ ' + cost.toFixed(2).replace('.', ',') + '/h';

    // Estimativa: 22 dias úteis de operação por mês
    // O Sisweb elimina cerca de 78% do tempo gasto em digitação repetitiva de papel, cubagem manual e conferência
    var monthlyPaperHours = hours * 22;
    var savedHours = Math.round(monthlyPaperHours * 0.78);
    var savedDays = (savedHours / 8).toFixed(1);
    var savedMoney = Math.round(savedHours * cost);

    savedHoursEl.textContent = '~' + savedHours + 'h';
    if (savedDaysEl) savedDaysEl.textContent = savedDays;
    savedMoneyEl.textContent = formatMoney(savedMoney);

    // Atualiza o link do WhatsApp para iniciar a conversa contextualizada
    if (waBtn) {
      var msg = 'Olá! Fiz uma simulação no Sisweb: expedimos ~' + trucks + ' cargas/mês e gastamos ' + hours.toFixed(1) + 'h/dia em papel/romaneio. A estimativa indicou ~' + savedHours + 'h poupadas/mês (' + formatMoney(savedMoney) + '/mês). Gostaria de ver o sistema na prática!';
      waBtn.href = 'https://wa.me/5591991311049?text=' + encodeURIComponent(msg);
    }
  }

  trucksInput.addEventListener('input', updateCalc);
  hoursInput.addEventListener('input', updateCalc);
  costInput.addEventListener('input', updateCalc);

  trucksInput.addEventListener('change', updateCalc);
  hoursInput.addEventListener('change', updateCalc);
  costInput.addEventListener('change', updateCalc);

  updateCalc();
}

