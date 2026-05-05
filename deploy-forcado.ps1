# Deploy forcado sem cache - Firebase Hosting
# Este script resolve problemas de cache ao fazer deploy

Write-Host "Iniciando deploy forcado sem cache..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan

# 1. Fazer backup do firebase.json atual
Write-Host "1. Fazendo backup do firebase.json atual..." -ForegroundColor Yellow
if (Test-Path "firebase-backup.json") {
    Remove-Item "firebase-backup.json"
}
Copy-Item "firebase.json" "firebase-backup.json"
Write-Host "Backup criado: firebase-backup.json" -ForegroundColor Green

# 2. Aplicar configuracao sem cache temporariamente
Write-Host "2. Aplicando configuracao SEM CACHE..." -ForegroundColor Yellow
Copy-Item "firebase-no-cache.json" "firebase.json"
Write-Host "Configuracao sem cache aplicada" -ForegroundColor Green

# 3. Fazer deploy forcado
Write-Host "3. Fazendo deploy FORCADO..." -ForegroundColor Yellow
Write-Host "Executando: firebase deploy --only hosting --force" -ForegroundColor Cyan
firebase deploy --only hosting --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "DEPLOY CONCLUIDO COM SUCESSO!" -ForegroundColor Green
} else {
    Write-Host "ERRO NO DEPLOY!" -ForegroundColor Red
    Write-Host "Restaurando firebase.json original..." -ForegroundColor Yellow
    Copy-Item "firebase-backup.json" "firebase.json"
    exit 1
}

# 4. Aguardar propagacao
Write-Host "4. Aguardando propagacao (30 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 5. Restaurar configuracao original de cache
Write-Host "5. Restaurando configuracao original..." -ForegroundColor Yellow
Copy-Item "firebase-backup.json" "firebase.json"
Write-Host "Configuracao original restaurada" -ForegroundColor Green

# 6. Fazer deploy final com cache normal
Write-Host "6. Deploy final com cache otimizado..." -ForegroundColor Yellow
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "DEPLOY FINAL CONCLUIDO!" -ForegroundColor Green
} else {
    Write-Host "Erro no deploy final, mas correcoes ja foram aplicadas" -ForegroundColor Yellow
}

# 7. Limpar arquivos temporarios
Write-Host "7. Limpando arquivos temporarios..." -ForegroundColor Yellow
Remove-Item "firebase-backup.json" -ErrorAction SilentlyContinue

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "DEPLOY FORCADO CONCLUIDO!" -ForegroundColor Green
Write-Host ""
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. Aguarde 2-3 minutos para propagacao completa" -ForegroundColor White
Write-Host "2. Acesse seu site: https://sisweb-7ce82.web.app" -ForegroundColor White
Write-Host "3. Faca Ctrl+Shift+R para limpar cache do navegador" -ForegroundColor White
Write-Host "4. Teste as funcionalidades de especies" -ForegroundColor White
Write-Host ""
Write-Host "TESTE:" -ForegroundColor Green
Write-Host "- Clique no icone da folha ao lado do campo especie" -ForegroundColor White
Write-Host "- Deve abrir prompt para nova especie" -ForegroundColor White
Write-Host ""
Write-Host "Para verificar se funcionou:" -ForegroundColor Green
Write-Host ".\verificar-deploy.ps1" -ForegroundColor Cyan