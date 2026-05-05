# 📊 Dashboard Modular - Sistema SISWEB

## 🎯 Visão Geral

Dashboard responsivo e modular para o Sistema SISWEB, seguindo os padrões arquiteturais do RomaneioTL com integração completa ao Firebase e recursos em tempo real.

## 🏗️ Arquitetura

### Estrutura de Arquivos
```
modules/dashboard/
├── dashboard-core.js       # Gerenciamento de estado e Firebase
├── dashboard-widgets.js    # Componentes visuais e gráficos  
├── dashboard-styles.css    # Estilos responsivos
└── README.md              # Esta documentação
```

### Dependências
- **Firebase SDK** - Armazenamento de dados
- **Chart.js** - Gráficos interativos
- **Font Awesome** - Ícones
- **Google Fonts (Inter)** - Tipografia moderna

## ✅ Funcionalidades Implementadas

### 🔥 Integração Firebase
- **Carregamento inteligente**: Firebase primeiro, localStorage como fallback
- **Sincronização automática**: Dados atualizados a cada 30 segundos
- **Cache otimizado**: Reduz chamadas desnecessárias à API
- **Detecção online/offline**: Adapta comportamento conforme conectividade

### 📊 KPIs e Métricas
- **Romaneios**: Contadores por tipo (TL, PCT, Tora)
- **Clientes**: Total e ativos no sistema
- **Espécies**: Catálogo de madeireiras
- **Orçamentos**: Controle financeiro
- **Folha de Pagamento**: Funcionários e lançamentos
- **Volume Total**: Cálculo agregado de todos os romaneios

### 💵 Cotação USD/BRL em Tempo Real
- **API Externa**: AwesomeAPI (Banco Central)
- **Dados completos**: Cotação, alta, baixa, variação
- **Indicador visual**: Status positivo/negativo
- **Cache inteligente**: Evita excesso de requisições
- **Fallback**: Valor padrão se API falhar

### 📈 Gráficos Interativos
- **Romaneios por Tipo**: Gráfico de rosquinha
- **Evolução Mensal**: Gráfico de linha (últimos 6 meses)
- **Responsivos**: Adaptam-se a qualquer tela
- **Animações**: Transições suaves

### 📋 Tabelas de Dados
- **Romaneios Recentes**: 5 últimos com detalhes
- **Clientes Ativos**: Lista dos principais clientes
- **Filtros automáticos**: Dados relevantes apenas
- **Layout responsivo**: Funciona em mobile

## 🎨 Design System

### Paleta de Cores
```css
--dashboard-primary: #3498db    /* Azul principal */
--dashboard-success: #27ae60    /* Verde sucesso */
--dashboard-warning: #f39c12    /* Amarelo alerta */
--dashboard-danger: #e74c3c     /* Vermelho erro */
--dashboard-info: #17a2b8       /* Azul informação */
--dashboard-secondary: #6c757d  /* Cinza secundário */
```

### Responsividade
- **Mobile First**: Design prioriza dispositivos móveis
- **Breakpoints**: 768px (tablet), 480px (mobile)
- **Grid Flexível**: Cards e gráficos se adaptam automaticamente
- **Touch Friendly**: Botões e elementos otimizados para toque

### Acessibilidade
- **Contraste adequado**: Todas as cores atendem WCAG 2.1
- **Navegação por teclado**: Totalmente acessível
- **Screen readers**: Estrutura semântica completa
- **Feedback visual**: Estados hover, focus, loading

## 🚀 Como Usar

### Inicialização Automática
```javascript
// O sistema inicializa automaticamente no DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    const coreInitialized = await window.DashboardCore.init();
    const widgetsInitialized = window.DashboardWidgets.init();
});
```

### Função de Teste
```javascript
// Execute no console do navegador
window.testarDashboard();

// Mostra informações detalhadas sobre:
// - Módulos carregados
// - Funcionalidades disponíveis  
// - Estatísticas atuais
// - Guia de uso
```

### Atualização Manual
```javascript
// Força atualização dos dados
await window.DashboardCore.refresh();

// Ou use o botão "Atualizar" na interface
```

## 🔧 Configurações

### Intervalos de Atualização
```javascript
const CONFIG = {
    refreshInterval: 30000,     // 30 segundos
    cacheTimeout: 5 * 60 * 1000, // 5 minutos
    apiTimeout: 10000           // 10 segundos
};
```

### Dados Carregados
```javascript
// Estrutura de dados do Firebase:
{
    romaneios: { tl: [], pct: [], tora: [] },
    clients: [],
    species: [],
    orcamentos: [],
    folha: { funcionarios: [], lancamentos: [] },
    dollarRate: { value, high, low, variation, timestamp }
}
```

## 🛠️ Desenvolvimento

### Adicionando Novos Widgets
1. Crie a função no `dashboard-widgets.js`
2. Adicione o CSS correspondente no `dashboard-styles.css`
3. Registre o listener para `dashboard:dataLoaded`
4. Atualize a estrutura HTML se necessário

### Integrando Nova Fonte de Dados
1. Adicione o carregamento no `dashboard-core.js`
2. Atualize a função `loadAllData()`
3. Modifique `calculateStatistics()` se necessário
4. Crie widgets para exibir os novos dados

### Personalizando Estilos
- Modifique as variáveis CSS em `:root`
- Use as classes utilitárias disponíveis
- Respeite a hierarquia de responsividade
- Teste em diferentes dispositivos

## 🔍 Troubleshooting

### Dashboard não carrega
1. Verifique se Firebase está disponível
2. Confirme se os módulos estão sendo importados
3. Veja o console para erros específicos
4. Teste a conectividade de rede

### Cotação do dólar não funciona
1. Verifique conectividade de internet
2. Teste a API manualmente: `https://api.awesomeapi.com.br/json/last/USD-BRL`
3. Verifique se não há bloqueio de CORS
4. O sistema usa fallback em caso de falha

### Gráficos não aparecem
1. Confirme se Chart.js está carregado
2. Verifique se há dados suficientes
3. Inspecione erros no console
4. Teste o redimensionamento da janela

### Performance lenta
1. Verifique quantidade de dados carregados
2. Ajuste intervalos de refresh se necessário
3. Use ferramentas de dev para profiling
4. Considere otimizar queries Firebase

## 🎯 Roadmap Futuro

### Versão 2.0
- [ ] **PWA**: Funcionalidade offline completa
- [ ] **Notificações Push**: Alertas importantes
- [ ] **Filtros Avançados**: Período, cliente, tipo
- [ ] **Exportação**: PDF, Excel dos relatórios
- [ ] **Dashboard Personalizado**: Usuário escolhe widgets

### Versão 2.1  
- [ ] **Multi-tenancy**: Suporte a múltiplas empresas
- [ ] **Permissões**: Controle de acesso por usuário
- [ ] **Audit Log**: Histórico de alterações
- [ ] **API REST**: Integração com sistemas externos

### Melhorias Contínuas
- [ ] **Testes Automatizados**: Jest + Testing Library
- [ ] **CI/CD Pipeline**: Deploy automático
- [ ] **Monitoramento**: Analytics de uso
- [ ] **Documentação**: Mais exemplos e tutoriais

## 📞 Suporte

Para dúvidas, bugs ou sugestões:

1. **Console**: Use `window.testarDashboard()` para diagnósticos
2. **Logs**: Verifique console do navegador para detalhes
3. **Network**: Inspecione chamadas de rede em caso de falhas
4. **Desenvolvimento**: Consulte este README e comentários no código

---

**✨ Dashboard Modular SISWEB - Desenvolvido com ❤️ seguindo padrões do RomaneioTL**
