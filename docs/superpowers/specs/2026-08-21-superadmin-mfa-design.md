# Design — MFA (2FA) para Super Admin

> Data: 2026-08-21 | Status: Proposta (aguarda validação PO/Arquitetura/Usuário)
> Fonte: `ultimas_Implementacoes.md` roadmap 🔴 "Implementar 2FA/MFA para Super Admin"
> Método: architect-first (design completo antes de código; sem regressão)

## 1) Contexto e estado atual (mapeado)

- SuperAdmin identificado por **allowlist de UID** (`SUPER_ADMIN_UIDS` env, default `HfrQ6ObQq2aSEoeEE4Ng9jpAolB3`), `assertSuperAdmin()` em `functions/index.js:263`.
- Auth: Firebase Auth (email/senha) via `firebase-init.js` singleton + `auth.js` (99KB) + `login.html` (83KB).
- **SMTP já implementado** (`nodemailer` + App Password Gmail) — usado no e-mail de ativação de assinantes.
- Escopo: apenas **1 usuário (Nelson) hoje**; allowlist é extensível via env.
- Não há nenhum mecanismo 2FA hoje (zero matches de `otp`/`totp`/`twoFactor` no código app).

## 2) Objetivo

Adicionar uma segunda camada de autenticação **apenas para SuperAdmin**, sem tocar no fluxo de login dos tenants comuns (zero regressão). Login comum permanece email+senha.

## 3) Opções (A/B/C) com trade-offs

### Opção A — TOTP (Google Authenticator / app autenticador) — RECOMENDADA
- **Como:** secret gerado no backend (`otpauth`/`crypto`), exibido como QR no perfil do SuperAdmin; login pede o código de 6 dígitos após senha.
- **Pros:** padrão de mercado; offline; sem custo por envio; sem dependência externa de SMS; à prova de SIM-swap.
- **Cons:** usuário precisa de app autenticador; secret precisa ser armazenado criptografado.
- **Risco:** baixo; isolado ao SuperAdmin; não altera fluxo dos tenants.

### Opção B — Email OTP (código de 6 dígitos por e-mail)
- **Como:** ao logar como SuperAdmin, gera código 6 dígitos, envia via SMTP já existente, valida com expiração curta (5 min).
- **Pros:** reaproveita SMTP existente; UX simples; sem app externo.
- **Cons:** menos seguro que TOTP (depende da segurança do e-mail); latência de envio; custo zero mas frágil se SMTP cair.
- **Risco:** baixo; isolado ao SuperAdmin.

### Opção C — SMS OTP (Twilio/Vonage)
- **Como:** envio de código via SMS.
- **Pros:** comum em SaaS.
- **Cons:** custo + compliance (consentimento/TLS Brasil); nova dependência/credencial; complexidade de setup.
- **Risco:** médio-alto; **não recomendado** para escopo atual (1 usuário).

## 4) Recomendação e escopo

**Opção A (TOTP)** como primária, com **Opção B (Email OTP) como fallback** opcional. Escopo mínimo:
1. Backend (`functions/`): gerar/validar TOTP (secret criptografado no RTDB `system/superadmin/{uid}/mfa`), callables `superAdminMfaSetup`, `superAdminMfaVerify`, `superAdminMfaDisable`.
2. Frontend (`login.html` + `auth.js`): etapa de 2FA pós-login quando UID ∈ allowlist superadmin.
3. Perfil (`user-profile.html`): ativar/desativar MFA + QR code.
4. Sem tocar no fluxo de login de tenants (guard por `isSuperAdminUid`).

## 5) Não-negociáveis (anti-regressão)

- **Nenhum toque** no login de tenant comum; a checagem MFA ocorre **somente** após identificar SuperAdmin.
- **Sem mudança** em `firebase-init.js` (singleton), rules de tenants, ou funções financeiras.
- **Secret nunca em plain text**: criptografado com chave de Secret Manager; apenas `system/superadmin/...` (já protegido por regras superadmin).
- **Capacidade preservada**: allowlist por env continua; UIDs sem MFA cadastrado seguem login normal (rollback seguro).
- **Config externalizada**: duração do código, janela TOTP e issuer em constantes de topo (não hardcoded espalhado).

## 6) Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Lockout do SuperAdmin (perder app autenticador) | Fallback Email OTP + "desativar MFA" via allowlist/env de emergência |
| Regressão no login comum | Guard isolado; testes `auth-session` existentes mantidos verdes |
| Secret vazando no client | Secret só sai no setup inicial; nunca é retornado em verify |

## 7) Testes

- `tests/superadmin-mfa.test.mjs`: setup retorna secret uma única vez; verify aceita/rejeita código; TOTP janela de tempo; disable; fallback email; guard não afeta tenant.

## 8) Fora de escopo

MFA para tenants, SMS, hardware keys (WebAuthn), recovery codes multi-dispositivo.
