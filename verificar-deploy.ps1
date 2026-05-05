# Verificar deploy - Firebase Hosting
# Este script verifica se as correcoes foram deployadas corretamente

Write-Host "Verificando deploy das correcoes..." -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan

$siteUrl = "https://sisweb-7ce82.web.app"

Write-Host "Verificando arquivos no Firebase Hosting..." -ForegroundColor Yellow
Write-Host ""

# Verificar se os arquivos principais existem
$filesToCheck = @(
    "romaneiopct.html",
    "modules/romaneiopct/modal-especies-pct.js",
    "modules/romaneiopct/modal-clientes-pct.js"
)

foreach ($file in $filesToCheck) {
    $url = "$siteUrl/$file"
    Write-Host "Verificando: $file" -ForegroundColor White
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "OK - Arquivo encontrado" -ForegroundColor Green
            
            # Verificar cabecalhos de cache
            $cacheControl = $response.Headers['Cache-Control']
            if ($cacheControl) {
                Write-Host "Cache-Control: $cacheControl" -ForegroundColor Gray
            }
        }
    }
    catch {
        Write-Host "ERRO - Arquivo nao encontrado ou inacessivel" -ForegroundColor Red
        Write-Host "Detalhes: $($_.Exception.Message)" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "VERIFICACAO DE CONTEUDO..." -ForegroundColor Green
Write-Host ""

# Verificar se as correcoes estao no codigo
Write-Host "Verificando correcoes especificas..." -ForegroundColor Yellow

try {
    # Verificar modal-especies-pct.js
    $especiesUrl = "$siteUrl/modules/romaneiopct/modal-especies-pct.js"
    $especiesContent = Invoke-WebRequest -Uri $especiesUrl -TimeoutSec 15
    
    if ($especiesContent.Content -match "VERSAO: 2\.1") {
        Write-Host "modal-especies-pct.js - VERSAO 2.1 encontrada" -ForegroundColor Green
    } else {
        Write-Host "modal-especies-pct.js - Versao 2.1 NAO encontrada" -ForegroundColor Yellow
    }
    
    if ($especiesContent.Content -match "setTimeout.*prompt") {
        Write-Host "modal-especies-pct.js - Correcao setTimeout encontrada" -ForegroundColor Green
    } else {
        Write-Host "modal-especies-pct.js - Correcao setTimeout NAO encontrada" -ForegroundColor Red
    }
}
catch {
    Write-Host "Erro ao verificar modal-especies-pct.js: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    # Verificar romaneiopct.html
    $htmlUrl = "$siteUrl/romaneiopct.html"
    $htmlContent = Invoke-WebRequest -Uri $htmlUrl -TimeoutSec 15
    
    if ($htmlContent.Content -match "criarNovaEspecie") {
        Write-Host "romaneiopct.html - Funcao criarNovaEspecie encontrada" -ForegroundColor Green
    } else {
        Write-Host "romaneiopct.html - Funcao criarNovaEspecie NAO encontrada" -ForegroundColor Red
    }
    
    if ($htmlContent.Content -match "NOVA ESPECIE") {
        Write-Host "romaneiopct.html - Interface nova especie encontrada" -ForegroundColor Green
    } else {
        Write-Host "romaneiopct.html - Interface nova especie NAO encontrada" -ForegroundColor Red
    }
}
catch {
    Write-Host "Erro ao verificar romaneiopct.html: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "RESUMO DA VERIFICACAO" -ForegroundColor Green
Write-Host ""
Write-Host "URL do site: $siteUrl" -ForegroundColor White
Write-Host "Verificacao realizada em: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Gray
Write-Host ""
Write-Host "INSTRUCOES FINAIS:" -ForegroundColor Yellow
Write-Host "1. Acesse: $siteUrl/romaneiopct.html" -ForegroundColor White
Write-Host "2. Pressione Ctrl+Shift+R para limpar cache do navegador" -ForegroundColor White
Write-Host "3. Teste clicando no icone da folha ao lado do campo especie" -ForegroundColor White
Write-Host "4. Deve aparecer prompt: NOVA ESPECIE" -ForegroundColor White
Write-Host ""
Write-Host "Se ainda nao funcionar:" -ForegroundColor Red
Write-Host "- Aguarde mais 5-10 minutos (propagacao CDN)" -ForegroundColor White
Write-Host "- Tente em uma aba anonima/privada" -ForegroundColor White
Write-Host "- Execute novamente: .\deploy-forcado.ps1" -ForegroundColor White