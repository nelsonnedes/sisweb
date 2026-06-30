# Story: Correção de aviso de conexão preso no login após deploy

## Status
Ready for Review

## Contexto
Após deploy no Firebase Hosting, o acesso a `login.html` pode exibir avisos de conexão degradada enquanto o Firebase inicializa. Em navegadores reais, a primeira leitura de `.info/connected` pode vir como offline e ficar online poucos segundos depois.

## Problema
O `login.html` mostra `Conexão degradada` e `Problema de Conexão` quando `_FIREBASE_CONNECTED` começa como `false`, mas não limpa esse estado se o Firebase conecta depois que o fluxo inicial já passou. Isso passa a sensação de que o sistema não carregou, mesmo com formulário, `firebaseService` e autenticação disponíveis.

## Objetivo
Limpar automaticamente avisos transitórios de conexão quando o Firebase ficar online, sem esconder erros reais de login, logout, cache ou parâmetros explícitos de manutenção.

## Acceptance Criteria
- [x] `firebaseService.js` emite evento de mudança de conexão Firebase.
- [x] `login.html` escuta o evento e limpa avisos transitórios quando a conexão fica online.
- [x] A tela de login mantém mensagens explícitas de reset/logout/offline/error quando aplicável.
- [x] Smoke local em navegador headless confirma formulário carregado e sem aviso preso após conexão.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Reproduzir o comportamento em navegador limpo.
- [x] Implementar evento de conexão no serviço Firebase.
- [x] Implementar limpeza dos avisos transitórios no login.
- [x] Adicionar teste de regressão estático.
- [x] Rodar gates e atualizar File List.

## File List
- `docs/stories/2026-05-21-login-conexao-pos-deploy.md`
- `firebaseService.js`
- `login.html`
- `tests/company-logo-storage-policy.test.mjs`

## Implementação
- Criado `notifyConnectionChange()` em `firebaseService.js` para manter `window.firebaseConnected`, `window._FIREBASE_CONNECTED` e emitir `sisweb:firebase-connection`.
- O monitor direto de `.info/connected` e a integração com `FirebaseConnectionManager` passaram a usar o mesmo emissor de evento.
- `login.html` ganhou `clearTransientConnectionWarnings()` para esconder apenas avisos transitórios de conexão/cache/autenticação indisponível.
- A limpeza não roda quando há contexto explícito de manutenção via `reset=true`, `offline=true`, `error=true` ou `logout=1`.
- `waitForFirebaseConnection()` e a validação inicial de Firebase chamam a limpeza quando a conexão fica online.
- Teste estático garante que o login escuta o evento e que o serviço emite a mudança de conexão.

## Validação
- Smoke publicado antes da correção: `login.html` carregava formulário, mas mantinha `Conexão degradada` e `Problema de Conexão` mesmo após `Firebase conectado com sucesso`.
- Smoke local após correção com Edge headless: `hasLoginForm=true`, `firebaseConnected=true`, `hasFirebaseService=true`, `hasAuthService=true`, `hasWindowLogin=true`, `healthDisplay=none`, `maintenanceDisplay=none`, sem erros capturados.
- `node --check firebaseService.js` passou.
- `npm test` passou com 9 testes.
- `git diff --check` passou nos arquivos da correção.
- `npm run lint` passou.
- `npm run typecheck` passou.

## Notas
- Os logs `newtab-*.js` informados são da página/ambiente do navegador, não do arquivo `login.html` do SisWeb.
- Não alterar regras Firebase nesta story.
