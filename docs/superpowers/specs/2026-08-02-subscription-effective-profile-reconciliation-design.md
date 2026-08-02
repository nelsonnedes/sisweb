# Design: Reconciliacao Do Status Efetivo Da Assinatura

## Contexto

O login resolve a assinatura a partir de `users/{uid}`, enquanto `subscription-status.html` tenta primeiro `companies/{companyId}/users/{uid}`. Quando as replicas divergem, o mesmo usuario pode ser redirecionado como expirado e, logo depois, visualizar um Trial vigente.

## Objetivo

Fazer Login, guards e tela de assinatura consumirem o mesmo perfil efetivo, sem alterar dados reais, Rules ou Functions e sem aceitar identidade ou tenant de uma replica divergente.

## Regras De Autoridade

1. Firebase Auth continua sendo a unica fonte de UID.
2. O tenant vem apenas do contexto autenticado canonico.
3. Somente `users/{uid}` e `companies/{companyId}/users/{uid}` podem participar da reconciliacao.
4. Um bloqueio explicito em qualquer replica prevalece sobre vigencia ou marcadores legados.
5. Uma `endDate` futura valida confirma assinatura ou Trial vigente quando nao existe bloqueio.
6. Um marcador `expired` nao pode vencer uma data futura valida da outra replica.
7. O estado fica expirado quando nao existe vigencia futura e ha data vencida ou marcador expirado confiavel.
8. Campos de identidade, permissao, papel e tenant nunca sao mesclados entre replicas.

## Arquitetura

O `firebaseService` recebe um resolvedor tenant-scoped que carrega as duas replicas por UID autenticado e devolve um envelope com:

- perfil raiz;
- perfil tenant;
- campos de assinatura reconciliados;
- status efetivo;
- origem usada e avisos de divergencia sem PII.

`auth.js` passa a usar esse envelope no login, em `getCurrentUserDetails` e nos guards. `subscription-status.html` deixa de montar sua propria precedencia de perfis e reutiliza o mesmo servico. O resolvedor puro de status permanece responsavel por interpretar datas e marcadores.

## Fluxo

1. Auth confirma o usuario.
2. O contexto canonico confirma `companyId`.
3. O servico le as duas replicas autorizadas.
4. O reconciliador aplica bloqueio, datas e marcadores nessa ordem.
5. Login e guards recebem o mesmo `statusKey` exibido pela tela de assinatura.
6. Falha transitiva de uma replica usa a outra; falha das duas retorna `unknown`, sem inventar `expired`.

## Erros E Seguranca

- Leituras de outro UID ou tenant sao rejeitadas.
- Falha de rede nao promove cache local a autorizacao.
- `unknown` nao concede privilegio novo; preserva o comportamento seguro ja definido pelos guards.
- Divergencias podem ser registradas apenas como codigos tecnicos, sem UID, email, companyId ou dados comerciais.
- Nenhuma escrita de reparo automatico faz parte deste lote.

## Testes

- raiz expirada e tenant com Trial futuro resulta em `trial_active`;
- raiz ativa e tenant bloqueado resulta em `blocked`;
- ambas as replicas vencidas resultam em `expired`;
- apenas uma replica disponivel continua funcional;
- nenhuma replica retorna `unknown`;
- Login, guard e `subscription-status.html` usam o resolvedor compartilhado;
- suite completa, lint, typecheck, build allowlisted e `git diff --check`.

## Publicacao

Publicar primeiro em Preview Channel, validar login e status com o tenant de teste e promover somente o Hosting. Rules, Storage, Database e Functions ficam fora do deploy.

## Fora De Escopo

- reparar ou migrar replicas divergentes;
- criar nova Callable Function;
- alterar cobranca, planos, periodo de Trial ou modo leitura;
- mudar RBAC ou caminhos do Realtime Database.
