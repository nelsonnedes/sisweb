// Landing Vendas — Diagrama animado (sem expor admin.html)
const TOOLTIPS = {
  "RTDB": "Fonte única Firebase RTDB — todos os módulos leem/escrevem aqui. Multi-tenant por company_id.",
  "clientes": "client.html — cadastro único serve vendas, romaneio e financeiro. [Inserir Link do Módulo Clientes]",
  "tora": "romaneiotora.html — cubagem Francon/Geométrico, custódia, X1-X4. [Inserir Link do Módulo Tora]",
  "estoque": "estoque.html — saldo real + baixa automática vinculada ao romaneio serrado.",
  "vendas": "vendas.html — pedido → financeiro sincronizado.",
  "financeiro": "financas.html — juros por dia civil America/Sao_Paulo. [Inserir Link do Módulo Financeiro]",
  "folha": "folha_pagamento/folha.html — lançamentos e banco de horas.",
  "fiscal": "notas-fiscais.html / mdf-e.html — emissão fiscal.",
  "compras": "compras.html — pedido de compra → estoque.",
  "Governança": "Painel SuperAdmin — gestão centralizada de assinaturas (não exposto publicamente)."
};
(function(){
  const diagram = document.getElementById('lv-diagram');
  const tooltip = document.getElementById('lv-diagram-tooltip');
  if(!diagram || !tooltip) return;
  let idx=0;
  const nodes=[...diagram.querySelectorAll('.lv-node')];
  function showTip(node){
    const key=node.getAttribute('data-module');
    const text=TOOLTIPS[key]||key;
    tooltip.textContent=text;
    tooltip.hidden=false;
    const r=node.getBoundingClientRect();
    const pr=diagram.getBoundingClientRect();
    tooltip.style.left=(r.left - pr.left + r.width/2 - tooltip.offsetWidth/2) + 'px';
    tooltip.style.top=(r.top - pr.top - tooltip.offsetHeight - 8) + 'px';
  }
  function hideTip(){ tooltip.hidden=true; }
  nodes.forEach(n=>{
    n.addEventListener('mouseenter',()=>showTip(n));
    n.addEventListener('mouseleave',hideTip);
    n.addEventListener('click',()=>showTip(n));
  });
  // autoplay
  setInterval(()=>{
    hideTip();
    const n=nodes[idx % nodes.length];
    showTip(n);
    idx++;
    setTimeout(hideTip, 2500);
  }, 4000);
})();
