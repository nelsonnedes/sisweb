// Landing Vendas — Diagrama animado (sem expor admin.html)
// Hooks publicos: #lv-diagram, #lv-diagram-tooltip, .lv-node[data-module].
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
