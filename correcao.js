/**
 * Script de correção para os erros identificados
 * - Corrige erro getEventListeners em romaneiotl.js
 * - Remove a declaração de importação em auth.js
 */

(function() {
    // Função para ler e corrigir um arquivo
    function corrigirArquivo(caminho, busca, substituicao) {
        console.log(`Corrigindo arquivo: ${caminho}`);
        
        try {
            // Ler o conteúdo do arquivo
            const fs = require('fs');
            let conteudo = fs.readFileSync(caminho, 'utf-8');
            
            // Verificar se o texto a ser substituído existe
            if (!conteudo.includes(busca)) {
                console.log(`Texto para substituição não encontrado em ${caminho}`);
                return false;
            }
            
            // Substituir o texto
            const novoConteudo = conteudo.replace(busca, substituicao);
            
            // Gravar o arquivo corrigido
            fs.writeFileSync(caminho, novoConteudo, 'utf-8');
            
            console.log(`✅ Arquivo ${caminho} corrigido com sucesso!`);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao corrigir ${caminho}:`, error);
            return false;
        }
    }
    
    // Corrigir romaneiotl.js - remover getEventListeners
    const romaneioPath = './romaneiotl.js';
    const buscaGetEventListeners = `const eventos = getEventListeners ? getEventListeners(novoBtn) : { click: "Função getEventListeners não disponível neste ambiente" };
            console.log("Eventos atualmente associados ao botão:", eventos);`;
    const substituicaoGetEventListeners = `// Verificar se a função alvo está disponível
            if (typeof abrirListaRomaneios === 'function') {
                console.log("✅ Função abrirListaRomaneios está disponível e será chamada pelo evento de clique");
            } else {
                console.warn("⚠️ Função abrirListaRomaneios NÃO ENCONTRADA. O evento de clique pode não funcionar corretamente.");
            }`;
    
    // Corrigir auth.js - remover import statement
    const authPath = './auth.js';
    const buscaImport = `// Importar Firebase Services
import { authService, dbService } from './firebaseService.js';`;
    const substituicaoImport = `// Referência aos serviços do Firebase`;
    
    // Executar as correções
    const resultadoRomaneio = corrigirArquivo(romaneioPath, buscaGetEventListeners, substituicaoGetEventListeners);
    const resultadoAuth = corrigirArquivo(authPath, buscaImport, substituicaoImport);
    
    // Mostrar resultado final
    console.log("\n=== RESULTADO DAS CORREÇÕES ===");
    console.log(`romaneiotl.js: ${resultadoRomaneio ? '✅ Corrigido' : '❌ Não corrigido'}`);
    console.log(`auth.js: ${resultadoAuth ? '✅ Corrigido' : '❌ Não corrigido'}`);
    console.log("===============================\n");
    
    console.log("Para aplicar manualmente as correções:");
    console.log("\n1. Em romaneiotl.js (cerca da linha 3557), substitua:");
    console.log(buscaGetEventListeners);
    console.log("\nPor:");
    console.log(substituicaoGetEventListeners);
    
    console.log("\n2. Em auth.js (no início do arquivo), remova ou comente a linha:");
    console.log(buscaImport);
})(); 
