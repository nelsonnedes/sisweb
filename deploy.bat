@echo off
echo.
echo ========================================
echo 🚀 DEPLOY SISWEB PARA FIREBASE HOSTING
echo ========================================
echo.

echo 📋 Verificando dependências...

:: Verificar se Firebase CLI está instalado
firebase --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ Firebase CLI não encontrado!
    echo.
    echo 📥 Instalando Firebase CLI...
    npm install -g firebase-tools
    if errorlevel 1 (
        echo ❌ Erro ao instalar Firebase CLI
        echo 💡 Execute manualmente: npm install -g firebase-tools
        pause
        exit /b 1
    )
)

echo ✅ Firebase CLI disponível

echo.
echo 🔐 Fazendo login no Firebase...
firebase login

echo.
echo 📁 Iniciando deploy do projeto...
echo.
echo 🔥 Projeto: sisweb-7ce82
echo 📂 Diretório: %cd%
echo.

:: Fazer deploy
firebase deploy --only hosting

if errorlevel 1 (
    echo.
    echo ❌ Erro durante o deploy!
    echo.
    echo 🔧 Possíveis soluções:
    echo   1. Verificar se está logado: firebase login
    echo   2. Verificar projeto: firebase use sisweb-7ce82
    echo   3. Verificar permissões no projeto Firebase
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ DEPLOY CONCLUÍDO COM SUCESSO!
echo ========================================
echo.
echo 🌐 URL do sistema: https://sisweb-7ce82.web.app
echo 🔗 URL alternativa: https://sisweb-7ce82.firebaseapp.com
echo.
echo 🎯 Páginas principais disponíveis:
echo   • Sistema Principal: /romaneiotora.html
echo   • Teste Fornecedores: /teste-listas-firebase.html
echo   • Diagnóstico: /firebase-diagnostico.html
echo.
echo 💡 Para testar, acesse uma das URLs acima
echo.
pause 