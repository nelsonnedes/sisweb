# Script para corrigir erro de hash no deploy Firebase
# Erro: "content hash doesn't match content"

Write-Host "🔧 Corrigindo erro de deploy Firebase..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan

# 1. Limpar cache do Firebase
Write-Host "1. Limpando cache do Firebase..." -ForegroundColor Yellow
firebase deploy:cache:clear

# 2. Tentar deploy limpo
Write-Host "2. Tentando deploy limpo..." -ForegroundColor Yellow
firebase deploy --only hosting --force

if ($LASTEXITCODE -ne 0) {
    Write-Host "3. Ainda com erro, tentando solução alternativa..." -ForegroundColor Yellow
    
    # Verificar se há arquivos problemáticos
    Write-Host "   Procurando arquivos grandes ou corrompidos..." -ForegroundColor Cyan
    
    # Listar arquivos maiores que 5MB
    $arquivosGrandes = Get-ChildItem -Path . -Recurse -File | Where-Object { $_.Length -gt 5MB } | Select-Object FullName, Length
    
    if ($arquivosGrandes) {
        Write-Host "   ⚠️ Arquivos grandes encontrados:" -ForegroundColor Red
        $arquivosGrandes | ForEach-Object {
            $tamanhoMB = [math]::Round($_.Length / 1MB, 2)
            Write-Host "   - $($_.FullName) ($tamanhoMB MB)" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "   Adicione estes arquivos ao ignore do firebase.json" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ Nenhum arquivo anormalmente grande encontrado" -ForegroundColor Green
    }
    
    # Tentar deploy apenas do que é necessário
    Write-Host "4. Tentando deploy mínimo..." -ForegroundColor Yellow
    Write-Host "   Usando: firebase deploy --only hosting --force" -ForegroundColor Cyan
    firebase deploy --only hosting --force
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
} else {
    Write-Host "❌ Ainda há erros. Veja as soluções abaixo:" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUÇÕES ALTERNATIVAS:" -ForegroundColor Yellow
    Write-Host "1. Faça commit e push das mudanças" -ForegroundColor White
    Write-Host "2. Tente: firebase deploy --only hosting:prod" -ForegroundColor White
    Write-Host "3. Verifique se não há arquivos corrompidos" -ForegroundColor White
    Write-Host "4. Entre em contato com suporte Firebase" -ForegroundColor White
}

