@echo off
echo ==========================================
echo   DEPLOY DE REGRAS DE STORAGE (FIREBASE)
echo ==========================================
echo.
echo Este script vai aplicar as regras de seguranca para o Storage
echo e configurar o CORS para permitir uploads de logos.
echo.
echo [IMPORTANTE] Voce DEVE ativar o Storage no console antes de continuar!
echo Link: https://console.firebase.google.com/project/sisweb-7ce82/storage
echo.
echo Pressione qualquer tecla para continuar APOS ativar o Storage...
pause

echo.
echo [1/2] Fazendo deploy das regras de storage...
call firebase deploy --only storage
if errorlevel 1 goto error

echo.
echo [2/2] Configuracao de CORS
echo.
echo O arquivo 'cors.json' foi criado na raiz.
echo Para aplicar o CORS, use o comando abaixo (se tiver gsutil):
echo gsutil cors set cors.json gs://sisweb-7ce82.firebasestorage.app
echo.
echo Se nao tiver gsutil, configure manualmente no console do Google Cloud.
echo.
echo Pressione qualquer tecla para finalizar...
pause
exit /b 0

:error
echo.
echo [ERRO] O deploy falhou. 
echo Verifique se voce ativou o Storage no console do Firebase.
echo Verifique se voce esta logado (firebase login).
pause
exit /b 1
