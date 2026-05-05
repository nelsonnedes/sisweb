@echo off
echo =====================================
echo 🚀 CORREÇÃO AUTOMÁTICA - DEPLOY FIREBASE
echo =====================================
echo.
echo Status: Corrigindo problemas de autenticação e deploy
echo Data: %date% %time%
echo.

echo 📋 ETAPA 1: Verificando status atual...
firebase --version
if errorlevel 1 (
    echo ❌ Firebase CLI não encontrado
    echo ℹ️ Instale com: npm install -g firebase-tools
    pause
    exit /b 1
)

echo.
echo 📋 ETAPA 2: Tentando listar projetos...
firebase projects:list
if errorlevel 1 (
    echo ⚠️ Credenciais inválidas - necessário relogar
    goto :reauth
) else (
    echo ✅ Credenciais válidas
    goto :deploy
)

:reauth
echo.
echo 📋 ETAPA 3: Reautenticando com Firebase...
echo ℹ️ Isso abrirá seu navegador para login
echo ℹ️ Pressione qualquer tecla para continuar...
pause > nul

firebase login --reauth
if errorlevel 1 (
    echo ❌ Falha na autenticação
    echo ℹ️ Tente manualmente: firebase login --no-localhost
    pause
    exit /b 1
)

echo.
echo ✅ Autenticação bem-sucedida!

:deploy
echo.
echo 📋 ETAPA 4: Verificando projeto ativo...
firebase use
if errorlevel 1 (
    echo ⚠️ Nenhum projeto ativo definido
    echo ℹ️ Listando projetos disponíveis...
    firebase projects:list
    echo.
    echo ℹ️ Defina o projeto com: firebase use [PROJECT_ID]
    pause
    exit /b 1
)

echo.
echo 📋 ETAPA 5: Iniciando deploy...
echo ✅ Fazendo deploy apenas do hosting (mais rápido)
firebase deploy --only hosting

if errorlevel 1 (
    echo.
    echo ❌ ERRO NO DEPLOY
    echo ================
    echo.
    echo 🔍 Possíveis soluções:
    echo 1. Verificar se o projeto está correto: firebase use
    echo 2. Verificar firebase.json
    echo 3. Verificar permissões no projeto Firebase
    echo 4. Ver logs: type firebase-debug.log
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ DEPLOY REALIZADO COM SUCESSO!
    echo ==============================
    echo.
    echo 🎉 Sistema Romaneiopct V2.0 publicado!
    echo 🌐 Acesse seu site Firebase para testar
    echo.
    echo 📊 Próximos passos:
    echo 1. Testar romaneiopct.html no site publicado
    echo 2. Verificar se não há erros no console
    echo 3. Testar funcionalidades PCT específicas
    echo.
    
    echo 🚀 Abrindo console do projeto...
    firebase open hosting:site
    
    echo.
    echo ✅ DEPLOY CONCLUÍDO - SISTEMA OPERACIONAL!
)

echo.
echo Pressione qualquer tecla para finalizar...
pause > nul