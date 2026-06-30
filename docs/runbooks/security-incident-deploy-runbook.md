# Runbook: Seguranca, Rotacao e Deploy Controlado do Sisweb

## Escopo

Este runbook guia a contencao de credenciais/dados sensiveis, deploy das correcoes de seguranca e validacao pos-deploy do projeto Firebase `sisweb-7ce82`.

Use este documento quando houver exposicao de chave privada, dump de dados, arquivo LGPD sensivel, regra aberta, claim SuperAdmin suspeita ou necessidade de deploy seguro em producao.

## Principios

- Nao cole segredos, tokens, service account JSON, dumps ou PII em chat, issue ou commit.
- Faca deploy em etapas pequenas: Hosting primeiro, depois regras, depois Functions.
- Antes de qualquer mudanca destrutiva, exporte/registre o estado atual para rollback.
- Em caso de credencial exposta, trate como comprometida mesmo que nao haja evidencia de abuso.
- O sistema esta em producao com dados reais; smoke tests devem usar contas e fluxos autorizados.

## 1. Congelamento e Evidencia

1. Avise os responsaveis pelo projeto que a janela de seguranca iniciou.
2. Pause deploys paralelos ate a conclusao desta janela.
3. Registre:
   - data/hora de inicio;
   - branch local;
   - commit base;
   - responsavel por Firebase/GCP;
   - responsavel por validacao de negocio.
4. Rode localmente:

```powershell
npm run lint
npm run typecheck
npm test
```

5. Se algum gate falhar, nao prossiga para deploy ate corrigir ou obter decisao formal de risco.

## 2. Backup Antes de Deploy

1. No Console Firebase, abra o projeto `sisweb-7ce82`.
2. Salve copia atual das regras:
   - Realtime Database Rules;
   - Storage Rules;
   - Firestore Rules, se aplicavel.
3. Opcionalmente, usando Firebase CLI autenticado:

```powershell
firebase database:get /.settings/rules --project sisweb-7ce82 > backup-database-rules-before-security.json
firebase storage:buckets:list --project sisweb-7ce82
```

4. Guarde esses arquivos fora da pasta publica do Hosting e fora do Git.

## 3. Rotacao da Chave de Service Account

Acao obrigatoria do owner/GCP IAM. Eu nao devo executar esta etapa sem autorizacao e acesso de dono.

1. Acesse [Google Cloud Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Selecione o projeto `sisweb-7ce82`.
3. Localize a service account correspondente ao arquivo local `service-account.json`.
4. Abra a aba **Keys** dessa service account.
5. Identifique a chave pelo `private_key_id` do JSON local, sem copiar o segredo para lugar nenhum.
6. Se ainda existir algum processo externo que depende dessa chave:
   - crie uma chave nova;
   - atualize o processo externo;
   - teste que ele funciona;
   - desabilite a chave antiga;
   - monitore erros por alguns minutos;
   - delete a chave antiga.
7. Se nenhum processo externo precisa dessa chave:
   - desabilite a chave antiga primeiro;
   - monitore;
   - delete a chave antiga.
8. Prefira Workload Identity Federation, Application Default Credentials ou secrets gerenciados em vez de chave JSON longa.

Notas oficiais da Google:

- Chaves comprometidas devem ser rotacionadas imediatamente.
- A exclusao de uma chave e permanente e nao revoga credenciais de curta duracao ja emitidas.
- O fluxo recomendado e criar/substituir, desabilitar, monitorar e deletar.

Referencias:

- https://docs.cloud.google.com/iam/docs/key-rotation
- https://docs.cloud.google.com/iam/docs/keys-create-delete

## 4. Limpeza de Historico Git

Acao de @devops/owner, especialmente se o repositorio ja foi enviado para remoto.

1. Confirme quais arquivos sensiveis entraram no Git:

```powershell
git log --all -- service-account.json
git log --all -- Clients.json fornecedores.json contasReceber.json romaneiosTora.json
```

2. Se houve push para remoto, escolha uma janela com todos os colaboradores.
3. Use ferramenta apropriada, como `git filter-repo` ou BFG Repo-Cleaner, para remover:
   - `service-account.json`;
   - dumps RTDB;
   - exports com PII;
   - `.env*` e backups.
4. Force-push so deve ser feito por @devops/owner, conforme Constitution do projeto.
5. Todos os colaboradores devem re-clonar ou resetar seus clones apos a reescrita.
6. Mesmo apos limpeza de historico, mantenha a chave rotacionada/revogada.

## 5. Deploy Controlado

Execute somente com Firebase CLI autenticado e autorizacao do owner.

1. Confirme o projeto:

```powershell
firebase projects:list
firebase use sisweb-7ce82
```

2. Rode novamente os gates:

```powershell
npm run lint
npm run typecheck
npm test
```

3. Deploy 1: Hosting, para remover arquivos publicos sensiveis e aplicar headers.

```powershell
firebase deploy --only hosting --project sisweb-7ce82
```

4. Valide Hosting:

```powershell
npm run security:postdeploy
```

5. Deploy 2: regras RTDB e Storage, depois de revisar impacto multi-tenant.

```powershell
firebase deploy --only database,storage --project sisweb-7ce82
```

6. Deploy 3: Functions, preferencialmente em janela monitorada.

```powershell
firebase deploy --only functions --project sisweb-7ce82
```

7. Rode smoke tests manuais autorizados:
   - login admin de empresa;
   - login subusuario;
   - leitura/escrita de modulos permitidos;
   - tentativa negada em modulo sem permissao;
   - fluxo NF-e permitido para tenant correto;
   - tentativa negada em tenant divergente;
   - upload/remocao de certificado apenas por perfil autorizado;
   - comprovante de assinatura visivel apenas ao proprio usuario e SuperAdmin.

## 6. Validacao Pos-Deploy

1. Rode:

```powershell
npm run security:postdeploy
```

2. Resultado esperado:
   - arquivos sensiveis retornam 403 ou 404;
   - `/`, `/index.html`, `/login.html`, `/manifest.json` e `/sw.js` retornam 200;
   - headers de seguranca aparecem em `/login.html`.
3. Se um arquivo sensivel retornar 200, trate como incidente ainda aberto.
4. Se rota publica essencial falhar, pause os proximos deploys e aplique rollback de Hosting.

## 7. Revogacao de SuperAdmin Antigo

Acao mutavel em usuarios reais. Deve ter aprovacao do owner.

1. Liste usuarios que possuem claim `superadmin=true`.
2. Compare com a allowlist configurada em `SISWEB_SUPERADMIN_UIDS` e `SISWEB_SUPERADMIN_EMAILS`.
3. Para qualquer usuario fora da allowlist:
   - remova a custom claim;
   - registre auditoria;
   - force refresh/relogin quando aplicavel.
4. Remova marcadores legados em RTDB somente apos confirmar que Functions ja nao dependem deles.

## 8. Rollback

Se o deploy bloquear fluxo critico:

1. Suspenda novos deploys.
2. Reaplique as regras salvas no backup pelo Console Firebase ou Firebase CLI.
3. Para Hosting, redeploy do commit anterior conhecido como bom.
4. Para Functions, redeploy da versao anterior ou desative temporariamente apenas a Function afetada.
5. Registre:
   - causa;
   - impacto;
   - tempo de indisponibilidade;
   - acao corretiva;
   - teste que previne regressao.

## 9. Pendencias Arquiteturais Apos Contencao

- Migrar `companies/{companyId}` para RBAC por modulo/funcionalidade, sem leitura/escrita ampla no pai.
- Implementar tela/callables de subusuarios com matriz de permissoes por empresa.
- Criar auditoria append-only para permissoes, perfil da empresa, operacoes fiscais e claims.
- Implementar retencao/DSR LGPD: exportacao, correcao, exclusao/anomizacao e trilha de consentimento.
- Manter rotina periodica de atualizacao de dependencias com testes e `npm audit --omit=dev`.
- Adotar secret manager/ADC para rotinas administrativas, removendo dependencia de JSON local.

## 10. Status Pos-Incidente - 2026-06-16

- Owner confirmou que a chave exposta de `service-account.json` foi revogada no Console Firebase/GCP.
- O repositorio local nao possui remoto configurado e o owner informou que nao foi compartilhado.
- O historico Git local foi higienizado; `git log --all` e `git rev-list --all --objects` nao retornam os artefatos sensiveis removidos.
- `functions.config()` legado foi removido em story posterior; SMTP usa Secret Manager e Runtime Config ficou vazio.
- Dependencias foram atualizadas; `npm audit --omit=dev` ficou zerado na raiz e em `functions` usando override controlado de `uuid@11.1.1`, sem downgrade de `firebase-admin`/`firebase-functions`.
- Auditoria Auth encontrou 7 usuarios e nenhum `superadmin=true` fora da allowlist atual.
- Data Connect `nelsonnedesbrito` e Cloud SQL `nelsonnedesbrito-fdc` foram excluidos apos logs sem trafego desde 2026-06-10 e autorizacao do owner.
