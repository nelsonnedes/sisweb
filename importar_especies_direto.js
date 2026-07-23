// Script para importar espécies - Cole este código no console do navegador

// Verificar se o Firebase está disponível e inicializado
async function initFirebase() {
    if (typeof window.firebase !== 'undefined' && window.firebase.apps.length > 0) {
        console.log("Firebase já inicializado, reutilizando...");
        return { firebase: window.firebase, db: window.firebase.database() };
    }
    
    try {
        console.log("Carregando ponte Firebase compartilhada...");
        await import('./firebase-compat-bridge.js');
        if (!window.firebase || typeof window.firebase.database !== 'function') {
            throw new Error('Ponte Firebase indisponível.');
        }
        console.log("Firebase compartilhado disponível");
        return { firebase: window.firebase, db: window.firebase.database() };
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        alert("Erro ao inicializar Firebase. Será usado localStorage como fallback.");
        return null;
    }
}

function resolveTenantId() {
    try {
        const services = [window.firebaseService, window.FirebaseService, window.firebaseServiceTL].filter(Boolean);
        for (const service of services) {
            if (typeof service.getCurrentTenantId === 'function') {
                const id = service.getCurrentTenantId();
                if (id) return String(id);
            }
            if (typeof service.getTenantId === 'function') {
                const id = service.getTenantId();
                if (id) return String(id);
            }
        }
        if (window.appTenantId) return String(window.appTenantId);
        if (window.companyInfo) {
            const id = window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id;
            if (id) return String(id);
        }
        for (const key of ['company_info', 'companyInfo', 'currentUser', 'persistentUser']) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const info = JSON.parse(raw);
            const id = info && (info.companyId || info.companyID || info.tenantId || info.id || info.company_id);
            if (id) return String(id);
        }
    } catch (_) {}
    return '';
}

function getSpeciesPath() {
    const tenantId = resolveTenantId();
    if (!tenantId) {
        throw new Error('Tenant/companyId indisponível. Importação bloqueada para evitar gravação global de espécies.');
    }
    return `companies/${tenantId}/especies`;
}

function getSpeciesStorageKeys() {
    const tenantId = resolveTenantId();
    if (!tenantId) return ['companies/__no_tenant__/especies'];
    return [
        `companies/${tenantId}/especies`,
        `company_${tenantId}__especies`,
        `company_${tenantId}__especies_cache`
    ];
}

// Função para recuperar espécies do Firebase
async function getSpeciesFromFirebase(db) {
    try {
        const speciesPath = getSpeciesPath();
        const snapshot = await db.ref(speciesPath).once('value');
        if (!snapshot.exists()) return [];
        
        const species = [];
        snapshot.forEach(childSnapshot => {
            species.push({
                key: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        console.log(`Recuperadas ${species.length} espécies do Firebase em ${speciesPath}`);
        return species;
    } catch (error) {
        console.error("Erro ao recuperar espécies do Firebase:", error);
        return null;
    }
}

// Função para recuperar espécies do localStorage
function getSpecies() {
    try {
        for (const key of getSpeciesStorageKeys()) {
            const data = localStorage.getItem(key);
            if (!data) continue;
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return Object.keys(parsed).map(id => ({ id, key: id, firebaseKey: id, ...parsed[id] }));
        }
        return [];
    } catch (e) {
        console.error('Erro ao recuperar espécies:', e);
        return [];
    }
}

// Função para salvar espécies no localStorage
function saveSpecies(species) {
    try {
        const payload = JSON.stringify(species);
        getSpeciesStorageKeys().forEach(key => localStorage.setItem(key, payload));
        localStorage.removeItem('species');
        localStorage.removeItem('especies');
        localStorage.removeItem('especiesPct');
        localStorage.removeItem('data/species');
        return true;
    } catch (e) {
        console.error('Erro ao salvar espécies:', e);
        return false;
    }
}

// Função para salvar espécies no Firebase
async function saveSpeciesToFirebase(db, species) {
    try {
        const speciesPath = getSpeciesPath();
        // Para cada espécie
        let successCount = 0;
        
        for (const specie of species) {
            try {
                if (!specie) continue;
                
                // Usar o key se disponível, ou gerar um novo ID
                const itemKey = specie.key || specie.id || `ESP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const payload = toCanonicalSpecies(specie, itemKey);
                
                // Adicionar timestamp se for nova ou atualizada
                if (!payload.createdAt) {
                    payload.createdAt = new Date().toISOString();
                }
                payload.updatedAt = new Date().toISOString();
                
                // Salvar no Firebase
                await db.ref(`${speciesPath}/${itemKey}`).set(payload);
                successCount++;
            } catch (itemError) {
                console.error(`Erro ao salvar espécie no Firebase:`, itemError, specie);
            }
        }
        
        console.log(`✅ ${successCount} espécies salvas no Firebase em ${speciesPath}`);
        return successCount > 0;
    } catch (error) {
        console.error('Erro ao salvar no Firebase:', error);
        return false;
    }
}

// Função para verificar se uma espécie já existe
function speciesExists(species, name) {
    return species.some(s => 
        getSpeciesName(s).toLowerCase() === name.toLowerCase()
    );
}

// Função para encontrar o índice de uma espécie existente
function findSpeciesIndex(species, name) {
    return species.findIndex(s => 
        getSpeciesName(s).toLowerCase() === name.toLowerCase()
    );
}

function getSpeciesName(specie) {
    return String((specie && (specie.especie || specie.nome || specie.name || specie.nomeComum)) || '').trim();
}

function getScientificName(specie) {
    return String((specie && (specie.nomeCientifico || specie.scientificName || specie.scientific || specie.descricao || specie.description || specie.decription)) || '').trim();
}

function toCanonicalSpecies(specie, id) {
    const now = new Date().toISOString();
    return {
        id: id || specie.id || specie.key || `ESP_${Date.now()}`,
        especie: getSpeciesName(specie),
        nomeCientifico: getScientificName(specie),
        ativo: specie.ativo !== false,
        createdAt: specie.createdAt || now,
        updatedAt: specie.updatedAt || now
    };
}

// Função para processar as linhas de texto
function processSpeciesData(text) {
    const lines = text.trim().split('\n');
    const validLines = [];
    const invalidLines = [];
    const processedNames = new Set(); // Para rastrear nomes já processados
    
    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return; // Ignora linhas vazias
        
        const dashIndex = line.indexOf(' - ');
        if (dashIndex === -1) {
            invalidLines.push({ line, index: index + 1, reason: 'Formato inválido (falta o separador " - ")' });
            return;
        }
        
        const nomeCientifico = line.substring(0, dashIndex).trim();
        const name = line.substring(dashIndex + 3).trim();
        
        if (!name) {
            invalidLines.push({ line, index: index + 1, reason: 'Nome da espécie ausente' });
            return;
        }
        
        if (!nomeCientifico) {
            invalidLines.push({ line, index: index + 1, reason: 'Nome científico ausente' });
            return;
        }
        
        // Verifica se este nome já foi processado
        const nameLower = name.toLowerCase();
        if (processedNames.has(nameLower)) {
            invalidLines.push({ line, index: index + 1, reason: 'Espécie duplicada no arquivo' });
            return;
        }
        
        // Adiciona o nome à lista de processados
        processedNames.add(nameLower);
        validLines.push({ name, nomeCientifico, index: index + 1 });
    });
    
    return { validLines, invalidLines };
}

// Função principal para importar espécies
async function importSpecies() {
    // Inicializar Firebase
    const firebaseResult = await initFirebase();
    const useFirebase = firebaseResult !== null;
    const tenantId = resolveTenantId();

    if (!tenantId) {
        alert('Empresa/tenant não identificado. Importação cancelada para evitar gravação global de espécies.');
        console.error('Importação de espécies bloqueada: tenant/companyId indisponível.');
        return;
    }
    
    if (useFirebase) {
        console.log(`Firebase disponível, usando importação tenant-scoped para ${tenantId}`);
    } else {
        console.log("Firebase não disponível, usando localStorage como fallback");
    }
    
    // Solicita que o usuário cole os dados
    const textData = prompt(
        "Cole aqui os dados do Excel (uma espécie por linha).\n" +
        "Formato esperado: 'Nome Científico - Nome Comum'\n" +
        "Exemplo: Aspidosperma album (Vahl) R.Benoist ex Pichon - Araracanga"
    );
    
    if (!textData) {
        console.log('Importação cancelada pelo usuário.');
        return;
    }
    
    // Processa os dados
    const { validLines, invalidLines } = processSpeciesData(textData);
    
    // Obter espécies existentes
    let existingSpecies = [];
    
    if (useFirebase) {
        // Tentar obter do Firebase primeiro
        const firebaseSpecies = await getSpeciesFromFirebase(firebaseResult.db);
        if (firebaseSpecies) {
            existingSpecies = firebaseSpecies;
        } else {
            // Fallback para localStorage
            existingSpecies = getSpecies();
        }
    } else {
        // Usar apenas localStorage
        existingSpecies = getSpecies();
    }
    
    const duplicates = [];
    const newSpecies = [];
    
    // Identificar duplicatas e novas espécies
    validLines.forEach(item => {
        if (speciesExists(existingSpecies, item.name)) {
            duplicates.push(item);
        } else {
            newSpecies.push(item);
        }
    });
    
    // Exibe estatísticas no console
    console.log('=== RELATÓRIO DE IMPORTAÇÃO ===');
    console.log(`Total de linhas processadas: ${validLines.length + invalidLines.length}`);
    console.log(`Espécies válidas: ${validLines.length}`);
    console.log(`Linhas com erro: ${invalidLines.length}`);
    console.log(`Espécies já existentes: ${duplicates.length}`);
    console.log(`Novas espécies a serem importadas: ${newSpecies.length}`);
    
    // Exibe detalhes das espécies inválidas
    if (invalidLines.length > 0) {
        console.log('\n=== LINHAS COM ERRO ===');
        invalidLines.forEach(item => {
            console.log(`Linha ${item.index}: "${item.line}" - ${item.reason}`);
        });
    }
    
    // Exibe detalhes das espécies duplicadas
    if (duplicates.length > 0) {
        console.log('\n=== ESPÉCIES JÁ EXISTENTES (SERÃO ATUALIZADAS) ===');
        duplicates.forEach(item => {
            console.log(`- ${item.name} (${item.nomeCientifico})`);
        });
    }
    
    // Exibe detalhes das novas espécies
    if (newSpecies.length > 0) {
        console.log('\n=== NOVAS ESPÉCIES ===');
        newSpecies.forEach(item => {
            console.log(`- ${item.name} (${item.nomeCientifico})`);
        });
    }
    
    // Confirma a importação
    if (newSpecies.length > 0 || duplicates.length > 0) {
        const confirmImport = confirm(
            `Deseja processar as espécies?\n` +
            `- ${newSpecies.length} novas espécies serão adicionadas\n` +
            `- ${duplicates.length} espécies existentes serão atualizadas\n\n` +
            `Usando: ${useFirebase ? 'Firebase' : 'localStorage (fallback)'}`
        );
        
        if (confirmImport) {
            let importCount = 0;
            let updateCount = 0;
            const updatedSpecies = [...existingSpecies]; // Cópia para modificação
            
            // Adiciona as novas espécies
            newSpecies.forEach(item => {
                updatedSpecies.push({
                    id: `ESP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    especie: item.name,
                    nomeCientifico: item.nomeCientifico,
                    createdAt: new Date().toISOString()
                });
                importCount++;
            });
            
            // Atualiza as espécies existentes
            duplicates.forEach(item => {
                const speciesIndex = findSpeciesIndex(updatedSpecies, item.name);
                if (speciesIndex !== -1) {
                    // Preservar ID/Key e outros campos existentes
                    const existingId = updatedSpecies[speciesIndex].id || updatedSpecies[speciesIndex].key;
                    const existingData = updatedSpecies[speciesIndex];
                    
                    updatedSpecies[speciesIndex] = {
                        ...existingData,
                        id: existingId, // Mantém o ID original
                        especie: item.name,
                        nomeCientifico: item.nomeCientifico,
                        updatedAt: new Date().toISOString()
                    };
                    updateCount++;
                }
            });
            
            let saveSuccess = false;
            
            // Salvar no Firebase se disponível
            if (useFirebase) {
                console.log("Salvando espécies no Firebase...");
                saveSuccess = await saveSpeciesToFirebase(firebaseResult.db, updatedSpecies);
            }
            
            // Sempre salvar no localStorage para backup
            const localSaveSuccess = saveSpecies(updatedSpecies);
            
            if (saveSuccess || localSaveSuccess) {
                console.log(`\n✅ Importação concluída com sucesso!`);
                console.log(`- ${importCount} espécies foram adicionadas`);
                console.log(`- ${updateCount} espécies foram atualizadas`);
                console.log(`- Dados salvos em: ${saveSuccess ? 'Firebase' : ''} ${localSaveSuccess ? 'localStorage' : ''}`);
                
                alert(`Importação concluída com sucesso!\n${importCount} espécies adicionadas\n${updateCount} espécies atualizadas`);
            } else {
                console.error('\n❌ Erro ao salvar as espécies importadas.');
                alert('Erro ao salvar as espécies importadas. Verifique o console para mais detalhes.');
            }
        } else {
            console.log('\nImportação cancelada pelo usuário.');
        }
    } else {
        alert('Não há espécies para processar.');
        console.log('\nNão há espécies para processar.');
    }
}

// Inicia o processo de importação
importSpecies(); 
