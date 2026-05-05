function encodePrompt(s) {
    try { return encodeURIComponent(String(s || '')); } catch (_) { return ''; }
}

function imgUrl(prompt, size) {
    const imageSize = size || 'landscape_16_9';
    return `https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodePrompt(prompt)}&image_size=${imageSize}`;
}

function realShot(name) {
    const safe = String(name || '').trim().replace(/[^a-z0-9_\-\/]/gi, '');
    return `help-assets/${safe}.png?v=20260326`;
}

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html || '');
    return (tmp.textContent || tmp.innerText || '').trim();
}

function normalizeText(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function buildTopics() {
    const uiStyle = 'clean modern web app UI, brazilian Portuguese labels, responsive admin dashboard, flat design, consistent spacing, soft shadows, high readability, screenshot-like';
    const systemName = 'Sisweb sistema de gestão';

    const guiaRapidoBody = `
        <h3>Guia Rápido de Uso do Sistema</h3>
        <p>Use este painel para entender o fluxo ideal por módulo e reduzir erros operacionais.</p>
        <ul>
            <li>Cadastre a empresa em Empresa e confirme os dados obrigatórios.</li>
            <li>Cadastre Clientes, Fornecedores e Espécies.</li>
            <li>Gere Pré-Romaneios e depois emita romaneios TL, PCT, PÉS ou TORA.</li>
            <li>Acompanhe Financeiro, Estoque e Folha no menu principal.</li>
        </ul>
        <h3>Configuração Inicial</h3>
        <ul>
            <li>Empresa e perfil de usuário</li>
            <li>Validação de contato e CNPJ</li>
            <li>Definição de tenant/companyId</li>
            <li>Print sugerido: tela company.html com cadastro preenchido e logo.</li>
        </ul>
        <h3>Cadastros Base</h3>
        <ul>
            <li>Clientes e fornecedores ativos</li>
            <li>Espécies e parâmetros de medição</li>
            <li>Edição e exclusão com confirmação</li>
            <li>Print sugerido: listagem de clientes/fornecedores com filtros.</li>
        </ul>
        <h3>Romaneios</h3>
        <ul>
            <li>Pré-romaneio por tipo</li>
            <li>Emissão TL/PCT/PÉS/TORA</li>
            <li>Impressão e conferência final</li>
            <li>Print sugerido: formulário de romaneio com itens e totais.</li>
        </ul>
        <h3>Financeiro e Gestão</h3>
        <ul>
            <li>Contas a pagar e a receber</li>
            <li>Dashboard com vencidas</li>
            <li>Status da assinatura e renovação</li>
            <li>Print sugerido: dashboard com KPIs e tabelas de títulos vencidos.</li>
        </ul>
        <h3>Estoque e Compras</h3>
        <ul>
            <li>Entrada por compras</li>
            <li>Movimentação e saldo</li>
            <li>Integração com financeiro</li>
            <li>Print sugerido: estoque com movimentações e saldo atual.</li>
        </ul>
        <h3>Perfil e Suporte</h3>
        <ul>
            <li>Atualização de dados pessoais</li>
            <li>Alteração de senha</li>
            <li>Diagnóstico técnico com logs</li>
            <li>Print sugerido: user-profile com edição concluída e toast de sucesso.</li>
        </ul>
        <p>© 2024 Sistema de Status da Assinatura. Todos os direitos rese</p>
    `;

    return [
        {
            id: 'inicio',
            title: 'Guia rápido (comece por aqui)',
            category: 'Começando',
            keywords: ['fluxo', 'configuração', 'inicial', 'guia rápido', 'empresa', 'tenant'],
            bodyHtml: guiaRapidoBody,
            images: [
                {
                    src: realShot('empresa/company'),
                    fallbackSrc: imgUrl(`${uiStyle}, ${systemName}, company registration page with CNPJ, contact fields, logo upload area, save button, breadcrumb 'Empresa', light theme`, 'landscape_16_9'),
                    alt: 'Ilustração de cadastro de empresa',
                    caption: 'Empresa: cadastro preenchido (substitua por print real da company.html).'
                },
                {
                    src: realShot('inicio/dashboard'),
                    fallbackSrc: imgUrl(`${uiStyle}, ${systemName}, dashboard with KPI cards, overdue invoices table, alerts bell icon highlighted, finance widgets, light theme`, 'landscape_16_9'),
                    alt: 'Ilustração de dashboard com KPIs',
                    caption: 'Dashboard: KPIs e títulos vencidos (substitua por print real do index.html).'
                }
            ]
        },
        {
            id: 'empresa',
            title: 'Empresa (cadastro e tenant)',
            category: 'Configuração',
            keywords: ['company', 'empresa', 'cnpj', 'tenant', 'logo', 'perfil'],
            bodyHtml: `
                <h3>Objetivo</h3>
                <p>Garantir que a empresa esteja cadastrada e que o sistema opere no tenant/companyId correto.</p>
                <h3>Passo a passo</h3>
                <ul>
                    <li>Abra <strong>Empresa</strong> no menu.</li>
                    <li>Preencha CNPJ, contato e dados obrigatórios.</li>
                    <li>Salve e confirme se o sistema passa a carregar dados da empresa.</li>
                </ul>
                <h3>Dica</h3>
                <p>Se a empresa não estiver cadastrada, o sininho pode exibir “Cadastro pendente”.</p>
            `,
            images: [
                {
                    src: realShot('empresa/company'),
                    fallbackSrc: imgUrl(`${uiStyle}, company profile page with company name, CNPJ input, phone input, address section, logo upload, primary save button, sidebar menu, light theme`, 'landscape_16_9'),
                    alt: 'Tela de cadastro de empresa',
                    caption: 'company.html: cadastro de empresa.'
                }
            ]
        },
        {
            id: 'clientes',
            title: 'Clientes (cadastro, filtros e edição)',
            category: 'Cadastros',
            keywords: ['clientes', 'cadastro', 'filtro', 'pesquisa', 'editar', 'excluir'],
            bodyHtml: `
                <h3>Fluxo recomendado</h3>
                <ul>
                    <li>Cadastre clientes ativos antes de emitir romaneios/vendas.</li>
                    <li>Use filtros e pesquisa para localizar rapidamente.</li>
                    <li>Ao excluir, confirme com atenção para evitar perda de histórico.</li>
                </ul>
                <h3>Atalhos</h3>
                <ul>
                    <li>Cadastros → Cliente</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('cadastros/clientes'),
                    fallbackSrc: imgUrl(`${uiStyle}, customers list page with search input, filters, table columns Name, Document, Phone, Actions edit delete, confirmation modal, light theme`, 'landscape_16_9'),
                    alt: 'Listagem de clientes com filtros',
                    caption: 'client.html: listagem com filtros e ações.'
                }
            ]
        },
        {
            id: 'fornecedores',
            title: 'Fornecedores (cadastro e pesquisa)',
            category: 'Cadastros',
            keywords: ['fornecedor', 'fornecedores', 'cadastro', 'filtro'],
            bodyHtml: `
                <h3>Quando usar</h3>
                <p>Cadastre fornecedores para compras, estoque e financeiro (contas a pagar).</p>
                <h3>Boas práticas</h3>
                <ul>
                    <li>Padronize razão social/nome fantasia.</li>
                    <li>Revise dados de contato e documento.</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('cadastros/fornecedores'),
                    fallbackSrc: imgUrl(`${uiStyle}, suppliers list page with search, filters, add supplier button, table with supplier name, CNPJ/CPF, phone, actions, light theme`, 'landscape_16_9'),
                    alt: 'Listagem de fornecedores',
                    caption: 'fornecedor.html: listagem e cadastro.'
                }
            ]
        },
        {
            id: 'especies',
            title: 'Espécies (parâmetros de medição)',
            category: 'Cadastros',
            keywords: ['espécies', 'species', 'parâmetros', 'medição', 'bitolas'],
            bodyHtml: `
                <h3>Objetivo</h3>
                <p>Manter espécies e parâmetros consistentes para cálculos de romaneio (TL/PCT/PÉS/TORA).</p>
                <h3>Fluxo</h3>
                <ul>
                    <li>Cadastros → Espécie</li>
                    <li>Revise unidades, conversões e parâmetros específicos.</li>
                    <li>Se necessário, use “Importar Espécies”.</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('cadastros/especies'),
                    fallbackSrc: imgUrl(`${uiStyle}, wood species settings page with species list, measurement parameters fields, import button, help link, light theme`, 'landscape_16_9'),
                    alt: 'Tela de espécies',
                    caption: 'species.html: espécies e parâmetros.'
                }
            ]
        },
        {
            id: 'romaneios',
            title: 'Romaneios (pré-romaneio e emissão)',
            category: 'Operação',
            keywords: ['romaneio', 'pré-romaneio', 'tl', 'pct', 'pés', 'tora', 'impressão'],
            bodyHtml: `
                <h3>Fluxo ideal</h3>
                <ul>
                    <li>Crie o <strong>Pré-Romaneio</strong> com cliente e espécie.</li>
                    <li>Emita o romaneio pelo tipo (TL/PCT/PÉS/TORA).</li>
                    <li>Confira totais e faça impressão/conferência final.</li>
                </ul>
                <h3>Dicas de conferência</h3>
                <ul>
                    <li>Revise itens, espessura/bitola e volumes.</li>
                    <li>Valide se os totais batem com a medição.</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('romaneios/preromaneio'),
                    fallbackSrc: imgUrl(`${uiStyle}, pre-romaneio page with client selector, species selector, items table, calculate button, generate button, light theme`, 'landscape_16_9'),
                    alt: 'Tela de pré-romaneio',
                    caption: 'preromaneio.html: preparação do romaneio.'
                },
                {
                    src: realShot('romaneios/preromaneio-lista'),
                    fallbackSrc: imgUrl(`${uiStyle}, modal dialog listing pre-romaneios with table, actions edit delete select, light theme`, 'landscape_16_9'),
                    alt: 'Lista de pré-romaneios',
                    caption: 'preromaneio.html: modal “Meus Romaneios”.'
                },
                {
                    src: realShot('romaneios/tl'),
                    fallbackSrc: imgUrl(`${uiStyle}, romaneio emission form with items and totals, print button, document number, measurements, light theme`, 'landscape_16_9'),
                    alt: 'Formulário de romaneio TL',
                    caption: 'romaneio (TL): formulário e totais.'
                },
                {
                    src: realShot('romaneios/pct'),
                    fallbackSrc: imgUrl(`${uiStyle}, romaneio emission form with items and totals, print button, document number, measurements, light theme`, 'landscape_16_9'),
                    alt: 'Formulário de romaneio PCT',
                    caption: 'romaneio (PCT): formulário e totais.'
                },
                {
                    src: realShot('romaneios/pes'),
                    fallbackSrc: imgUrl(`${uiStyle}, romaneio emission form with items and totals, print button, document number, measurements, light theme`, 'landscape_16_9'),
                    alt: 'Formulário de romaneio PÉS',
                    caption: 'romaneio (PÉS): formulário e totais.'
                },
                {
                    src: realShot('romaneios/tora'),
                    fallbackSrc: imgUrl(`${uiStyle}, romaneio emission form with items and totals, print button, document number, measurements, light theme`, 'landscape_16_9'),
                    alt: 'Formulário de romaneio TORA',
                    caption: 'romaneio (TORA): formulário e totais.'
                }
            ]
        },
        {
            id: 'financas',
            title: 'Finanças (a receber / a pagar / filtros)',
            category: 'Gestão',
            keywords: ['finanças', 'financeiro', 'a pagar', 'a receber', 'filtros', 'data início', 'data fim', 'vencidas'],
            bodyHtml: `
                <h3>O que você encontra aqui</h3>
                <ul>
                    <li>Contas a receber e a pagar</li>
                    <li>Filtros por status, cliente/fornecedor e período</li>
                    <li>Indicadores e acompanhamento de vencimentos</li>
                </ul>
                <h3>Boas práticas</h3>
                <ul>
                    <li>Use os filtros para trabalhar por período e status.</li>
                    <li>Para alertas de vencimento, prefira o sininho de alertas (evita spam de toasts).</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('financeiro/financas'),
                    fallbackSrc: imgUrl(`${uiStyle}, finance page with tabs dashboard, receber, pagar, date range filters labeled 'Data Início' and 'Data Fim', tables, light theme`, 'landscape_16_9'),
                    alt: 'Tela de finanças com filtros por data',
                    caption: 'financas.html: filtros e tabelas.'
                },
                {
                    src: realShot('financeiro/receber'),
                    fallbackSrc: imgUrl(`${uiStyle}, finance page with accounts receivable table, light theme`, 'landscape_16_9'),
                    alt: 'Tela de finanças - Contas a Receber',
                    caption: 'financas.html: Contas a Receber.'
                },
                {
                    src: realShot('financeiro/pagar'),
                    fallbackSrc: imgUrl(`${uiStyle}, finance page with accounts payable table, light theme`, 'landscape_16_9'),
                    alt: 'Tela de finanças - Contas a Pagar',
                    caption: 'financas.html: Contas a Pagar.'
                }
            ]
        },
        {
            id: 'estoque',
            title: 'Estoque (movimentação e saldo)',
            category: 'Gestão',
            keywords: ['estoque', 'compras', 'movimentação', 'saldo'],
            bodyHtml: `
                <h3>Fluxo comum</h3>
                <ul>
                    <li>Registre entradas (compras) e saídas.</li>
                    <li>Acompanhe saldo e movimentações recentes.</li>
                    <li>Use filtros para localizar itens rapidamente.</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('estoque/estoque'),
                    fallbackSrc: imgUrl(`${uiStyle}, inventory page with stock table, movement history, filters by item and date, low stock highlights, light theme`, 'landscape_16_9'),
                    alt: 'Tela de estoque com movimentações',
                    caption: 'estoque.html: saldo e movimentações.'
                }
            ]
        },
        {
            id: 'folha',
            title: 'Folha de Pagamento (rotinas e relatórios)',
            category: 'Gestão',
            keywords: ['folha', 'pagamento', 'funcionários', 'relatórios', 'provisão'],
            bodyHtml: `
                <h3>O que fazer primeiro</h3>
                <ul>
                    <li>Cadastre/valide funcionários e salários.</li>
                    <li>Revise admissões e dados importantes.</li>
                    <li>Use relatórios para conferência e provisões.</li>
                </ul>
                <h3>Dica</h3>
                <p>O sininho pode trazer alertas sobre vencimentos/rotinas dependendo da configuração.</p>
            `,
            images: [
                {
                    src: realShot('folha/folha'),
                    fallbackSrc: imgUrl(`${uiStyle}, payroll page with employees list, salary fields, vacation provision report card, export buttons, light theme`, 'landscape_16_9'),
                    alt: 'Tela de folha de pagamento',
                    caption: 'folha_pagamento/folha.html: funcionários e relatórios.'
                }
            ]
        },
        {
            id: 'vendas',
            title: 'Vendas (cadastro e acompanhamento)',
            category: 'Operação',
            keywords: ['vendas', 'pedido', 'cliente', 'itens', 'status'],
            bodyHtml: `
                <h3>Objetivo</h3>
                <p>Registrar vendas/pedidos, acompanhar status e manter histórico.</p>
                <h3>Recomendação</h3>
                <ul>
                    <li>Vincule a um cliente válido.</li>
                    <li>Revise itens e totais antes de finalizar.</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('vendas/vendas'),
                    fallbackSrc: imgUrl(`${uiStyle}, sales page with order list, filters, search, create new sale button, order details modal with items and totals, light theme`, 'landscape_16_9'),
                    alt: 'Tela de vendas',
                    caption: 'vendas.html: pedidos e acompanhamento.'
                },
                {
                    src: realShot('vendas/novo-pedido'),
                    fallbackSrc: imgUrl(`${uiStyle}, sales page with new order form open, customer search, items section, totals, light theme`, 'landscape_16_9'),
                    alt: 'Novo pedido de venda',
                    caption: 'vendas.html: formulário “Novo Pedido”.'
                },
                {
                    src: realShot('vendas/lista-pedidos'),
                    fallbackSrc: imgUrl(`${uiStyle}, modal listing sales orders with table, filters, actions view edit, light theme`, 'landscape_16_9'),
                    alt: 'Listagem de pedidos',
                    caption: 'vendas.html: modal “Lista de Pedidos”.'
                }
            ]
        },
        {
            id: 'assinatura',
            title: 'Assinatura (status e renovação)',
            category: 'Conta',
            keywords: ['assinatura', 'status', 'renovação', 'pagamento', 'plano'],
            bodyHtml: `
                <h3>Para que serve</h3>
                <p>Verificar status do plano, renovação e possíveis bloqueios.</p>
                <h3>Quando revisar</h3>
                <ul>
                    <li>Ao ver alertas de expiração ou pendência.</li>
                    <li>Ao trocar de plano.</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('assinatura/subscription-status'),
                    fallbackSrc: imgUrl(`${uiStyle}, subscription status page with plan card, status badge, renewal button, payment pending panel, light theme`, 'landscape_16_9'),
                    alt: 'Tela de status da assinatura',
                    caption: 'subscription-status.html: status e ações.'
                },
                {
                    src: realShot('assinatura/subscription'),
                    fallbackSrc: imgUrl(`${uiStyle}, subscription plan selection page, pricing cards, light theme`, 'landscape_16_9'),
                    alt: 'Tela de seleção de plano',
                    caption: 'subscription.html: seleção de plano.'
                }
            ]
        },
        {
            id: 'perfil',
            title: 'Meu Perfil (dados e segurança)',
            category: 'Conta',
            keywords: ['perfil', 'usuário', 'senha', 'dados pessoais'],
            bodyHtml: `
                <h3>O que atualizar</h3>
                <ul>
                    <li>Nome e contato</li>
                    <li>Senha (quando aplicável)</li>
                    <li>Preferências do sistema</li>
                </ul>
                <h3>Confirmação</h3>
                <p>Após salvar, você deve ver confirmação (toast de sucesso) e os dados refletirem no menu.</p>
            `,
            images: [
                {
                    src: realShot('perfil/user-profile'),
                    fallbackSrc: imgUrl(`${uiStyle}, user profile page with form fields name email phone, change password section, save button, success toast, light theme`, 'landscape_16_9'),
                    alt: 'Tela de perfil do usuário',
                    caption: 'user-profile.html: edição concluída.'
                }
            ]
        },
        {
            id: 'fiscal',
            title: 'Fiscal (Notas e MDF-e)',
            category: 'Operação',
            keywords: ['fiscal', 'nota', 'nfe', 'mdf-e', 'emissão', 'impostos'],
            bodyHtml: `
                <h3>Emissão Fiscal</h3>
                <ul>
                    <li>Gere Notas Fiscais (NF-e) a partir de vendas ou romaneios.</li>
                    <li>Emita MDF-e para transporte de cargas.</li>
                    <li>Acompanhe o status da emissão na Sefaz.</li>
                </ul>
            `,
            images: [
                {
                    src: realShot('fiscal/notas-fiscais'),
                    fallbackSrc: imgUrl(`${uiStyle}, fiscal notes page, invoice list, light theme`, 'landscape_16_9'),
                    alt: 'Tela de Notas Fiscais',
                    caption: 'notas-fiscais.html: gestão de NF-e.'
                },
                {
                    src: realShot('fiscal/mdf-e'),
                    fallbackSrc: imgUrl(`${uiStyle}, mdf-e emission page, transport document list, light theme`, 'landscape_16_9'),
                    alt: 'Tela de MDF-e',
                    caption: 'mdf-e.html: gestão de transporte.'
                }
            ]
        }
    ];
}

function groupByCategory(items) {
    const map = new Map();
    (items || []).forEach((t) => {
        const cat = String(t.category || 'Outros');
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(t);
    });
    return Array.from(map.entries()).map(([category, topics]) => ({
        category,
        topics: topics.slice().sort((a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'))
    }));
}

function buildSearchIndex(topic) {
    const base = [topic.title, topic.category, ...(topic.keywords || []), stripHtml(topic.bodyHtml)].join(' ');
    return normalizeText(base);
}

function renderList(container, grouped, activeId, onSelect) {
    container.innerHTML = '';
    grouped.forEach((g) => {
        const cat = document.createElement('div');
        cat.className = 'cat';
        cat.textContent = g.category;
        container.appendChild(cat);
        g.topics.forEach((t) => {
            const row = document.createElement('div');
            row.className = `help-item${t.id === activeId ? ' active' : ''}`;
            row.setAttribute('role', 'button');
            row.tabIndex = 0;
            row.addEventListener('click', () => onSelect(t.id));
            row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(t.id);
                }
            });
            const dot = document.createElement('div');
            dot.className = 'dot';
            const txt = document.createElement('div');
            txt.className = 'txt';
            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = t.title;
            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.textContent = (t.keywords && t.keywords.length) ? t.keywords.slice(0, 4).join(' • ') : '';
            txt.appendChild(title);
            txt.appendChild(meta);
            row.appendChild(dot);
            row.appendChild(txt);
            container.appendChild(row);
        });
    });
}

function renderContent(container, topic, onOpenImage) {
    if (!topic) {
        container.innerHTML = '<div class="help-empty">Selecione um tópico à esquerda ou use a busca.</div>';
        return;
    }
    const header = `
        <div>
            <h2>${String(topic.title || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</h2>
            <div class="badge"><i class="fa-regular fa-folder-open"></i><span>${String(topic.category || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span></div>
        </div>
    `;

    const images = (topic.images || []).map((img, idx) => {
        const cap = String(img.caption || '');
        const alt = String(img.alt || '');
        const src = String(img.src || '');
        const fallback = String(img.fallbackSrc || '');
        const safeCap = cap.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const safeAlt = alt.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const safeSrc = src.replace(/"/g, '&quot;');
        const safeFallback = fallback.replace(/"/g, '&quot;');
        return `
            <figure class="help-shot">
                <button type="button" data-img-index="${idx}">
                    <img src="${safeSrc}" alt="${safeAlt}" ${safeFallback ? `data-fallback="${safeFallback}"` : ''}>
                </button>
                <figcaption>${safeCap}</figcaption>
            </figure>
        `;
    }).join('');

    container.innerHTML = `
        ${header}
        <div class="body">${topic.bodyHtml || ''}</div>
        ${images ? `<div class="help-grid">${images}</div>` : ''}
    `;

    const buttons = Array.from(container.querySelectorAll('button[data-img-index]'));
    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-img-index') || '0', 10);
            const img = (topic.images || [])[idx];
            if (!img) return;
            const el = btn.querySelector('img');
            const resolvedSrc = el ? (el.currentSrc || el.src) : String(img.src || img.fallbackSrc || '');
            onOpenImage({ ...img, src: resolvedSrc });
        });
    });

    const imgs = Array.from(container.querySelectorAll('img[data-fallback]'));
    imgs.forEach((imgEl) => {
        imgEl.addEventListener('error', () => {
            try {
                const fallback = imgEl.getAttribute('data-fallback') || '';
                if (!fallback) return;
                if (imgEl.getAttribute('data-fallback-used') === '1') return;
                imgEl.setAttribute('data-fallback-used', '1');
                imgEl.src = fallback;
            } catch (_) {}
        }, { once: false });
    });
}

function initHelpPage() {
    const topicsRaw = buildTopics();
    const topics = topicsRaw.map((t) => ({
        ...t,
        _idx: buildSearchIndex(t)
    }));

    const listEl = document.getElementById('helpList');
    const contentEl = document.getElementById('helpContent');
    const inputEl = document.getElementById('helpSearchInput');
    const clearBtn = document.getElementById('helpClearBtn');
    const lb = document.getElementById('helpLightbox');
    const lbImg = document.getElementById('helpLightboxImg');
    const lbCap = document.getElementById('helpLightboxCaption');
    const lbClose = document.getElementById('helpLightboxClose');

    const openImage = (img) => {
        if (!lb || !lbImg || !lbCap) return;
        lbImg.src = String(img.src || '');
        lbImg.alt = String(img.alt || '');
        lbCap.textContent = String(img.caption || '');
        lb.classList.add('active');
    };
    const closeImage = () => {
        if (!lb) return;
        lb.classList.remove('active');
        if (lbImg) {
            lbImg.src = '';
            lbImg.alt = '';
        }
        if (lbCap) lbCap.textContent = '';
    };
    if (lb) {
        lb.addEventListener('click', (e) => {
            if (e.target === lb) closeImage();
        });
    }
    if (lbClose) lbClose.addEventListener('click', closeImage);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeImage();
    });

    let activeId = '';
    const select = (id) => {
        activeId = String(id || '');
        const term = normalizeText(inputEl && inputEl.value ? inputEl.value : '');
        const pool = term
            ? topics.filter((t) => t._idx.includes(term))
            : topics.slice();
        const grouped = groupByCategory(pool);
        renderList(listEl, grouped, activeId, select);
        const topic = topics.find((t) => t.id === activeId) || pool[0] || null;
        renderContent(contentEl, topic, openImage);
    };

    const applySearch = () => {
        const term = normalizeText(inputEl && inputEl.value ? inputEl.value : '');
        const pool = term
            ? topics.filter((t) => t._idx.includes(term))
            : topics.slice();
        const grouped = groupByCategory(pool);
        if (pool.length && !pool.some((t) => t.id === activeId)) activeId = pool[0].id;
        renderList(listEl, grouped, activeId, select);
        const topic = topics.find((t) => t.id === activeId) || pool[0] || null;
        renderContent(contentEl, topic, openImage);
        if (!pool.length) {
            contentEl.innerHTML = '<div class="help-empty">Nenhum resultado para a busca. Tente outro termo (ex.: “romaneio”, “financeiro”, “estoque”, “folha”).</div>';
        }
    };

    if (inputEl) {
        inputEl.addEventListener('input', () => applySearch());
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!inputEl) return;
            inputEl.value = '';
            applySearch();
            inputEl.focus();
        });
    }

    const fromHash = (() => {
        try {
            const h = (location.hash || '').replace(/^#/, '').trim();
            return h;
        } catch (_) {
            return '';
        }
    })();
    const initial = fromHash && topics.some((t) => t.id === fromHash) ? fromHash : 'inicio';
    select(initial);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpPage);
} else {
    initHelpPage();
}
