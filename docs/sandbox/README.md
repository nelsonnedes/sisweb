# Sandbox de Romaneios

Esta pasta/worktree é isolada da `main`. Nenhum deploy daqui deve usar o projeto de produção.

## 1. Emulador (uso diário)

```powershell
npm run sandbox:guard:emulator
npm run sandbox:emulators
```

Abra `http://127.0.0.1:5000`. Para o frontend apontar para os emuladores, no console do navegador:

```js
localStorage.setItem('__SISWEB_FIREBASE_CONFIG__', JSON.stringify({
  apiKey: 'demo-key',
  authDomain: 'demo-sisweb-sandbox.firebaseapp.com',
  databaseURL: 'http://127.0.0.1:9300?ns=demo-sisweb-sandbox',
  projectId: 'demo-sisweb-sandbox',
  storageBucket: 'demo-sisweb-sandbox.appspot.com',
  appId: '1:demo:web:demo'
}));
localStorage.setItem('__SISWEB_EMULATORS__', JSON.stringify({
  auth: 'http://127.0.0.1:9099',
  database: { host: '127.0.0.1', port: 9300 },
  storage: { host: '127.0.0.1', port: 9199 },
  functions: { host: '127.0.0.1', port: 5001 }
}));
location.reload();
```

Em produção essas chaves são ignoradas pelo `firebase-init.js`.

## 2. Projeto Firebase sandbox real

1. Crie `sisweb-sandbox-romaneios` (ou ajuste `firebase.sandbox.json`) sem IAM em `sisweb-7ce82`.
2. Ative Auth, RTDB, Storage, Hosting e Functions no projeto sandbox.
3. Autorize o domínio de sandbox no Auth e configure o site de Hosting.
4. Use credencial de sandbox em `GOOGLE_APPLICATION_CREDENTIALS`, nunca `C:\Sisweb\service-account.json`.
5. Deploy:

```powershell
npm run sandbox:deploy
```

O `predeploy` executa o guard e recusa projeto de produção.

## 3. Dados

- Exporte somente o tenant necessário, sanitize PII e preserve IDs técnicos.
- Nunca importe dados de produção sem remover usuários, pagamentos, fiscal, certificados e tokens.
- Migração de numeração:

```powershell
node scripts/romaneios-numeracao-migrate.cjs --tenant <tenant> --report tmp/dry-run.json
node scripts/romaneios-numeracao-migrate.cjs --tenant <tenant> --apply --backup tmp/backup.json --report tmp/apply.json
```

Dry-run é o padrão. `--apply` exige backup e ambiente explícito.

## 4. Limitações atuais

- O CSP de algumas páginas ainda referencia produção; valide no emulador e ajuste o CSP do build sandbox antes de testes E2E completos.
- O callable `romaneioReservarNumero` ainda não foi ligado aos formulários.
- O backfill ainda não foi aplicado em nenhum banco.
- Não copie `.env`, `service-account.json`, `hosting-dist/` ou `node_modules/` entre produção e sandbox.
