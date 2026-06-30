const HELP_VERSION = '2026-06-06-manual-prints-sanitizados';

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
    const fict = 'Dados fictícios';
    const topics = [
        {
            id: 'inicio',
            category: 'Começando',
            icon: 'fa-compass',
            title: 'Visão geral e ordem recomendada',
            lead: 'Use este capítulo para entender o caminho mais seguro: configurar empresa, cadastrar bases, operar módulos e acompanhar indicadores.',
            tags: ['fluxo inicial', 'multi-tenant', fict],
            steps: [
                'Entre com usuário autorizado e confirme se a empresa/tenant aparece corretamente.',
                'Complete Empresa, Perfil, Clientes, Fornecedores e Espécies antes de operar.',
                'Use Vendas, Compras, Estoque, Romaneios, Financeiro e Folha conforme a rotina do dia.',
                'Consulte Ajuda e Suporte pelo menu de configurações quando precisar registrar um ticket.'
            ],
            features: [
                'Menu superior com módulos oficiais do sistema.',
                'Alertas pelo sininho para pendências importantes.',
                'PWA com atualização automática e instalação em mobile/desktop.',
                'Rodapé “Fale Conosco” abrindo a Central de Suporte.'
            ],
            modals: ['Ajuda rápida', 'Suporte Sisweb', 'Sobre', 'Confirmações do sistema'],
            warning: 'Este manual é operacional. Regras fiscais, trabalhistas e ambientais devem ser conferidas com profissional responsável quando houver impacto legal.',
            mockups: [
                {
                    title: 'Dashboard inicial',
                    caption: 'Painel de entrada com KPIs, alertas e atalhos. Os valores são exemplos neutros.',
                    tabs: ['Home', 'Vendas', 'Estoque', 'Financeiro', 'Cadastros', 'Romaneios'],
                    kpis: [['Romaneios', '12'], ['A receber', 'R$ 1.250,00'], ['A pagar', 'R$ 640,00']],
                    chips: [['Online', 'green'], ['Tenant: Empresa Exemplo', ''], ['Atualizado agora', '']],
                    table: {
                        title: 'Pendências de hoje',
                        headers: ['Tipo', 'Módulo', 'Ação'],
                        rows: [['Alerta', 'Financeiro', 'Revisar'], ['Rotina', 'Folha', 'Conferir'], ['Suporte', 'Sistema', 'Abrir']]
                    }
                }
            ]
        },
        {
            id: 'navegacao',
            category: 'Começando',
            icon: 'fa-bars',
            title: 'Menu, PWA, alertas e sessão',
            lead: 'Explica como navegar, instalar o Sisweb como aplicativo e manter a sessão de forma confiável.',
            tags: ['menu', 'PWA', 'mobile', 'logout'],
            steps: [
                'No desktop, use os grupos do menu superior e as opções de configurações.',
                'No mobile/PWA, abra a sidebar e use Ajuda, Suporte, Assinatura e Sair.',
                'Quando houver nova versão, o service worker atualiza os arquivos sem reinstalar o aplicativo.',
                'Se uma tela pedir login novamente, volte pelo fluxo normal para restaurar a sessão com segurança.'
            ],
            features: [
                'Sidebar mobile com logout visível.',
                'Sininho com área clicável completa.',
                'Atalho de instalação PWA.',
                'Cache de HTML/JS/CSS configurado para atualização frequente.'
            ],
            modals: ['Alertas', 'Configurações', 'Suporte', 'Sobre'],
            mockups: [
                {
                    title: 'Sidebar mobile',
                    caption: 'Menu compacto para PWA, com opções críticas acessíveis em telas pequenas.',
                    tabs: ['Home', 'Ajuda', 'Suporte', 'Assinatura', 'Sair'],
                    fields: ['Buscar módulo', 'Empresa Exemplo', 'Usuário Operador'],
                    cards: [['Instalar Sisweb', 'Disponível quando o navegador permitir.'], ['Atualizações', 'O app verifica nova versão automaticamente.']]
                }
            ]
        },
        {
            id: 'empresa',
            category: 'Configuração',
            icon: 'fa-building',
            title: 'Empresa e tenant',
            lead: 'Centraliza dados da empresa, identidade visual e validação do tenant usado nas operações.',
            tags: ['companyId', 'CNPJ', 'logo', fict],
            steps: [
                'Abra Configurações > Empresa.',
                'Confira razão social, CNPJ, endereço, telefone e logo institucional.',
                'Salve e valide se os demais módulos carregam dados do mesmo tenant.',
                'Quando precisar de correção administrativa, abra um ticket na Central de Suporte.'
            ],
            features: [
                'Cadastro com campos de identificação.',
                'Logo armazenada fora do Realtime Database quando aplicável.',
                'Bloqueio de duplicidade de CNPJ em companies diferentes.',
                'Correções sensíveis devem ser solicitadas ao suporte com justificativa.'
            ],
            modals: ['Upload/seleção de logo', 'Confirmação de salvamento', 'Central de Suporte para correções sensíveis'],
            mockups: [
                {
                    title: 'Cadastro da empresa',
                    caption: 'Exemplo fictício de empresa com campos de identificação.',
                    tabs: ['Dados', 'Endereço', 'Contato'],
                    fields: ['Razão Social: Empresa Exemplo LTDA', 'CNPJ: 00.000.000/0001-00', 'Cidade/UF: Exemplo/PA', 'Telefone: (00) 00000-0000'],
                    cards: [['Logo do sistema', 'Arquivo institucional sem base64 no banco.'], ['Tenant ativo', 'companyId resolvido pela sessão.']]
                },
                {
                    title: 'Empresas cadastradas',
                    caption: 'Modal/listagem de empresas em ambiente de treinamento, sem CNPJ real.'
                }
            ]
        },
        {
            id: 'cadastros',
            category: 'Cadastros',
            icon: 'fa-database',
            title: 'Clientes, fornecedores e espécies',
            lead: 'Cadastros base alimentam vendas, compras, romaneios, financeiro, estoque e relatórios.',
            tags: ['clientes', 'fornecedores', 'espécies'],
            steps: [
                'Cadastre clientes antes de vendas e romaneios.',
                'Cadastre fornecedores antes de compras e contas a pagar.',
                'Mantenha espécies e parâmetros de medição revisados.',
                'Use busca, filtros e edição com cuidado para preservar histórico.'
            ],
            features: [
                'Listas com pesquisa e ações.',
                'Modais de novo/editar cliente e fornecedor.',
                'Espécies com parâmetros para cálculo de madeira.',
                'Importação de espécies quando aplicável.'
            ],
            modals: ['Novo Cliente', 'Lista de Clientes', 'Novo Fornecedor', 'Lista de Fornecedores', 'Nova Espécie', 'Lista de Espécies'],
            mockups: [
                {
                    title: 'Lista de cadastros',
                    caption: 'Tabela fictícia com ações de edição sem expor clientes reais.',
                    tabs: ['Clientes', 'Fornecedores', 'Espécies'],
                    table: {
                        title: 'Registros cadastrados',
                        headers: ['Nome', 'Documento', 'Status', 'Ações'],
                        rows: [['Cliente Exemplo', '000.000.000-00', 'Ativo', 'Editar'], ['Fornecedor Modelo', '00.000.000/0001-00', 'Ativo', 'Editar'], ['Espécie Exemplo', 'Parâmetro', 'Ativo', 'Editar']]
                    },
                    modal: {
                        title: 'Novo Cliente',
                        rows: ['Nome/Razão Social', 'Documento', 'Telefone', 'Endereço', 'Salvar']
                    }
                }
            ]
        },
        {
            id: 'romaneios',
            category: 'Operação',
            icon: 'fa-file-alt',
            title: 'Romaneios e pré-romaneio',
            lead: 'Fluxo de medição e emissão de documentos operacionais: Pré-Romaneio, TL, PCT, Pés e Tora.',
            tags: ['TL', 'PCT', 'Pés', 'Tora', 'impressão'],
            steps: [
                'Crie o Pré-Romaneio com cliente, espécie e itens previstos.',
                'Escolha o tipo correto de romaneio: TL, PCT, Pés ou Tora.',
                'Adicione itens, confira medidas, totais e observações.',
                'Salve, liste, edite se necessário e imprima com colunas configuradas.'
            ],
            features: [
                'Seletores de cliente e espécie.',
                'Lista de romaneios salvos.',
                'Configuração de colunas de impressão.',
                'Integração com vendas/estoque quando aplicável.'
            ],
            modals: ['Lista de Romaneios', 'Lista de Clientes', 'Lista de Espécies', 'Configurar colunas impressas', 'Novo Cliente', 'Nova Espécie'],
            mockups: [
                {
                    title: 'Emissão de romaneio',
                    caption: 'Formulário fictício de emissão e tabela de itens.',
                    tabs: ['Pré-Romaneio', 'TL', 'PCT', 'Pés', 'Tora'],
                    fields: ['Cliente: Cliente Exemplo', 'Espécie: Espécie Modelo', 'Data: 06/06/2026'],
                    table: {
                        title: 'Itens do romaneio',
                        headers: ['Item', 'Medida', 'Volume', 'Ações'],
                        rows: [['001', '2,20 x 0,35', '0,269 m³', 'Editar'], ['002', '2,40 x 0,40', '0,377 m³', 'Editar']]
                    },
                    modal: { title: 'Lista de Romaneios', rows: ['Pesquisar', 'Selecionar', 'Imprimir', 'Configurar colunas'] }
                },
                {
                    title: 'Lista de romaneios',
                    caption: 'Janela de consulta com romaneios fictícios, filtros e ações de impressão.'
                }
            ]
        },
        {
            id: 'vendas',
            category: 'Operação',
            icon: 'fa-shopping-cart',
            title: 'Vendas e pedidos',
            lead: 'Registra pedidos de venda, produtos, itens de romaneio, contas a receber e relatórios.',
            tags: ['pedido', 'cliente', 'receber', 'relatório'],
            steps: [
                'Abra Vendas > Sistema de Vendas.',
                'Clique em Novo Pedido e selecione cliente.',
                'Escolha item manual, produto cadastrado ou romaneio.',
                'Informe condições de pagamento e salve o pedido.',
                'Use Lista de Pedidos e Relatórios para acompanhar, imprimir e filtrar.'
            ],
            features: [
                'Novo pedido com status.',
                'Itens manuais, produtos e romaneios.',
                'Contas a receber vinculadas.',
                'Relatórios com seleção de colunas e ações em lote.'
            ],
            modals: ['Lista de Pedidos', 'Novo Produto', 'Configurar colunas', 'Detalhes do Pedido', 'Novo Cliente'],
            mockups: [
                {
                    title: 'Pedido de venda',
                    caption: 'Pedido fictício com itens, totais e contas a receber.',
                    tabs: ['Pedidos', 'Clientes', 'Produtos', 'Relatórios'],
                    fields: ['Cliente: Cliente Exemplo', 'Status: Aberto', 'Forma: Pix', 'Vencimento: 10/06/2026'],
                    table: {
                        title: 'Itens do pedido',
                        headers: ['Produto', 'Qtd.', 'Valor', 'Total'],
                        rows: [['Produto Exemplo', '2', 'R$ 120,00', 'R$ 240,00'], ['Romaneio TL 001', '1', 'R$ 360,00', 'R$ 360,00']]
                    },
                    modal: { title: 'Lista de Pedidos', rows: ['Pesquisar pedidos', 'Filtrar período', 'Imprimir selecionados', 'Ações centralizadas'] }
                },
                {
                    title: 'Lista de pedidos',
                    caption: 'Modal real de pedidos com filtros, coluna Atualizado e ações centralizadas.'
                },
                {
                    title: 'Detalhes do pedido',
                    caption: 'Visualização de pedido, itens, totalização e botões de imprimir/editar.'
                }
            ]
        },
        {
            id: 'compras',
            category: 'Operação',
            icon: 'fa-shopping-bag',
            title: 'Compras e contas a pagar',
            lead: 'Controla pedidos de compra, fornecedores, produtos, carrinho de itens e contas a pagar.',
            tags: ['compra', 'fornecedor', 'pagar', 'produto'],
            steps: [
                'Abra Estoque > Sistema de Compras.',
                'Crie Novo Pedido de Compra e selecione fornecedor.',
                'Adicione itens manuais, produtos cadastrados ou itens vinculados a romaneio.',
                'Informe contas a pagar e salve.',
                'Use relatórios para exportar CSV/PDF e configurar colunas.'
            ],
            features: [
                'Pedido de compra com carrinho de itens.',
                'Cadastro rápido de fornecedor.',
                'Produtos e relatórios de compras.',
                'Lista de pedidos com impressão selecionada.'
            ],
            modals: ['Lista de Pedidos', 'Produto', 'Detalhes do Pedido', 'Novo Fornecedor', 'Configurar colunas de compras'],
            mockups: [
                {
                    title: 'Pedido de compra',
                    caption: 'Compra fictícia com fornecedor e contas a pagar.',
                    tabs: ['Pedidos', 'Fornecedores', 'Produtos', 'Relatórios'],
                    fields: ['Fornecedor: Fornecedor Modelo', 'Produto: Item Exemplo', 'Condição: 2 parcelas'],
                    table: {
                        title: 'Carrinho',
                        headers: ['Item', 'Qtd.', 'Custo', 'Total'],
                        rows: [['Produto Exemplo', '5', 'R$ 80,00', 'R$ 400,00'], ['Serviço Exemplo', '1', 'R$ 150,00', 'R$ 150,00']]
                    },
                    modal: { title: 'Detalhes do Pedido', rows: ['Itens', 'Pagamento', 'Imprimir', 'Editar'] }
                },
                {
                    title: 'Lista de pedidos de compra',
                    caption: 'Modal real de compras com filtros, fornecedor, status e ações do pedido.'
                }
            ]
        },
        {
            id: 'estoque',
            category: 'Gestão',
            icon: 'fa-warehouse',
            title: 'Estoque de toras e almoxarifado',
            lead: 'Acompanha entradas, saídas, consulta de toras, almoxarifado, movimentações, rastreabilidade e relatórios.',
            tags: ['entrada', 'saída', 'almoxarifado', 'rastreabilidade'],
            steps: [
                'Registre Entrada Toras ou Entrada Almoxarifado conforme o tipo de item.',
                'Faça Saída Toras ou baixa de produto com motivo/destino.',
                'Use Consultar Toras e Movimentações para rastrear histórico.',
                'Configure colunas e imprima relatórios quando necessário.'
            ],
            features: [
                'Abas de Entrada, Saída, Consulta, Almoxarifado, Movimentações e Relatórios.',
                'Coluna Ações fixa em tabelas extensas.',
                'Seleção de toras e rastreabilidade.',
                'Relatórios profissionais com colunas configuráveis.'
            ],
            modals: ['Seleção de Toras', 'Rastreabilidade', 'Configurar colunas', 'Confirmar estorno/baixa', 'Baixa de Produto'],
            mockups: [
                {
                    title: 'Controle de estoque',
                    caption: 'Visão fictícia de toras, almoxarifado e movimentações.',
                    tabs: ['Entrada Toras', 'Saída Toras', 'Consultar', 'Almoxarifado', 'Relatórios'],
                    kpis: [['Toras', '34'], ['Volume', '12,450 m³'], ['Produtos', '18']],
                    table: {
                        title: 'Movimentações',
                        headers: ['Data', 'Tipo', 'Item', 'Saldo', 'Ações'],
                        rows: [['06/06', 'Entrada', 'Tora 001', 'Disponível', 'Ver'], ['06/06', 'Saída', 'Produto A', '12 un.', 'Ver']]
                    },
                    modal: { title: 'Rastreabilidade', rows: ['Origem', 'Romaneio', 'Movimentações', 'Responsável'] }
                },
                {
                    title: 'Rastreabilidade',
                    caption: 'Modal de histórico do item, útil para conferir origem, saída e responsável.'
                }
            ]
        },
        {
            id: 'financas',
            category: 'Gestão',
            icon: 'fa-chart-line',
            title: 'Financeiro',
            lead: 'Controla contas a receber, contas a pagar, fluxo de caixa, relatórios, anexos e pagamentos.',
            tags: ['receber', 'pagar', 'fluxo', 'anexos'],
            steps: [
                'Use Dashboard para conferir vencidas e saldo projetado.',
                'Cadastre contas a receber ou pagar nas abas específicas.',
                'Anexe comprovantes quando necessário.',
                'Registre pagamento/baixa pelo modal correto.',
                'Gere relatórios e exportações por período.'
            ],
            features: [
                'Filtros por data, status, cliente/fornecedor e descrição.',
                'Gerar parcelas.',
                'Anexos por conta.',
                'Configuração de colunas para impressão.'
            ],
            modals: ['Registrar Pagamento', 'Anexos', 'Configurar colunas', 'Cadastro rápido de cliente/fornecedor'],
            mockups: [
                {
                    title: 'Contas e fluxo',
                    caption: 'Valores fictícios para demonstrar leitura do financeiro.',
                    tabs: ['Dashboard', 'Receber', 'Pagar', 'Fluxo', 'Relatórios'],
                    kpis: [['Receber', 'R$ 1.250,00'], ['Pagar', 'R$ 640,00'], ['Saldo', 'R$ 610,00']],
                    table: {
                        title: 'Títulos',
                        headers: ['Venc.', 'Pessoa', 'Valor', 'Status'],
                        rows: [['10/06', 'Cliente Exemplo', 'R$ 250,00', 'Aberto'], ['12/06', 'Fornecedor Modelo', 'R$ 140,00', 'Pendente']]
                    },
                    modal: { title: 'Registrar Pagamento', rows: ['Data de pagamento', 'Valor pago', 'Forma', 'Observação'] }
                },
                {
                    title: 'Registrar pagamento',
                    caption: 'Modal de baixa financeira com data, valor, forma de pagamento e observação.'
                }
            ]
        },
        {
            id: 'folha',
            category: 'Gestão',
            icon: 'fa-file-invoice-dollar',
            title: 'Folha de pagamento',
            lead: 'Gerencia funcionários, lançamentos, PIX/QR Code, recibos, banco de horas e relatórios.',
            tags: ['funcionário', 'PIX', 'recibo', 'mês fechado'],
            steps: [
                'Cadastre funcionários e dados bancários/PIX com nome do favorecido quando necessário.',
                'Escolha Mês/Ano e registre lançamentos de quinzena ou mês.',
                'Use QR Code PIX somente para saldo a pagar e confira favorecido, banco, chave e valor.',
                'Dê baixa em quinzena/mês e emita recibos e relatórios com valores históricos preservados.',
                'Use ações recolhidas para lançamentos pagos e cards no PWA.'
            ],
            features: [
                'Funcionários, cargos, lançamentos, filtros e relatórios.',
                'QR Code PIX com valor líquido e chave visível.',
                'Recibos de quinzena antes/depois da baixa.',
                'Resumo da folha, folhas fechadas e banco de horas.'
            ],
            modals: ['Editar Funcionário', 'QR Code PIX', 'Resumo da Folha', 'Folhas Fechadas', 'Recibo', 'Banco de Horas'],
            mockups: [
                {
                    title: 'Lançamentos de folha',
                    caption: 'Tela fictícia com abertos primeiro e pagos recolhidos.',
                    tabs: ['Funcionários', 'Lançamentos', 'Relatórios', 'Banco de Horas'],
                    kpis: [['Abertos', '8'], ['Pagos', '12'], ['Líquido', 'R$ 0,00']],
                    table: {
                        title: 'Lançamentos',
                        headers: ['Funcionário', 'Tipo', 'Valor pago', 'Saldo', 'Ações'],
                        rows: [['Funcionário Exemplo', 'Quinzena', 'R$ 600,00', 'R$ 720,00', 'Ver QR'], ['Colaborador Modelo', 'Mês Fechado Pago', 'R$ 1.850,00', 'R$ 0,00', 'Expandir']]
                    },
                    modal: { title: 'QR Code PIX', rows: ['QR Code', 'Favorecido', 'Banco', 'Valor líquido', 'Chave Pix'] }
                },
                {
                    title: 'Editar Funcionário - PIX',
                    caption: 'Cadastro PIX com nome do favorecido, chave, tipo da chave e banco para conferência.'
                },
                {
                    title: 'QR Code PIX',
                    caption: 'Modal de pagamento com QR fictício, favorecido, banco, chave Pix e valor líquido.'
                }
            ]
        },
        {
            id: 'fiscal',
            category: 'Operação',
            icon: 'fa-receipt',
            title: 'Notas Fiscais e MDF-e',
            lead: 'Fluxos fiscais para NF-e, DANFE, certificados e documentos de transporte.',
            tags: ['NF-e', 'DANFE', 'MDF-e', 'certificado'],
            steps: [
                'Configure preferências fiscais e certificado conforme o tipo permitido.',
                'Revise produtos, transporte, volumes e natureza da operação antes de emitir.',
                'Valide XML/DANFE em ambiente correto.',
                'Acompanhe consultas, cancelamentos e status de retorno.'
            ],
            features: [
                'Notas Fiscais com revisão guiada.',
                'DANFE com transporte e volumes.',
                'MDF-e para transporte.',
                'Certificado A1/nuvem conforme configuração.'
            ],
            modals: ['Revisão fiscal', 'Certificado', 'Produtos NF', 'Volumes/Transporte', 'Cancelamento'],
            warning: 'Este capítulo é operacional. A emissão fiscal deve respeitar regras vigentes e validação contábil/fiscal.',
            mockups: [
                {
                    title: 'Revisão fiscal',
                    caption: 'Exemplo sem dados fiscais reais.',
                    tabs: ['NF-e', 'Produtos', 'Transporte', 'DANFE', 'MDF-e'],
                    fields: ['Natureza: Venda Exemplo', 'Ambiente: Homologação', 'Produto: Item Fiscal Exemplo'],
                    table: {
                        title: 'Itens fiscais',
                        headers: ['Produto', 'NCM', 'Qtd.', 'Total'],
                        rows: [['Produto Exemplo', '0000.00.00', '1', 'R$ 100,00']]
                    },
                    modal: { title: 'Enviar para SEFAZ', rows: ['Validar XML', 'Assinar', 'Transmitir', 'Consultar retorno'] }
                }
            ]
        },
        {
            id: 'assinatura',
            category: 'Conta',
            icon: 'fa-star',
            title: 'Assinatura e planos',
            lead: 'Acompanha status, trial, pagamentos, prorrogação e renovação de acesso.',
            tags: ['plano', 'pagamento', 'trial', 'prorrogação'],
            steps: [
                'Abra Assinatura pelo menu.',
                'Confira status, plano e vencimento.',
                'Se necessário, envie comprovante ou solicite prorrogação.',
                'Aguarde análise do suporte financeiro Sisweb quando houver pagamento pendente.'
            ],
            features: [
                'Status da assinatura.',
                'Planos disponíveis.',
                'Pagamento PIX/cartão conforme configuração.',
                'Solicitação de prorrogação auditável.'
            ],
            modals: ['Pagamento', 'Comprovante', 'Solicitar prorrogação', 'Confirmação de plano'],
            mockups: [
                {
                    title: 'Status da assinatura',
                    caption: 'Exemplo fictício de plano e vencimento.',
                    tabs: ['Status', 'Planos', 'Pagamento'],
                    kpis: [['Plano', 'Mensal'], ['Status', 'Ativo'], ['Vence em', '12 dias']],
                    cards: [['Próxima renovação', '10/06/2026'], ['Suporte', 'Central de Suporte disponível']]
                },
                {
                    title: 'Pagamento da assinatura',
                    caption: 'Fluxo de pagamento/renovação ilustrado com dados neutros.'
                }
            ]
        },
        {
            id: 'perfil',
            category: 'Conta',
            icon: 'fa-user-edit',
            title: 'Meu Perfil',
            lead: 'Dados do usuário, contato, senha e preferências de sessão.',
            tags: ['usuário', 'senha', 'perfil'],
            steps: [
                'Abra Configurações > Meu Perfil.',
                'Atualize nome, contato e informações permitidas.',
                'Altere senha quando o fluxo estiver disponível.',
                'Salve e confira o toast de confirmação.'
            ],
            features: [
                'Formulário de dados pessoais.',
                'Preferências de conta.',
                'Integração com sessão Firebase.',
                'Mensagens de sucesso/erro.'
            ],
            modals: ['Alterar senha', 'Confirmação de salvamento'],
            mockups: [
                {
                    title: 'Perfil do usuário',
                    caption: 'Dados fictícios de perfil.',
                    fields: ['Nome: Usuário Exemplo', 'Email: usuario@exemplo.local', 'Telefone: (00) 00000-0000'],
                    cards: [['Segurança', 'Use senha forte e sessão individual.'], ['Empresa', 'Tenant herdado da autenticação.']]
                },
                {
                    title: 'Editar informações pessoais',
                    caption: 'Modal de edição do perfil, sem telefone ou e-mail real.'
                }
            ]
        },
        {
            id: 'suporte',
            category: 'Suporte',
            icon: 'fa-headset',
            title: 'Central de Suporte',
            lead: 'Registra tickets com contexto da tela, tenant, módulo, usuário e mensagem, mantendo WhatsApp/E-mail/Copiar como fallback.',
            tags: ['ticket', 'multi-tenant', 'rascunho offline'],
            steps: [
                'Abra Suporte pelo menu de configurações ou pelo rodapé “Fale Conosco”.',
                'Descreva a necessidade com o máximo de contexto operacional.',
                'Clique em Enviar ticket para gravar no backend.',
                'Se estiver offline, o rascunho fica salvo localmente no dispositivo para envio posterior.',
                'Use WhatsApp, E-mail ou Copiar dados como fallback.'
            ],
            features: [
                'Criação via Cloud Function autenticada.',
                'Tenant resolvido no servidor.',
                'Rate limit e sanitização de mensagem.',
                'Encaminhamento interno para equipe autorizada do Sisweb.'
            ],
            modals: ['Suporte Sisweb', 'Resposta do suporte', 'Rascunho offline', 'Fallback WhatsApp/E-mail'],
            mockups: [
                {
                    title: 'Modal de suporte',
                    caption: 'Fluxo fictício de abertura de ticket, sem envio de dados reais.',
                    fields: ['Módulo: Folha de Pagamento', 'Empresa/Tenant: Empresa Exemplo', 'Usuário: Operador Exemplo'],
                    modal: { title: 'Suporte Sisweb', rows: ['Mensagem', 'Enviar ticket', 'WhatsApp', 'E-mail', 'Copiar dados'] },
                    chips: [['Rascunho offline', 'amber'], ['Rate limit', ''], ['Auditável', 'green']]
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
            image: `assets/help-manual/${topic.id}-${index + 1}.png`,
            alt: `Print sanitizado do módulo ${topic.title}: ${shot.title}`
            })),
            ...((generatedGallery[topic.id] || []).map((shot) => ({
                ...shot,
                title: shot.title || 'Print complementar',
                caption: shot.caption || 'Print real do layout em ambiente de treinamento, com dados fictícios.'
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
        return `<img class="manual-shot-image" src="${escapeHtml(shot.image)}?v=${HELP_VERSION}" alt="${escapeHtml(shot.alt || shot.title || 'Print sanitizado do Sisweb')}" loading="lazy" decoding="async">`;
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
        const tokens = term.split(/\s+/).filter(Boolean);
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
