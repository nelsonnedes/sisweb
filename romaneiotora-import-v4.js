// Script para Importação de Romaneio via Excel (XLS/XLSX) - ESTRATÉGIA MATRIZ (V4)
// Autor: Assistente
// Data: 2026-02-22
// Versão: 4.0 (Matrix Parsing Strategy)

console.log("🚀 Módulo de Importação v4 (Matrix Strategy) carregado!");

// Função para acionar o input de arquivo
function importarRomaneio() {
    console.log("🚀 Iniciando processo de importação v4...");
    
    // 1. Verificar se o fornecedor foi selecionado
    const fornecedorInput = document.getElementById('fornecedorInput');
    // Verificar tanto o input de texto quanto a variável global
    const temFornecedor = (fornecedorInput && fornecedorInput.value.trim()) || 
                          (window.selectedClient && window.selectedClient.id);
                          
    if (!temFornecedor) {
        const msg = "Por favor, selecione um fornecedor antes de importar.";
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(msg, "warning");
        } else {
            alert(msg);
        }
        // Focar no campo de fornecedor
        if (fornecedorInput) fornecedorInput.focus();
        return;
    }

    // 2. Acionar o input de arquivo oculto
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
        fileInput.value = ''; // Limpar seleção anterior
        fileInput.click();
    } else {
        console.error("❌ Input de arquivo 'importFileInput' não encontrado.");
        alert("Erro interno: Input de arquivo não encontrado.");
    }
}

// Configurar listener para o input de arquivo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
        // Remover listener antigo se existir
        fileInput.removeEventListener('change', handleFileSelectV4);
        fileInput.addEventListener('change', handleFileSelectV4, false);
        console.log("✅ Listener de importação v4 configurado.");
    }
});

// Função para manipulador de arquivo (V4)
function handleFileSelectV4(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log(`📂 Arquivo selecionado: ${file.name}`);

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            
            if (typeof XLSX === 'undefined') {
                throw new Error("Biblioteca SheetJS (XLSX) não carregada.");
            }

            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // ESTRATÉGIA V4: Ler como Matriz (Array of Arrays)
            // Isso evita qualquer ambiguidade de chaves de objeto
            const aoa = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            
            console.log(`📊 Matriz carregada com ${aoa.length} linhas.`);
            
            processarMatrizImportada(aoa);
            
        } catch (error) {
            console.error("❌ Erro ao ler arquivo:", error);
            const msg = "Erro ao ler o arquivo Excel: " + error.message;
            if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, "error");
            else alert(msg);
        }
        
        event.target.value = '';
    };
    
    reader.onerror = function(ex) {
        console.error("❌ Erro na leitura do arquivo", ex);
        alert("Erro na leitura do arquivo.");
    };

    reader.readAsArrayBuffer(file);
}

// Processador de Matriz (V4)
function processarMatrizImportada(matrix) {
    if (!matrix || matrix.length === 0) {
        alert("Planilha vazia.");
        return;
    }

    // Helper para normalizar texto para comparação
    const normalize = (txt) => {
        if (!txt) return "";
        return String(txt).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    // Helper para Title Case
    const toTitleCase = (str) => {
        if (!str) return "";
        return String(str).toLowerCase().replace(/(?:^|[\s-])[\w\u00C0-\u00FF]/g, (match) => {
            return match.toUpperCase();
        });
    };

    // 1. Encontrar a linha de cabeçalho
    // Procuramos por uma linha que contenha "Espécie" e "Rodo" (ou variações)
    let headerRowIndex = -1;
    let colIndices = {
        especie: -1,
        plaqueta: -1,
        custodia: -1,
        rodo: -1,
        comprimento: -1,
        oco1: -1,
        oco2: -1,
        preco: -1,
        compGeo: -1,
        x1: -1,
        x2: -1,
        x3: -1,
        x4: -1,
        volumeGeo: -1
    };

    // Escanear as primeiras 20 linhas procurando cabeçalhos
    for (let i = 0; i < Math.min(20, matrix.length); i++) {
        const row = matrix[i];
        if (!Array.isArray(row)) continue;

        // Verificar cada célula da linha
        row.forEach((cell, colIndex) => {
            const val = normalize(cell);
            
            if (val.includes('especie') || val.includes('descricao')) colIndices.especie = colIndex;
            else if (val.includes('plaqueta') || val.includes('placa') || val.includes('etiqueta')) colIndices.plaqueta = colIndex;
            else if (val.includes('custodia') || val.includes('custody')) colIndices.custodia = colIndex;
            else if ((val.includes('comp') && val.includes('geo')) || val.includes('comprimento geometrico')) colIndices.compGeo = colIndex;
            else if (val === 'x1' || val.includes('x1')) colIndices.x1 = colIndex;
            else if (val === 'x2' || val.includes('x2')) colIndices.x2 = colIndex;
            else if (val === 'x3' || val.includes('x3')) colIndices.x3 = colIndex;
            else if (val === 'x4' || val.includes('x4')) colIndices.x4 = colIndex;
            else if ((val.includes('v') && val.includes('geo')) || val.includes('volume geometrico')) colIndices.volumeGeo = colIndex;
            else if (val.includes('rodo') || val.includes('diametro')) colIndices.rodo = colIndex;
            else if ((val.includes('comprimento') || val.includes('comp') || val.includes('metro')) && !val.includes('geo')) colIndices.comprimento = colIndex;
            else if (val.includes('oco 1') || val.includes('oco1')) colIndices.oco1 = colIndex;
            else if (val.includes('oco 2') || val.includes('oco2')) colIndices.oco2 = colIndex;
            else if (val.includes('preco') || val.includes('valor unitario')) colIndices.preco = colIndex;
        });

        // Se encontrarmos pelo menos Espécie e Rodo, assumimos que esta é a linha de cabeçalho
        if (colIndices.especie !== -1 && colIndices.rodo !== -1) {
            headerRowIndex = i;
            break;
        }
        
        // Resetar para próxima tentativa se não encontrou o suficiente
        colIndices = { especie: -1, plaqueta: -1, custodia: -1, rodo: -1, comprimento: -1, oco1: -1, oco2: -1, preco: -1, compGeo: -1, x1: -1, x2: -1, x3: -1, x4: -1, volumeGeo: -1 };
    }

    if (headerRowIndex === -1) {
        alert("Não foi possível encontrar a linha de cabeçalho (Espécie, Rodo, Comprimento). Verifique a planilha.");
        return;
    }

    console.log(`� Cabeçalho encontrado na linha ${headerRowIndex}. Índices:`, colIndices);

    let itensAdicionados = 0;
    let erros = 0;

    // Garantir array global
    if (!window.romaneioItems) window.romaneioItems = [];

    // Iterar DADOS (começando após o cabeçalho)
    for (let i = headerRowIndex + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!Array.isArray(row) || row.length === 0) continue;

        // Extração Direta por Índice (Sem ambiguidade de chaves)
        const especieRaw = colIndices.especie !== -1 ? row[colIndices.especie] : null;
        
        // ✅ FILTRO DE LINHAS DE TOTAL/RESUMO
        // Ignorar linhas que parecem ser rodapés ou totais do Excel
        if (especieRaw) {
            const especieLower = String(especieRaw).toLowerCase().trim();
            // Ignorar linhas que começam com termos de totalização ou contagem
            if (especieLower.startsWith('total') || 
                especieLower.startsWith('resumo') || 
                especieLower.includes('total de linhas') ||
                especieLower.includes('quantidade de') ||
                especieLower === 'qtd' ||
                especieLower.startsWith('subtotal')) {
                console.log(`🚫 Ignorando linha de total/resumo na importação: "${especieRaw}"`);
                continue;
            }
        }
        
        // Pular linha se não tiver espécie nem rodo (linha vazia ou total)
        if (!especieRaw && (colIndices.rodo === -1 || !row[colIndices.rodo])) continue;

        const plaqueta = colIndices.plaqueta !== -1 ? row[colIndices.plaqueta] : '';
        const custodia = colIndices.custodia !== -1 ? row[colIndices.custodia] : '';
        const rodo = colIndices.rodo !== -1 ? parseNumV4(row[colIndices.rodo]) : 0;
        const comprimento = colIndices.comprimento !== -1 ? parseNumV4(row[colIndices.comprimento]) : 0;
        const oco1 = colIndices.oco1 !== -1 ? parseNumV4(row[colIndices.oco1]) : 0;
        const oco2 = colIndices.oco2 !== -1 ? parseNumV4(row[colIndices.oco2]) : 0;
        const preco = colIndices.preco !== -1 ? parseNumV4(row[colIndices.preco]) : 0;
        const geo = window.ToraGeometry && typeof window.ToraGeometry.normalizarCamposGeoItem === 'function'
            ? window.ToraGeometry.normalizarCamposGeoItem({
                custodia,
                compGeo: colIndices.compGeo !== -1 ? row[colIndices.compGeo] : 0,
                x1: colIndices.x1 !== -1 ? row[colIndices.x1] : 0,
                x2: colIndices.x2 !== -1 ? row[colIndices.x2] : 0,
                x3: colIndices.x3 !== -1 ? row[colIndices.x3] : 0,
                x4: colIndices.x4 !== -1 ? row[colIndices.x4] : 0,
                volumeGeo: colIndices.volumeGeo !== -1 ? row[colIndices.volumeGeo] : 0
            })
            : {
                custodia: String(custodia || '').trim(),
                compGeo: colIndices.compGeo !== -1 ? parseNumV4(row[colIndices.compGeo]) : 0,
                x1: colIndices.x1 !== -1 ? parseNumV4(row[colIndices.x1]) : 0,
                x2: colIndices.x2 !== -1 ? parseNumV4(row[colIndices.x2]) : 0,
                x3: colIndices.x3 !== -1 ? parseNumV4(row[colIndices.x3]) : 0,
                x4: colIndices.x4 !== -1 ? parseNumV4(row[colIndices.x4]) : 0,
                volumeGeo: colIndices.volumeGeo !== -1 ? parseNumV4(row[colIndices.volumeGeo]) : 0
            };

        // Validação Mínima
        if (!especieRaw || rodo <= 0) {
            erros++;
            continue;
        }

        // Processamento da Espécie
        let especieFinal = String(especieRaw).trim();
        let especieId = null;
        let especieEncontrada = false;

        // ✅ CORREÇÃO: Evitar atribuição incorreta de "Outros"
        // Se a espécie vier como "Outros" do Excel, tentar manter o original ou pedir atenção
        if (especieFinal.toLowerCase() === 'outros') {
            console.warn(`⚠️ Item linha ${i}: Espécie identificada como 'Outros' na origem.`);
        }

        // Buscar no sistema
        if (window.species && Array.isArray(window.species)) {
            // Tentar match exato primeiro
            let match = window.species.find(s => s.nome.toLowerCase() === especieFinal.toLowerCase());
            
            // ✅ CORREÇÃO: Se não encontrar exato, NÃO fazer fallback para "Outros" se existir na lista
            // Apenas usar match se for realmente correspondente
            
            if (match) {
                especieFinal = match.nome;
                especieId = match.id;
                especieEncontrada = true;
            }
        }

        // Title Case se não encontrada
        if (!especieEncontrada) {
            especieFinal = toTitleCase(especieFinal);
            
            // ✅ CORREÇÃO FINAL: Se por algum motivo virou "Outros" e não era, reverter ou alertar
            if (especieFinal === 'Outros' && String(especieRaw).toLowerCase() !== 'outros') {
                console.warn(`⚠️ Correção: Espécie '${especieRaw}' foi convertida para 'Outros'. Revertendo para original.`);
                especieFinal = toTitleCase(String(especieRaw));
            }
        }

        // Cálculos de Volume
        let volumeBruto = 0;
        let descontoOco = 0;

        // Tentar usar função global ou fallback local
        if (typeof window.calcularVolumeTora === 'function') {
            volumeBruto = window.calcularVolumeTora(rodo, comprimento);
        } else {
            const raio = rodo / 2 / 100;
            volumeBruto = Math.PI * raio * raio * (comprimento / 100);
        }

        if (typeof window.calcularDescontoOco === 'function') {
            descontoOco = window.calcularDescontoOco(oco1, oco2, comprimento);
        } else {
            descontoOco = (oco1 / 100) * (oco2 / 100) * (comprimento / 100);
        }

        const volumeSerraria = Math.max(0, volumeBruto - descontoOco);
        const valorTotal = volumeSerraria * preco;

        // Objeto do Item
        const novoItem = {
            id: Date.now() + Math.random() + i, // ID único
            especie: especieFinal,
            especieId: especieId,
            plaqueta: String(plaqueta || ''),
            ...geo,
            comprimento: comprimento,
            diametro: rodo, // manter compatibilidade
            rodo: rodo,
            oco1: oco1,
            oco2: oco2,
            volumeBruto: volumeBruto,
            volumeEstimado: volumeBruto,
            volumeSerraria: volumeSerraria,
            volumeLiquido: volumeSerraria,
            preco: preco,
            precoUnitario: preco,
            valorTotal: valorTotal,
            valor: valorTotal,
            observacoes: 'Importado via Excel (v4)',
            origem: 'importacao'
        };

        window.romaneioItems.push(novoItem);
        itensAdicionados++;
    }

    // Finalização
    if (itensAdicionados > 0) {
        console.log(`✅ ${itensAdicionados} itens importados.`);
        
        // Atualizar Tabela
        if (typeof window.updateTableBody === 'function') window.updateTableBody();
        else if (typeof window.reconstruirTabela === 'function') window.reconstruirTabela();
        else if (typeof window.populateRomaneioTable === 'function') window.populateRomaneioTable();

        if (typeof window.atualizarTotaisRomaneio === 'function') window.atualizarTotaisRomaneio();
        
        const msg = `${itensAdicionados} itens importados com sucesso!`;
        if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, "success");
        else alert(msg);
        
        // Ir para última página
        if (window.romaneioItems.length > 0 && typeof window.changePage === 'function') {
             // Forçar ir para última página se houver paginação
             const lastPage = Math.ceil(window.romaneioItems.length / (window.itemsPerPage || 5));
             window.changePage(lastPage);
        }

    } else {
        const msg = "Nenhum item válido encontrado.";
        if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, "warning");
        else alert(msg);
    }
}

// Parser Numérico Robusto (V4)
function parseNumV4(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let cleanVal = val.trim();
        // Detecção de formato brasileiro (1.000,00) vs americano (1,000.00)
        if (cleanVal.includes(',') && cleanVal.includes('.')) {
             // Se o último separador for vírgula (1.234,56), remove pontos e troca vírgula por ponto
             if (cleanVal.lastIndexOf(',') > cleanVal.lastIndexOf('.')) {
                 cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
             } else {
                 // Formato americano (1,234.56), apenas remove vírgulas
                 cleanVal = cleanVal.replace(/,/g, '');
             }
        } else if (cleanVal.includes(',')) {
            // Apenas vírgula (123,45) -> troca por ponto
            cleanVal = cleanVal.replace(',', '.');
        }
        return parseFloat(cleanVal) || 0;
    }
    return 0;
}
