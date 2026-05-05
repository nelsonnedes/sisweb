const fs = require('fs');
const path = require('path');

function patchFile(filePath) {
    console.log(`\n🔍 Analisando arquivo: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Regex para .loadFromFirebase('contasReceber') ou .loadFromFirebase(`contasReceber/${...}`)
    const loadReceberRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)contasReceber/g;
    if (loadReceberRegex.test(content)) {
        content = content.replace(loadReceberRegex, '$1financas/receber');
        modified = true;
        console.log("✅ Atualizado loadFromFirebase/getData('contasReceber') -> 'financas/receber'");
    }

    const loadPagarRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)contasPagar/g;
    if (loadPagarRegex.test(content)) {
        content = content.replace(loadPagarRegex, '$1financas/pagar');
        modified = true;
        console.log("✅ Atualizado loadFromFirebase/getData('contasPagar') -> 'financas/pagar'");
    }

    // 2. Regex para saveToFirebase('contasReceber', ...)
    const saveReceberRegex = /(\.(saveToFirebase|saveData)\s*\(\s*[`'"]\s*)contasReceber/g;
    if (saveReceberRegex.test(content)) {
        content = content.replace(saveReceberRegex, '$1financas/receber');
        modified = true;
        console.log("✅ Atualizado saveToFirebase/saveData('contasReceber') -> 'financas/receber'");
    }

    const savePagarRegex = /(\.(saveToFirebase|saveData)\s*\(\s*[`'"]\s*)contasPagar/g;
    if (savePagarRegex.test(content)) {
        content = content.replace(savePagarRegex, '$1financas/pagar');
        modified = true;
        console.log("✅ Atualizado saveToFirebase/saveData('contasPagar') -> 'financas/pagar'");
    }

    // 3. Regex para actual updatePaths updates[`contasReceber/${mk}/...`]
    const updateReceberRegex = /(updates\s*\[\s*[`'"]\s*)contasReceber/g;
    if (updateReceberRegex.test(content)) {
        content = content.replace(updateReceberRegex, '$1financas/receber');
        modified = true;
        console.log("✅ Atualizado updates['contasReceber/...'] -> 'financas/receber'");
    }

    const updatePagarRegex = /(updates\s*\[\s*[`'"]\s*)contasPagar/g;
    if (updatePagarRegex.test(content)) {
        content = content.replace(updatePagarRegex, '$1financas/pagar');
        modified = true;
        console.log("✅ Atualizado updates['contasPagar/...'] -> 'financas/pagar'");
    }

    // 4. Regex para check de 'romaneios_tl' -> 'romaneios/tl' se houver load do Firebase
    const loadTlRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)romaneios_tl/g;
    if (loadTlRegex.test(content)) {
        content = content.replace(loadTlRegex, '$1romaneios/tl');
        modified = true;
        console.log("✅ Atualizado 'romaneios_tl' -> 'romaneios/tl'");
    }
    
    // --- NOVO: ROTAS DE VENDAS ---
    const loadPedidosRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)pedidosVenda/g;
    if (loadPedidosRegex.test(content)) {
        content = content.replace(loadPedidosRegex, '$1vendas/pedidos');
        modified = true;
        console.log("✅ Atualizado 'pedidosVenda' -> 'vendas/pedidos'");
    }

    const loadCarregoRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)carregoPagamentos/g;
    if (loadCarregoRegex.test(content)) {
        content = content.replace(loadCarregoRegex, '$1vendas/pagamentos_carrego');
        modified = true;
        console.log("✅ Atualizado 'carregoPagamentos' -> 'vendas/pagamentos_carrego'");
    }

    const savePedidosRegex = /(\b(saveToFirebase|saveData)\s*\(\s*[`'"]\s*)pedidosVenda/g;
    if (savePedidosRegex.test(content)) {
        content = content.replace(savePedidosRegex, '$1vendas/pedidos');
        modified = true;
        console.log("✅ Atualizado saveData/saveToFirebase('pedidosVenda') -> 'vendas/pedidos'");
    }

    const saveCarregoRegex = /(\b(saveToFirebase|saveData)\s*\(\s*[`'"]\s*)carregoPagamentos/g;
    if (saveCarregoRegex.test(content)) {
        content = content.replace(saveCarregoRegex, '$1vendas/pagamentos_carrego');
        modified = true;
        console.log("✅ Atualizado saveData/saveToFirebase('carregoPagamentos') -> 'vendas/pagamentos_carrego'");
    }
    
    // --- NOVO: ROTAS DE ROMANEIOS PES ---
    const loadPesRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)romaneiosPes/g;
    if (loadPesRegex.test(content)) {
        content = content.replace(loadPesRegex, '$1romaneios/pes');
        modified = true;
        console.log("✅ Atualizado 'romaneiosPes' -> 'romaneios/pes'");
    }

    const savePesRegex = /(\b(saveToFirebase|saveData)\s*\(\s*[`'"]\s*)romaneiosPes/g;
    if (savePesRegex.test(content)) {
        content = content.replace(savePesRegex, '$1romaneios/pes');
        modified = true;
        console.log("✅ Atualizado saveData/saveToFirebase('romaneiosPes') -> 'romaneios/pes'");
    }

    const loadPctRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)romaneiosPct/g;
    if (loadPctRegex.test(content)) {
        content = content.replace(loadPctRegex, '$1romaneios/pct');
        modified = true;
        console.log("✅ Atualizado 'romaneiosPct' -> 'romaneios/pct'");
    }
    
    const loadToraRegex = /(\b(loadFromFirebase|getData)\s*\(\s*[`'"]\s*)romaneiosTora/g;
    if (loadToraRegex.test(content)) {
        content = content.replace(loadToraRegex, '$1romaneios/tora');
        modified = true;
        console.log("✅ Atualizado 'romaneiosTora' -> 'romaneios/tora'");
    }

    // --- NOVO: SUBSTITUIÇÕES GENÉRICAS DE DIRETÓRIOS EM STRINGS ---
    const updatesPedidosRegex = /(updates\w*\[\s*[`'"]\s*)pedidosVenda/g;
    if (updatesPedidosRegex.test(content)) {
        content = content.replace(updatesPedidosRegex, '$1vendas/pedidos');
        modified = true;
        console.log("✅ Atualizado updates['pedidosVenda/...'] -> 'vendas/pedidos'");
    }

    const updatesCarregoRegex = /(updates\w*\[\s*[`'"]\s*)carregoPagamentos/g;
    if (updatesCarregoRegex.test(content)) {
        content = content.replace(updatesCarregoRegex, '$1vendas/pagamentos_carrego');
        modified = true;
        console.log("✅ Atualizado updates['carregoPagamentos/...'] -> 'vendas/pagamentos_carrego'");
    }

    const subscribePedidosRegex = /(\.subscribe\s*\(\s*[`'"]\s*)pedidosVenda/g;
    if (subscribePedidosRegex.test(content)) {
        content = content.replace(subscribePedidosRegex, '$1vendas/pedidos');
        modified = true;
        console.log("✅ Atualizado .subscribe('pedidosVenda') -> 'vendas/pedidos'");
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`💾 Arquivo salvo: ${filePath}`);
    } else {
        console.log("ℹ️ Nenhuma alteração de rota necessária.");
    }
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.html')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const files = getAllFiles('c:/Sisweb');

files.forEach(f => {
    try {
        patchFile(f);
    } catch (e) {
        console.error(`❌ Erro ao processar ${f}:`, e);
    }
});
