// Script para Importação de Romaneio via Excel (XLS/XLSX)
// Autor: Assistente
// Data: 2026-02-22

// Função para acionar o input de arquivo
function importarRomaneio() {
    console.log("🚀 Iniciando processo de importação...");
    
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
        // Remover listener antigo se existir para evitar duplicação (embora DOMContentLoaded rode uma vez)
        fileInput.removeEventListener('change', handleFileSelect);
        fileInput.addEventListener('change', handleFileSelect, false);
        console.log("✅ Listener de importação configurado.");
    }
});

// Função para manipular a seleção do arquivo
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log(`📂 Arquivo selecionado: ${file.name}`);

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            
            // Verificar se a biblioteca XLSX está carregada
            if (typeof XLSX === 'undefined') {
                throw new Error("Biblioteca SheetJS (XLSX) não carregada.");
            }

            const workbook = XLSX.read(data, {type: 'array'});
            
            // Assumir a primeira planilha
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Converter para JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📊 ${jsonData.length} linhas encontradas na planilha.`);
            
            processarDadosImportados(jsonData);
            
        } catch (error) {
            console.error("❌ Erro ao ler arquivo:", error);
            if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast("Erro ao ler o arquivo Excel: " + error.message, "error");
            } else {
                alert("Erro ao ler o arquivo Excel: " + error.message);
            }
        }
        
        // Limpar o input para permitir selecionar o mesmo arquivo novamente se necessário
        event.target.value = '';
    };
    
    reader.onerror = function(ex) {
        console.error("❌ Erro na leitura do arquivo", ex);
        alert("Erro na leitura do arquivo.");
    };

    reader.readAsArrayBuffer(file);
}

// Função para processar os dados JSON e adicionar ao romaneio
function processarDadosImportados(data) {
    if (!data || data.length === 0) {
        alert("Planilha vazia ou formato inválido.");
        return;
    }

    console.log("📊 Iniciando processamento de", data.length, "linhas.");

    let itensAdicionados = 0;
    let erros = 0;
    
    // Helper para normalizar chaves
    const normalizeKey = (key) => {
        if (!key) return "";
        return String(key).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    // Helper para Title Case
    const toTitleCase = (str) => {
        if (!str) return "";
        return String(str).toLowerCase().replace(/(?:^|[\s-])[\w\u00C0-\u00FF]/g, (match) => {
            return match.toUpperCase();
        });
    };

    // 1. Identificar as colunas corretas (Mapeamento de Cabeçalhos)
    // Varre todas as chaves de todas as linhas para garantir que pegamos as colunas certas
    const allKeys = new Set();
    data.forEach(row => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(k => allKeys.add(k));
        }
    });

    console.log("🔑 Colunas encontradas na planilha:", Array.from(allKeys));

    // Função para encontrar a melhor coluna correspondente
    const findBestColumn = (candidates, exclusions = []) => {
        const keys = Array.from(allKeys);
        
        // 1. Tentativa Exata (normalizada)
        for (const candidate of candidates) {
            const exact = keys.find(k => normalizeKey(k) === normalizeKey(candidate));
            if (exact) return exact;
        }

        // 2. Tentativa Parcial (contém a palavra)
        for (const candidate of candidates) {
            const partial = keys.find(k => {
                const normK = normalizeKey(k);
                const normC = normalizeKey(candidate);
                if (!normK.includes(normC)) return false;
                
                // Verificar exclusões
                for (const exc of exclusions) {
                    if (normK.includes(normalizeKey(exc))) return false;
                }
                return true;
            });
            if (partial) return partial;
        }
        return null;
    };

    // Mapear colunas
    const colEspecie = findBestColumn(['especie', 'espécie', 'descricao', 'descrição'], ['total', 'valor', 'tipo', 'grupo', 'categoria', 'classe', 'cod', 'id']);
    const colPlaqueta = findBestColumn(['plaqueta', 'placa', 'etiqueta']);
    const colRodo = findBestColumn(['rodo', 'diametro', 'diâmetro']);
    const colComprimento = findBestColumn(['comprimento', 'comp', 'metro']);
    const colOco1 = findBestColumn(['oco 1', 'oco1']);
    const colOco2 = findBestColumn(['oco 2', 'oco2']);
    const colPreco = findBestColumn(['preco', 'preço', 'valor unitario', 'valor unitário', 'valor']);

    console.log("🗺️ Mapeamento de Colunas Definido:", {
        especie: colEspecie,
        plaqueta: colPlaqueta,
        rodo: colRodo,
        comprimento: colComprimento,
        oco1: colOco1,
        oco2: colOco2,
        preco: colPreco
    });

    if (!colEspecie) {
        alert("Não foi possível identificar a coluna de 'Espécie' na planilha. Verifique os cabeçalhos.");
        return;
    }

    // Garantir que a lista de itens existe
    if (!window.romaneioItems) {
        window.romaneioItems = [];
    }

    // Iterar sobre as linhas
    data.forEach((row, index) => {
        // Ignorar linhas vazias ou de totais (que geralmente não têm plaqueta ou comprimento)
        if (!row[colEspecie] && !row[colRodo]) return;

        // Extrair valores usando as colunas mapeadas
        const especieRaw = row[colEspecie];
        const plaqueta = row[colPlaqueta] || '';
        const rodo = parseNum(row[colRodo]);
        const comprimento = parseNum(row[colComprimento]);
        const oco1 = parseNum(row[colOco1]);
        const oco2 = parseNum(row[colOco2]);
        const preco = parseNum(row[colPreco]);

        // Validação básica
        if (!especieRaw || rodo <= 0 || comprimento <= 0) {
            // Log apenas para as primeiras linhas para não poluir
            if (index < 5) console.warn(`⚠️ Linha ${index + 1} ignorada: Dados incompletos. Espécie: '${especieRaw}', Rodo: ${rodo}, Comp: ${comprimento}`);
            erros++;
            return;
        }

        // Processar Espécie e Formatar
        let especieFinal = String(especieRaw).trim();
        let especieId = null;
        let especieEncontrada = false;

        // Tentar encontrar no sistema
        if (window.species && Array.isArray(window.species)) {
            const especieSistema = window.species.find(s => 
                s.nome.toLowerCase() === especieFinal.toLowerCase()
            );
            
            if (especieSistema) {
                especieFinal = especieSistema.nome;
                especieId = especieSistema.id;
                especieEncontrada = true;
            }
        }

        // Se não encontrou, aplica Title Case
        if (!especieEncontrada) {
            especieFinal = toTitleCase(especieFinal);
        }

        // Cálculos
        let volumeBruto = 0;
        let descontoOco = 0;

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

        // Criar Objeto
        const novoItem = {
            id: Date.now() + Math.random() + index,
            especie: especieFinal,
            especieId: especieId,
            plaqueta: String(plaqueta || ''),
            comprimento: comprimento,
            diametro: rodo,
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
            observacoes: 'Importado via Excel',
            origem: 'importacao'
        };

        // Debug detalhado para as primeiras e últimas linhas
        if (index < 3 || index > data.length - 3) {
            console.log(`📝 Linha ${index+1}: Espécie Original='${especieRaw}' -> Final='${especieFinal}'`);
        }

        window.romaneioItems.push(novoItem);
        itensAdicionados++;
    });

    // Finalização
    if (itensAdicionados > 0) {
        console.log(`✅ ${itensAdicionados} itens adicionados com sucesso.`);
        
        // Atualizar UI
        if (typeof window.updateTableBody === 'function') {
            window.updateTableBody();
        } else if (typeof window.reconstruirTabela === 'function') {
            window.reconstruirTabela();
        } else if (typeof window.populateRomaneioTable === 'function') {
            window.populateRomaneioTable();
        }

        if (typeof window.atualizarTotaisRomaneio === 'function') {
            window.atualizarTotaisRomaneio();
        }
        
        // Notificar usuário
        const msg = `${itensAdicionados} itens importados com sucesso!${erros > 0 ? ` (${erros} linhas ignoradas)` : ''}`;
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(msg, "success");
        } else {
            alert(msg);
        }
        
        // Ir para a última página para ver os novos itens
        if (window.romaneioItems.length > (window.itemsPerPage || 5)) {
            const totalPages = Math.ceil(window.romaneioItems.length / (window.itemsPerPage || 5));
            if (typeof window.changePage === 'function') {
                window.changePage(totalPages);
            }
        }
        
    } else {
        const msg = "Nenhum item válido encontrado para importação. Verifique as colunas da planilha.";
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(msg, "error");
        } else {
            alert(msg);
        }
    }
}

// Helper para fazer parse de números (suporta formatos BR e US)
function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    
    if (typeof val === 'number') return val;
    
    if (typeof val === 'string') {
        const cleanVal = val.trim();
        
        // Tentar detectar formato brasileiro: 1.234,56
        // Se tiver vírgula e ponto, e a vírgula estiver depois do ponto
        if (cleanVal.includes(',') && cleanVal.includes('.') && cleanVal.lastIndexOf(',') > cleanVal.lastIndexOf('.')) {
            // Formato BR com milhares: remover ponto, trocar vírgula por ponto
            return parseFloat(cleanVal.replace(/\./g, '').replace(',', '.')) || 0;
        }
        
        // Se tiver apenas vírgula (comum no Brasil: 1234,56)
        if (cleanVal.includes(',') && !cleanVal.includes('.')) {
            return parseFloat(cleanVal.replace(',', '.')) || 0;
        }
        
        // Formato padrão ou US (1,234.56 ou 1234.56)
        // Se tiver vírgula antes do ponto, é separador de milhar US, remove vírgula
        return parseFloat(cleanVal.replace(/,/g, '')) || 0;
    }
    
    return 0;
}
