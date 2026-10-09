const HELP_VERSION = '2026-10-06-manual-prints-reais-mockups';

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch;
    });
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function safeList(items, tag) {
    const listTag = tag === 'ol' ? 'ol' : 'ul';
    return `<${listTag} class="${listTag === 'ol' ? 'manual-flow' : ''}">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${listTag}>`;
}

function buildTopics() {
    const topics = [
        {
            id: 'inicio',
            category: 'Começando',
            icon: 'fa-compass',
            title: 'Visão geral e ordem recomendada',
            lead: 'Painel de entrada com indicadores rápidos, cotação USD/BRL em tempo real, atalhos para os módulos principais e visão geral das operações.',
            tags: ['fluxo inicial', 'multi-tenant', 'dashboard', 'cotação'],
            steps: [
                'Acesse o Sisweb com seu e-mail e senha autorizados e confira a empresa ativa no topo.',
                'Acompanhe na tela inicial a cotação oficial USD/BRL e notificações de pendências.',
                'Antes de emitir pedidos, complete os cadastros base em Empresa, Clientes, Fornecedores e Espécies.',
                'Utilize os módulos operacionais (Vendas, Compras, Estoque, Romaneios, Financeiro e Folha) conforme a rotina do dia.',
                'Em caso de dúvidas técnicas ou suporte, acione a Central de Suporte pelo rodapé ou menu de configurações.'
            ],
            features: [
                'Dashboard central com cotação cambial USD/BRL atualizada.',
                'Menu superior unificado com todos os módulos operacionais.',
                'Sininho de notificações com contagem de alertas não lidos.',
                'Instalação PWA no desktop e smartphones (Android/iOS).',
                'Central de Suporte acessível com um clique no rodapé Fale Conosco.'
            ],
            modals: ['Alertas e Notificações', 'Central de Suporte Sisweb', 'Sobre o Sistema', 'Confirmações de Operação'],
            warning: 'Este manual é operacional. Regras fiscais, trabalhistas e ambientais devem ser conferidas com o responsável técnico ou contábil da sua empresa.',
            mockups: [
                {
                    title: 'Visão Desktop — Dashboard Inicial',
                    caption: 'Painel central do Sisweb em tela grande com cards de indicadores, cotação de moedas e barra de navegação.',
                    image: 'assets/help-manual/mockups/desktop/inicio.png',
                    alt: 'Mockup Desktop do Dashboard Inicial Sisweb'
                },
                {
                    title: 'Visão Mobile / PWA — Dashboard Inicial',
                    caption: 'Interface otimizada para smartphones com menu compacto, cards empilhados e acesso rápido às operações.',
                    image: 'assets/help-manual/mockups/mobile/inicio.png',
                    alt: 'Mockup Mobile do Dashboard Inicial Sisweb'
                }
            ]
        },
        {
            id: 'navegacao',
            category: 'Começando',
            icon: 'fa-bars',
            title: 'Menu, PWA, alertas e sessão',
            lead: 'Aprenda a navegar pelas trilhas do Sisweb, alternar entre os temas Claro e Escuro, instalar o sistema como PWA e gerenciar a sessão.',
            tags: ['menu', 'PWA', 'mobile', 'tema dark/light', 'sessão'],
            steps: [
                'No desktop, utilize o menu horizontal suspenso categorizado por áreas funcionais.',
                'No smartphone, toque no botão hamburger para abrir a gaveta lateral completa com atalhos e perfil.',
                'Selecione o tema de visualização (Claro, Escuro ou Automático do Sistema) através das Configurações de Tema.',
                'Instale o Sisweb na tela inicial pelo navegador (PWA) para abrir como aplicativo nativo sem barras de endereço.',
                'Para encerrar o expediente com segurança, utilize o botão Sair na barra de usuário ou gaveta lateral.'
            ],
            features: [
                'Menu suspenso com submenus organizados por fluxo de trabalho.',
                'Gaveta lateral (sidebar) responsiva com navegação por toque.',
                'Alternância instantânea de temas visuais (Claro, Escuro e Sistema).',
                'Instalador PWA para operação rápida no pátio e em campo.',
                'Sessão autenticada e protegida com renovação automática de credenciais.'
            ],
            modals: ['Menu Lateral Mobile', 'Configurações de Tema', 'Central de Suporte', 'Confirmar Encerramento de Sessão'],
            mockups: [
                {
                    title: 'Visão Desktop — Menu e Navegação',
                    caption: 'Barra superior com grupos de módulos, sininho de notificações, seletor de tema e perfil do usuário.',
                    image: 'assets/help-manual/mockups/desktop/navegacao.png',
                    alt: 'Mockup Desktop do Menu e Navegação Sisweb'
                },
                {
                    title: 'Visão Mobile / PWA — Menu e Gaveta',
                    caption: 'Gaveta de navegação mobile com links organizados, dados do tenant e botão de logout visível.',
                    image: 'assets/help-manual/mockups/mobile/navegacao.png',
                    alt: 'Mockup Mobile do Menu e Navegação Sisweb'
                }
            ]
        },
        {
            id: 'empresa',
            category: 'Configuração',
            icon: 'fa-building',
            title: 'Empresa e tenant',
            lead: 'Centraliza os dados cadastrais da empresa, logotipo institucional para relatórios e PDFs, chave PIX para cobrança e geolocalização.',
            tags: ['companyId', 'CNPJ', 'logo', 'georeferenciamento', 'PIX'],
            steps: [
                'Acesse o menu Configurações > Empresa.',
                'Preencha Razão Social, Nome Fantasia, CNPJ e Inscrição Estadual.',
                'Faça upload do logotipo da empresa para cabeçalhos de pedidos e relatórios de romaneios.',
                'Configure a chave PIX e dados bancários que constarão nas lâminas de pagamento para clientes.',
                'Utilize o botão Localizar coordenadas para registrar a geolocalização exata do pátio ou sede.',
                'Clique em Salvar Empresa para sincronizar os dados em todo o ecossistema.'
            ],
            features: [
                'Cadastro completo de identificação jurídica e fiscal.',
                'Upload otimizado de logo institucional em nuvem.',
                'Chave PIX e dados bancários para cobrança integrada.',
                'Georeferenciamento de precisão para pátios madeireiros.',
                'Listagem de empresas cadastradas com busca e paginação.'
            ],
            modals: ['Selecionar Logo', 'Localizar Coordenadas', 'Empresas Cadastradas', 'Imprimir Relatório de Empresas'],
            mockups: [
                {
                    title: 'Visão Desktop — Gestão de Empresa',
                    caption: 'Formulário completo com dados da empresa, seção PIX/Bancária, geolocalização e lista de unidades.',
                    image: 'assets/help-manual/mockups/desktop/empresa.png',
                    alt: 'Mockup Desktop de Gestão de Empresa'
                },
                {
                    title: 'Visão Mobile / PWA — Gestão de Empresa',
                    caption: 'Layout vertical adaptado para conferência e edição rápida dos dados da empresa no celular.',
                    image: 'assets/help-manual/mockups/mobile/empresa.png',
                    alt: 'Mockup Mobile de Gestão de Empresa'
                }
            ]
        },
        {
            id: 'cadastros',
            category: 'Cadastros',
            icon: 'fa-database',
            title: 'Clientes, fornecedores e espécies',
            lead: 'Bases mestras do sistema que alimentam vendas, compras, romaneios de toras, estoque e movimentações financeiras.',
            tags: ['clientes', 'fornecedores', 'espécies', 'botânica'],
            steps: [
                'Acesse Clientes, Fornecedores ou Gerenciar Espécies pelos menus correspondentes.',
                'Clique em Novo Cliente ou Novo Fornecedor para abrir o formulário em janela modal.',
                'Preencha nome/razão social, CPF/CNPJ, telefone, e-mail e endereço.',
                'No Gerenciador de Espécies, cadastre nomes vulgares, científicos e coeficientes de cálculo.',
                'Utilize os filtros de pesquisa instantânea e paginação para localizar registros históricos.'
            ],
            features: [
                'Cadastro ágil de clientes com dados de contato e faturamento.',
                'Gestão de fornecedores com histórico de fornecimento.',
                'Gerenciador Unificado de Espécies com busca rápida.',
                'Validações fiscais contra duplicidade de documentos.',
                'Tabelas compactas com paginação e ordenação por coluna.'
            ],
            modals: ['Novo Cliente', 'Editar Cliente', 'Novo Fornecedor', 'Editar Fornecedor', 'Nova Espécie', 'Gerenciador Unificado de Espécies'],
            mockups: [
                {
                    title: 'Visão Desktop — Gerenciar Clientes',
                    caption: 'Tabela de clientes com busca instantânea, status ativo, paginação compacta e ações rápidas.',
                    image: 'assets/help-manual/mockups/desktop/cadastros.png',
                    alt: 'Mockup Desktop de Gerenciar Clientes'
                },
                {
                    title: 'Visão Mobile / PWA — Gerenciar Clientes',
                    caption: 'Visualização mobile em cards responsivos com botões de chamada e edição rápida.',
                    image: 'assets/help-manual/mockups/mobile/cadastros.png',
                    alt: 'Mockup Mobile de Gerenciar Clientes'
                }
            ]
        },
        {
            id: 'romaneios',
            category: 'Operação',
            icon: 'fa-file-alt',
            title: 'Romaneios e pré-romaneio',
            lead: 'Apontamento, medição e cubagem de toras de madeira nos formatos padrão de mercado: Pré-Romaneio, Tora Longa (TL), Pontas (PCT), Pés e Tora.',
            tags: ['TL', 'PCT', 'Pés', 'Tora', 'cubagem Francon', 'impressão'],
            steps: [
                'Escolha o tipo de romaneio adequado (Tora, TL, PCT ou Pés) ou inicie um Pré-Romaneio.',
                'Selecione o fornecedor ou cliente e a espécie florestal correspondente.',
                'Lance as toras informando comprimento e diâmetros (ou importe via planilha Excel padronizada).',
                'O sistema calcula instantaneamente o volume em metros cúbicos (m³) pelas regras Francon e geométrica.',
                'Salve o romaneio para gerar a numeração sequencial oficial e emitir o espelho de impressão formatado.'
            ],
            features: [
                'Emissão nos 4 formatos do mercado florestal (Tora, TL, PCT, Pés).',
                'Cubagem Francon e geométrica com precisão decimal em tempo real.',
                'Importação em lote de peças a partir de modelo Excel.',
                'Numeração sequencial e profissional para controle do pátio.',
                'Configuração de colunas de impressão e download em PDF.'
            ],
            modals: ['Lista de Romaneios', 'Importar Planilha Excel', 'Configurar Colunas de Impressão', 'Pré-Visualizar Espelho', 'Adicionar Peça'],
            mockups: [
                {
                    title: 'Visão Desktop — Romaneio de Tora',
                    caption: 'Tela de lançamento com grade de peças, cálculo simultâneo de cubagem e botões de importação Excel.',
                    image: 'assets/help-manual/mockups/desktop/romaneios.png',
                    alt: 'Mockup Desktop de Romaneio de Tora'
                },
                {
                    title: 'Visão Mobile / PWA — Romaneio de Tora',
                    caption: 'Lançamento de medidas otimizado para celulares, permitindo apontamento direto no pátio da serraria.',
                    image: 'assets/help-manual/mockups/mobile/romaneios.png',
                    alt: 'Mockup Mobile de Romaneio de Tora'
                }
            ]
        },
        {
            id: 'vendas',
            category: 'Operação',
            icon: 'fa-shopping-cart',
            title: 'Vendas e pedidos',
            lead: 'Gestão completa do ciclo de vendas: pedidos de madeira serrada, carrinho com conferência de cubagem, reserva, baixa atômica de estoque e faturamento.',
            tags: ['pedidos', 'clientes', 'estoque serrados', 'baixa automática', 'relatórios'],
            steps: [
                'Acesse Vendas > Sistema de Vendas e clique em Novo Pedido.',
                'Selecione o cliente cadastrado e a condição de pagamento.',
                'Adicione produtos do catálogo ou itens de madeira serrada especificando medidas e volume.',
                'O sistema valida saldos em estoque, ocultando produtos zerados e prevenindo vendas a descoberto.',
                'Ao aprovar o pedido, o estoque é deduzido em ponto único e os títulos a receber são criados no financeiro.',
                'Emita a ordem de carregamento e o espelho do pedido para entrega.'
            ],
            features: [
                'Carrinho com suporte a unidades mistas (m³, peças, metro linear, m²).',
                'Dedução de estoque em ponto único na aprovação com estorno seguro.',
                'Integração imediata com o módulo de Contas a Receber.',
                'Impressão limpa de pedidos para expedição e motorista.',
                'Relatórios consolidados de vendas por período, cliente ou produto.'
            ],
            modals: ['Novo Pedido de Venda', 'Listar Pedidos', 'Lista de Pedidos', 'Detalhes do Pedido', 'Estoque de Serrados', 'Configurar Colunas de Relatório'],
            mockups: [
                {
                    title: 'Visão Desktop — Sistema de Vendas',
                    caption: 'Formulário de novo pedido com abas de Clientes, Serrados e Relatórios, carrinho dinâmico e parcelas.',
                    image: 'assets/help-manual/mockups/desktop/vendas.png',
                    alt: 'Mockup Desktop do Sistema de Vendas'
                },
                {
                    title: 'Visão Mobile / PWA — Sistema de Vendas',
                    caption: 'Acompanhamento e aprovação de pedidos de venda na palma da mão com resumo financeiro.',
                    image: 'assets/help-manual/mockups/mobile/vendas.png',
                    alt: 'Mockup Mobile do Sistema de Vendas'
                }
            ]
        },
        {
            id: 'compras',
            category: 'Operação',
            icon: 'fa-shopping-bag',
            title: 'Compras e contas a pagar',
            lead: 'Aquisição de matéria-prima, toras e insumos com controle de fornecedores, carrinho de compras e sincronização com o contas a pagar.',
            tags: ['compras', 'fornecedores', 'insumos', 'contas a pagar', 'relatórios'],
            steps: [
                'Acesse Compras > Pedidos de Compra e clique em Novo Pedido.',
                'Selecione o fornecedor ou realize um cadastro rápido diretamente na tela.',
                'Lance os produtos, matérias-primas ou serviços adquiridos com custo unitário e quantidade.',
                'Defina as condições de pagamento e datas de vencimento das parcelas.',
                'Salve para gerar os lançamentos no Contas a Pagar e atualizar as previsões de desembolso.',
                'Utilize os relatórios para exportar extratos de compras em CSV e PDF.'
            ],
            features: [
                'Carrinho de compras com conferência de impostos e custo total.',
                'Geração automática de parcelas vinculadas ao Contas a Pagar.',
                'Cadastro rápido de fornecedor sem sair do fluxo de compras.',
                'Histórico completo de compras por fornecedor e período.',
                'Relatórios de compras com exportação facilitada para contabilidade.'
            ],
            modals: ['Novo Pedido de Compra', 'Listar Pedidos de Compra', 'Detalhes da Compra', 'Novo Fornecedor', 'Configurar Colunas'],
            mockups: [
                {
                    title: 'Visão Desktop — Sistema de Compras',
                    caption: 'Painel com grade de produtos, fornecedores vinculados, carrinho e condições de pagamento.',
                    image: 'assets/help-manual/mockups/desktop/compras.png',
                    alt: 'Mockup Desktop do Sistema de Compras'
                },
                {
                    title: 'Visão Mobile / PWA — Sistema de Compras',
                    caption: 'Consulta e registro de compras em dispositivos móveis durante negociações no campo.',
                    image: 'assets/help-manual/mockups/mobile/compras.png',
                    alt: 'Mockup Mobile do Sistema de Compras'
                }
            ]
        },
        {
            id: 'estoque',
            category: 'Gestão',
            icon: 'fa-warehouse',
            title: 'Estoque de toras e almoxarifado',
            lead: 'Gestão integral do pátio madeireiro e almoxarifado: entrada e saída de toras por plaqueta, quarentena, conferência de cubagem e movimentações.',
            tags: ['entrada toras', 'saída toras', 'plaqueta', 'almoxarifado', 'rastreabilidade'],
            steps: [
                'Registre a Entrada de Toras vinculada a romaneios ou manual com número de plaqueta física.',
                'Espécies fora de cadastro entram com aviso de quarentena para conferência botânica antes da liberação.',
                'Utilize Saída de Toras para registrar serragem, desdobro ou venda com destino formal.',
                'No Almoxarifado, controle ferramentas, lâminas, peças de manutenção e materiais de consumo.',
                'Consulte o histórico de movimentações com busca ágil por número de plaqueta ou lote.',
                'Emita relatórios de saldo físico com conferência de volume cúbico.'
            ],
            features: [
                'Controle de pátio por número de plaqueta física e espécie.',
                'Quarentena inteligente e badge revisar para espécies e fornecedores pendentes.',
                'Almoxarifado completo para peças, insumos e EPIs com saldo mínimo.',
                'Rastreabilidade ponta a ponta desde o romaneio até a saída da madeira.',
                'Busca unificada de tora com layout padronizado de botões e ações.'
            ],
            modals: ['Entrada de Toras', 'Saída de Toras', 'Consultar Toras', 'Baixa de Produto / Almoxarifado', 'Rastreabilidade'],
            mockups: [
                {
                    title: 'Visão Desktop — Controle de Estoque',
                    caption: 'Abas de Entrada, Saída, Almoxarifado e Movimentações com busca instantânea e saldo consolidado.',
                    image: 'assets/help-manual/mockups/desktop/estoque.png',
                    alt: 'Mockup Desktop do Controle de Estoque'
                },
                {
                    title: 'Visão Mobile / PWA — Controle de Estoque',
                    caption: 'Consulta de toras e baixa de produtos no celular para conferência presencial no pátio.',
                    image: 'assets/help-manual/mockups/mobile/estoque.png',
                    alt: 'Mockup Mobile do Controle de Estoque'
                }
            ]
        },
        {
            id: 'financas',
            category: 'Gestão',
            icon: 'fa-chart-line',
            title: 'Financeiro',
            lead: 'Gestão do fluxo de caixa e contas a pagar/receber, conciliação de vencimentos civis, cálculo de juros/multas e anexo em nuvem de comprovantes.',
            tags: ['contas a pagar', 'contas a receber', 'fluxo de caixa', 'anexos', 'juros'],
            steps: [
                'Acesse Financeiro e consulte o Dashboard para verificar o saldo projetado e títulos vencidos.',
                'Gerencie as obrigações nas abas Contas a Pagar e Contas a Receber com filtros por período e status.',
                'Anexe notas, boletos e comprovantes bancários diretamente em cada lançamento.',
                'Ao realizar uma quitação, registre o pagamento informando juros, descontos e conta bancária.',
                'Monitore o Fluxo de Caixa Projetado para 30 dias para planejamento de liquidez.'
            ],
            features: [
                'Dashboard financeiro executivo com gráficos de receitas e despesas.',
                'Fluxo de caixa projetado para previsão de pagamentos futuros.',
                'Armazenamento seguro de anexos e comprovantes em nuvem.',
                'Cálculo automático de juros e encargos por atraso.',
                'Exportação de extratos e relatórios com colunas customizáveis.'
            ],
            modals: ['Registrar Pagamento / Baixa', 'Gerenciar Anexos', 'Gerar Parcelas', 'Configurar Colunas Financeiras'],
            mockups: [
                {
                    title: 'Visão Desktop — Sistema Financeiro',
                    caption: 'Painel com saldo projetado, abas de Receber/Pagar/Fluxo e tabela analítica de títulos.',
                    image: 'assets/help-manual/mockups/desktop/financas.png',
                    alt: 'Mockup Desktop do Sistema Financeiro'
                },
                {
                    title: 'Visão Mobile / PWA — Sistema Financeiro',
                    caption: 'Visualização rápida de títulos a vencer e pagamentos do dia na versão para smartphones.',
                    image: 'assets/help-manual/mockups/mobile/financas.png',
                    alt: 'Mockup Mobile do Sistema Financeiro'
                }
            ]
        },
        {
            id: 'folha',
            category: 'Gestão',
            icon: 'fa-file-invoice-dollar',
            title: 'Folha de pagamento',
            lead: 'Gestão de equipe e pagamentos no padrão madeireiro: controle por quinzena e mês fechado, diárias, geração de QR Code PIX e recibos formais.',
            tags: ['funcionários', 'PIX BR Code', 'recibos', 'quinzena', 'banco de horas'],
            steps: [
                'Cadastre os funcionários com cargo, salário base, diária e chave PIX cadastrada.',
                'No período de competência, lance diárias trabalhadas, horas extras, vales e deduções.',
                'Utilize o botão de QR Code PIX para gerar a cobrança instantânea com o valor líquido exato.',
                'Efetue a baixa do pagamento (a linha é recolhida mantendo o foco nas pendências abertas).',
                'Emita e imprima o recibo de pagamento em formato profissional para colheita de assinatura.',
                'Consulte o histórico em Folhas Fechadas e o saldo em Banco de Horas (BH).'
            ],
            features: [
                'Flexibilidade de fechamento: 1ª Quinzena, 2ª Quinzena e Mês Completo.',
                'QR Code PIX com código BR Code dinâmico e cópia de chave integrada.',
                'Recibos com layout limpo e pronto para impressão ou assinatura.',
                'Ações recolhidas para pagamentos já quitados, facilitando a conferência.',
                'Lançamento e extrato consolidado de Banco de Horas (BH).'
            ],
            modals: ['Novo Funcionário', 'Novo Cargo', 'Lançar Folha', 'QR Code PIX', 'Recibo de Pagamento', 'Resumo da Folha', 'Lançar BH'],
            mockups: [
                {
                    title: 'Visão Desktop — Folha de Pagamento',
                    caption: 'Grade de lançamentos com total bruto, quinzenas, acréscimos e botões para geração de PIX e recibo.',
                    image: 'assets/help-manual/mockups/desktop/folha.png',
                    alt: 'Mockup Desktop da Folha de Pagamento'
                },
                {
                    title: 'Visão Mobile / PWA — Folha de Pagamento',
                    caption: 'Pagamento de funcionários via QR Code PIX diretamente pelo smartphone no pátio.',
                    image: 'assets/help-manual/mockups/mobile/folha.png',
                    alt: 'Mockup Mobile da Folha de Pagamento'
                }
            ]
        },
        {
            id: 'fiscal',
            category: 'Operação',
            icon: 'fa-receipt',
            title: 'Notas Fiscais e MDF-e',
            lead: 'Módulo fiscal especializado no setor florestal e madeireiro: emissão de NF-e, DANFE, MDF-e de transporte e gestão de Certificado Digital A1.',
            tags: ['NF-e', 'DANFE', 'MDF-e', 'certificado A1', 'SEFAZ'],
            steps: [
                'Configure o Certificado Digital A1 no ambiente seguro do sistema.',
                'No assistente de emissão em 4 etapas, preencha: 1. Operação, 2. Destinatário, 3. Itens e 4. Transporte.',
                'Revise CFOP, NCM de madeira, alíquotas tributárias e volumes transportados.',
                'Gere a prévia do DANFE para conferência dos dados fiscais.',
                'Transmita a NF-e para a SEFAZ e, após autorização, emita o Manifesto de Documentos Fiscais (MDF-e).'
            ],
            features: [
                'Assistente sequencial em 4 etapas guiadas (Operação, Destinatário, Itens, Transporte).',
                'Emissão integrada de NF-e e Manifesto Eletrônico de Documentos Fiscais (MDF-e).',
                'Visualização, download e impressão de DANFE em PDF com logomarca.',
                'Gestão segura de Certificado Digital A1 com chamadas autenticadas.',
                'Painel de consulta de status de lotes e cancelamentos homologados.'
            ],
            modals: ['Assistente de Emissão', 'Destinatário Fiscal', 'Transporte e Volumes', 'Configuração de Certificado Digital', 'Consulta SEFAZ'],
            warning: 'Este manual é operacional. A parametrização tributária e enquadramento fiscal devem ser validados com o contador da sua empresa.',
            mockups: [
                {
                    title: 'Visão Desktop — Sistema Fiscal',
                    caption: 'Painel de emissão com abas de consulta, etapas de preenchimento fiscal e prévia de documentos.',
                    image: 'assets/help-manual/mockups/desktop/fiscal.png',
                    alt: 'Mockup Desktop do Sistema Fiscal'
                },
                {
                    title: 'Visão Mobile / PWA — Sistema Fiscal',
                    caption: 'Consulta e envio rápido de DANFEs para motoristas e transportadores em trânsito.',
                    image: 'assets/help-manual/mockups/mobile/fiscal.png',
                    alt: 'Mockup Mobile do Sistema Fiscal'
                }
            ]
        },
        {
            id: 'assinatura',
            category: 'Conta',
            icon: 'fa-star',
            title: 'Assinatura e planos',
            lead: 'Acompanhamento do status da conta, plano contratado, vigência, prorrogações temporárias e regularização de faturamento.',
            tags: ['assinatura', 'planos', 'status', 'regularização', 'prorrogação'],
            steps: [
                'Acesse Assinatura pelo menu de usuário ou pelo alerta de vigência.',
                'Verifique o Plano Atual, data de contratação, data de vencimento e dias restantes de acesso.',
                'Caso necessite de prazo adicional para faturamento, utilize o botão Solicitar Prorrogação informando justificativa.',
                'Gere a lâmina de pagamento com chave PIX para renovação instantânea.',
                'Caso haja pendência de renovação, você poderá continuar trabalhando em Modo Leitura sem perda de dados históricos.'
            ],
            features: [
                'Painel informativo com contagem regressiva de dias restantes.',
                'Canal auditável para solicitação de prorrogação temporária.',
                'Geração de pagamento via PIX para liberação automatizada.',
                'Modo Leitura protegido para garantir acesso contínuo aos dados.',
                'Comunicação direta com o administrador do sistema.'
            ],
            modals: ['Renovar Assinatura', 'Solicitar prorrogação', 'Nova Mensagem para o Admin', 'Minhas Conversas'],
            mockups: [
                {
                    title: 'Visão Desktop — Status da Assinatura',
                    caption: 'Painel com plano ativo, dias restantes, canal de mensagens com a administração e renovação.',
                    image: 'assets/help-manual/mockups/desktop/assinatura.png',
                    alt: 'Mockup Desktop do Status da Assinatura'
                },
                {
                    title: 'Visão Mobile / PWA — Status da Assinatura',
                    caption: 'Visualização da vigência e atalhos de renovação na interface mobile do Sisweb.',
                    image: 'assets/help-manual/mockups/mobile/assinatura.png',
                    alt: 'Mockup Mobile do Status da Assinatura'
                }
            ]
        },
        {
            id: 'perfil',
            category: 'Conta',
            icon: 'fa-user-edit',
            title: 'Meu Perfil',
            lead: 'Configuração da conta pessoal do operador, dados cadastrais, alteração de senha e ativação de Autenticação em Duas Etapas (2FA).',
            tags: ['meu perfil', 'senha', '2FA', 'segurança', 'avatar'],
            steps: [
                'Acesse Configurações > Meu Perfil.',
                'Confira suas informações pessoais e clique em Editar para atualizar telefone ou cargo.',
                'Para reforçar sua segurança, clique em Ativar 2FA e escaneie o código com seu aplicativo autenticador (Google Authenticator).',
                'Altere sua senha de acesso periodicamente através do modal Atualizar Senha.',
                'Personalize seu avatar com a opção Alterar Foto para identificação rápida no sistema.'
            ],
            features: [
                'Edição segura de dados cadastrais do operador.',
                'Autenticação de Dois Fatores (2FA / TOTP) integrada no padrão RFC 6238.',
                'Atualização de credenciais de acesso em canal criptografado.',
                'Personalização de imagem de perfil sincronizada na barra superior.',
                'Auditoria de permissões vinculadas ao seu papel no sistema.'
            ],
            modals: ['Editar Informações Pessoais', 'Atualizar Senha', 'Configurar 2FA (Ativar / Desativar)', 'Alterar Foto'],
            mockups: [
                {
                    title: 'Visão Desktop — Meu Perfil',
                    caption: 'Dados do operador, badges de permissão, botões de alteração de senha e ativação de 2FA.',
                    image: 'assets/help-manual/mockups/desktop/perfil.png',
                    alt: 'Mockup Desktop do Meu Perfil'
                },
                {
                    title: 'Visão Mobile / PWA — Meu Perfil',
                    caption: 'Acesso rápido às preferências do usuário e segurança em telas de smartphones.',
                    image: 'assets/help-manual/mockups/mobile/perfil.png',
                    alt: 'Mockup Mobile do Meu Perfil'
                }
            ]
        },
        {
            id: 'suporte',
            category: 'Suporte',
            icon: 'fa-headset',
            title: 'Central de Suporte',
            lead: 'Canal de atendimento técnico oficial com tickets bidirecionais, contingência com rascunho offline e integração rápida com WhatsApp e E-mail.',
            tags: ['central de suporte', 'tickets', 'multi-tenant', 'rascunho offline', 'whatsapp'],
            steps: [
                'Abra a Central de Suporte pelo menu de navegação ou clicando em Fale Conosco no rodapé.',
                'Clique em Novo Ticket e digite uma descrição detalhada da sua solicitação ou dúvida.',
                'O sistema anexa automaticamente o diagnóstico técnico de tela e tenant sem expor dados confidenciais.',
                'Clique em Enviar Ticket para registrar na fila prioritária de atendimento.',
                'Se estiver sem conexão com a internet, o rascunho é preservado localmente e você pode acionar o fallback por WhatsApp ou E-mail.'
            ],
            features: [
                'Tickets com histórico completo de interações e respostas.',
                'Contexto automático de diagnóstico técnico e tenant.',
                'Rascunho offline resiliente com envio quando a rede for restaurada.',
                'Botão de direcionamento direto para o WhatsApp oficial com mensagem pré-montada.',
                'Opção Copiar Dados para colar informações de erro no chat de suporte.'
            ],
            modals: ['Novo Ticket', 'Meus Tickets', 'Enviar Ticket', 'Resposta do suporte', 'Copiar Dados de Diagnóstico'],
            mockups: [
                {
                    title: 'Visão Desktop — Central de Suporte',
                    caption: 'Modal de suporte integrado com campos de mensagem, envio de ticket, WhatsApp e fallback por e-mail.',
                    image: 'assets/help-manual/mockups/desktop/suporte.png',
                    alt: 'Mockup Desktop da Central de Suporte'
                },
                {
                    title: 'Visão Mobile / PWA — Central de Suporte',
                    caption: 'Abertura de chamados técnicos rápida no celular com acionamento direto do WhatsApp.',
                    image: 'assets/help-manual/mockups/mobile/suporte.png',
                    alt: 'Mockup Mobile da Central de Suporte'
                }
            ]
        }
    ];

    const generatedGallery = (typeof window !== 'undefined' && window.SISWEB_HELP_FULL_GALLERY) || {};
    return topics.map((topic) => ({
        ...topic,
        mockups: [
            ...(topic.mockups || []).map((shot, index) => ({
                ...shot,
                image: shot.image || `assets/help-manual/${topic.id}-${index + 1}.png`,
                alt: shot.alt || `Print sanitizado do módulo ${topic.title}: ${shot.title}`
            })),
            ...((generatedGallery[topic.id] || []).map((shot) => ({
                ...shot,
                title: shot.title || 'Print complementar',
                caption: shot.caption || 'Print do layout em operação no sistema.'
            })))
        ]
    }));
}

function searchIndex(topic) {
    return normalizeText([
        topic.title,
        topic.category,
        topic.lead,
        (topic.tags || []).join(' '),
        (topic.steps || []).join(' '),
        (topic.features || []).join(' '),
        (topic.modals || []).join(' '),
        (topic.mockups || []).map((shot) => `${shot.title || ''} ${shot.caption || ''}`).join(' ')
    ].join(' '));
}

function groupTopics(topics) {
    const groups = new Map();
    topics.forEach((topic) => {
        if (!groups.has(topic.category)) groups.set(topic.category, []);
        groups.get(topic.category).push(topic);
    });
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}

function renderTopicList(container, topics, activeId, onSelect) {
    container.innerHTML = '';
    groupTopics(topics).forEach((group) => {
        const title = document.createElement('div');
        title.className = 'manual-group-title';
        title.textContent = group.category;
        container.appendChild(title);
        group.items.forEach((topic) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `manual-topic${topic.id === activeId ? ' active' : ''}`;
            button.dataset.topic = topic.id;
            button.innerHTML = `
                <i class="fas ${escapeHtml(topic.icon || 'fa-book-open')}"></i>
                <span><strong>${escapeHtml(topic.title)}</strong><span>${escapeHtml((topic.tags || []).slice(0, 4).join(' • '))}</span></span>
            `;
            button.addEventListener('click', () => onSelect(topic.id, true));
            container.appendChild(button);
        });
    });
}

function renderChips(chips) {
    return (chips || []).map(([label, tone]) => `<span class="mock-chip ${escapeHtml(tone || '')}">${escapeHtml(label)}</span>`).join('');
}

function renderMockup(spec) {
    const tabs = (spec.tabs || []).map((tab, index) => `<span class="mock-tab${index === 0 ? ' active' : ''}">${escapeHtml(tab)}</span>`).join('');
    const chips = renderChips(spec.chips || []);
    const kpis = (spec.kpis || []).map(([label, value]) => `<div class="mock-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    const fields = (spec.fields || []).map((field) => `<div class="mock-field">${escapeHtml(field)}</div>`).join('');
    const cards = (spec.cards || []).map(([title, text]) => `<div class="mock-card"><div class="mock-title">${escapeHtml(title)}</div><div class="mock-field">${escapeHtml(text)}</div></div>`).join('');
    const table = spec.table ? `
        <div class="mock-table">
            <div class="mock-title">${escapeHtml(spec.table.title || 'Tabela')}</div>
            <table>
                <thead><tr>${(spec.table.headers || []).map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                <tbody>${(spec.table.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>
    ` : '';
    const modal = spec.modal ? `
        <div class="mock-modal-card">
            <div class="mock-modal-header"><span>${escapeHtml(spec.modal.title || 'Modal')}</span><span>×</span></div>
            <div class="mock-modal-body">${(spec.modal.rows || []).map((row) => `<div class="mock-field">${escapeHtml(row)}</div>`).join('')}</div>
        </div>
    ` : '';
    return `
        <div class="mock-screen" data-help-version="${HELP_VERSION}">
            <div class="mock-topbar"><span><i class="fas fa-cube"></i> Sisweb</span><span>${escapeHtml(spec.title || 'Tela')}</span></div>
            ${tabs ? `<div class="mock-tabs">${tabs}</div>` : ''}
            ${chips ? `<div class="mock-actions">${chips}</div>` : ''}
            ${kpis ? `<div class="mock-kpis">${kpis}</div>` : ''}
            <div class="mock-grid">
                ${fields ? `<div class="mock-form"><div class="mock-title">Campos principais</div>${fields}</div>` : ''}
                ${cards}
                ${table}
                ${modal}
            </div>
        </div>
    `;
}

function renderShotVisual(shot) {
    if (shot && shot.image) {
        return `<img class="manual-shot-image" src="${escapeHtml(shot.image)}?v=${HELP_VERSION}" alt="${escapeHtml(shot.alt || shot.title || 'Print do Sisweb')}" loading="lazy" decoding="async">`;
    }
    return renderMockup(shot || {});
}

function renderContent(container, topic, openShot) {
    if (!topic) {
        container.innerHTML = '<div class="manual-empty">Nenhum tópico encontrado. Tente buscar por “vendas”, “folha”, “suporte” ou “romaneio”.</div>';
        return;
    }
    const shots = (topic.mockups || []).map((shot, index) => `
        <figure class="manual-shot">
            <button type="button" class="manual-shot-button" data-shot="${index}" aria-label="Ampliar ${escapeHtml(shot.title)}">
                ${renderShotVisual(shot)}
            </button>
            <figcaption><strong>${escapeHtml(shot.title)}</strong><br>${escapeHtml(shot.caption || '')}</figcaption>
        </figure>
    `).join('');
    container.innerHTML = `
        <header class="manual-chapter-header">
            <div>
                <div class="manual-kicker">${escapeHtml(topic.category)}</div>
                <h2>${escapeHtml(topic.title)}</h2>
                <p class="lead">${escapeHtml(topic.lead || '')}</p>
            </div>
            <div class="manual-tags">${(topic.tags || []).map((tag) => `<span class="manual-tag">${escapeHtml(tag)}</span>`).join('')}</div>
        </header>
        ${topic.warning ? `<div class="manual-warning"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(topic.warning)}</div>` : ''}
        <div class="manual-section-grid">
            <section class="manual-box">
                <h3><i class="fas fa-route"></i> Fluxo recomendado</h3>
                ${safeList(topic.steps || [], 'ol')}
            </section>
            <section class="manual-box">
                <h3><i class="fas fa-list-check"></i> Funcionalidades</h3>
                ${safeList(topic.features || [], 'ul')}
            </section>
        </div>
        <section class="manual-box">
            <h3><i class="fas fa-window-restore"></i> Modais e janelas importantes</h3>
            ${safeList(topic.modals || [], 'ul')}
        </section>
        ${shots ? `<section class="manual-shots">${shots}</section>` : ''}
    `;
    container.querySelectorAll('[data-shot]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = parseInt(button.getAttribute('data-shot') || '0', 10) || 0;
            openShot((topic.mockups || [])[index]);
        });
    });
}

function initHelpPage() {
    const allTopics = buildTopics().map((topic) => ({ ...topic, _idx: searchIndex(topic) }));
    const listEl = document.getElementById('helpList');
    const contentEl = document.getElementById('helpContent');
    const searchEl = document.getElementById('helpSearchInput');
    const clearEl = document.getElementById('helpClearBtn');
    const lightbox = document.getElementById('helpLightbox');
    const lightboxCanvas = document.getElementById('helpLightboxCanvas');
    const lightboxCaption = document.getElementById('helpLightboxCaption');
    const lightboxClose = document.getElementById('helpLightboxClose');
    let activeId = '';

    const closeShot = () => {
        if (!lightbox) return;
        lightbox.classList.remove('active');
        if (lightboxCanvas) lightboxCanvas.innerHTML = '';
    };
    const openShot = (shot) => {
        if (!shot || !lightbox || !lightboxCanvas) return;
        if (lightboxCaption) lightboxCaption.textContent = shot.title || 'Visualização';
        lightboxCanvas.innerHTML = renderShotVisual(shot);
        lightbox.classList.add('active');
    };

    function filteredTopics() {
        const term = normalizeText(searchEl && searchEl.value ? searchEl.value : '');
        if (!term) return allTopics.slice();
        const tokens = term.split(/\\s+/).filter(Boolean);
        return allTopics.filter((topic) => tokens.every((token) => topic._idx.includes(token)));
    }

    function selectTopic(id, shouldPushHash) {
        const pool = filteredTopics();
        const next = allTopics.find((topic) => topic.id === id) || pool[0] || allTopics[0] || null;
        activeId = next ? next.id : '';
        renderTopicList(listEl, pool, activeId, selectTopic);
        renderContent(contentEl, next, openShot);
        if (shouldPushHash && activeId) {
            try { history.replaceState(null, '', `#${activeId}`); } catch (_) {}
        }
    }

    function applySearch() {
        const pool = filteredTopics();
        if (!pool.some((topic) => topic.id === activeId)) activeId = pool[0] ? pool[0].id : '';
        renderTopicList(listEl, pool, activeId, selectTopic);
        renderContent(contentEl, pool.find((topic) => topic.id === activeId) || pool[0] || null, openShot);
    }

    if (searchEl) searchEl.addEventListener('input', applySearch);
    if (clearEl) clearEl.addEventListener('click', () => {
        if (searchEl) searchEl.value = '';
        applySearch();
        if (searchEl) searchEl.focus();
    });
    if (lightbox) lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) closeShot();
    });
    if (lightboxClose) lightboxClose.addEventListener('click', closeShot);
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeShot();
    });
    window.addEventListener('hashchange', () => {
        const id = String(location.hash || '').replace(/^#/, '').trim();
        if (id) selectTopic(id, false);
    });

    const initial = String(location.hash || '').replace(/^#/, '').trim();
    selectTopic(allTopics.some((topic) => topic.id === initial) ? initial : 'inicio', false);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpPage);
} else {
    initHelpPage();
}
