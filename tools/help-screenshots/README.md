# Captura de prints reais (Sisweb)

Este utilitário gera os prints reais (PNG) que o `ajuda.html` usa.

## Pré-requisitos
- Node.js instalado
- Credenciais de um usuário de teste

## Como usar
1) Instalar dependências e navegador:

```bash
cd tools/help-screenshots
npm install
npm run install:browsers
```

2) Definir variáveis de ambiente (Windows PowerShell):

```powershell
$env:SISWEB_BASE_URL = "https://sisweb-7ce82.web.app"
$env:SISWEB_EMAIL = "seu-email@dominio.com"
$env:SISWEB_PASSWORD = "sua-senha"
```

3) Rodar captura:

```bash
npm run capture
```

Os arquivos serão gravados em `help-assets/` na raiz do projeto.

## Rotas capturadas
Edite `routes.json` para adicionar/remover telas.
