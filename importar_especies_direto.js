// Script para importar espécies - Cole este código no console do navegador

// Verificar se o Firebase está disponível e inicializado
async function initFirebase() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        console.log("Firebase já inicializado, reutilizando...");
        return { firebase, db: firebase.database() };
    }
    
    try {
        // Carregar o Firebase se ainda não estiver disponível
        if (typeof firebase === 'undefined') {
            console.log("Carregando módulos do Firebase dinamicamente...");
            
            // Carregar o script do Firebase App
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            // Carregar o script do Firebase Database
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        // Configuração do Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyCF_9e067URYnB6iGnTAahPfaTMl-RQ77k",
            authDomain: "sisweb-7ce82.firebaseapp.com",
            databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "sisweb-7ce82",
            storageBucket: "sisweb-7ce82.firebasestorage.app",
            messagingSenderId: "240003261222",
            appId: "1:240003261222:web:1aeaf919ddc7e5c691d7e7",
            measurementId: "G-FTC6JZ5ZGX"
        };

        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase inicializado com sucesso");
        
        return { firebase, db: firebase.database() };
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        alert("Erro ao inicializar Firebase. Será usado localStorage como fallback.");
        return null;
    }
}

// Função para recuperar espécies do Firebase
async function getSpeciesFromFirebase(db) {
    try {
        const snapshot = await db.ref('species').once('value');
        if (!snapshot.exists()) return [];
        
        const species = [];
        snapshot.forEach(childSnapshot => {
            species.push({
                key: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        console.log(`Recuperadas ${species.length} espécies do Firebase`);
        return species;
    } catch (error) {
        console.error("Erro ao recuperar espécies do Firebase:", error);
        return null;
    }
}

// Função para recuperar espécies do localStorage
function getSpecies() {
    try {
        const data = localStorage.getItem('species');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Erro ao recuperar espécies:', e);
        return [];
    }
}

// Função para salvar espécies no localStorage
function saveSpecies(species) {
    try {
        localStorage.setItem('species', JSON.stringify(species));
        return true;
    } catch (e) {
        console.error('Erro ao salvar espécies:', e);
        return false;
    }
}

// Função para salvar espécies no Firebase
async function saveSpeciesToFirebase(db, species) {
    try {
        // Para cada espécie
        let successCount = 0;
        
        for (const specie of species) {
            try {
                if (!specie) continue;
                
                // Usar o key se disponível, ou gerar um novo ID
                const itemKey = specie.key || specie.id || `species_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                delete specie.key; // Remover a propriedade key antes de salvar
                
                // Adicionar timestamp se for nova ou atualizada
                if (!specie.createdAt) {
                    specie.createdAt = new Date().toISOString();
                }
                specie.updatedAt = new Date().toISOString();
                
                // Salvar no Firebase
                await db.ref(`species/${itemKey}`).set(specie);
                successCount++;
            } catch (itemError) {
                console.error(`Erro ao salvar espécie no Firebase:`, itemError, specie);
            }
        }
        
        console.log(`✅ ${successCount} espécies salvas no Firebase`);
        return successCount > 0;
    } catch (error) {
        console.error('Erro ao salvar no Firebase:', error);
        return false;
    }
}

// Função para verificar se uma espécie já existe
function speciesExists(species, name) {
    return species.some(s => 
        s.name && s.name.toLowerCase() === name.toLowerCase()
    );
}

// Função para encontrar o índice de uma espécie existente
function findSpeciesIndex(species, name) {
    return species.findIndex(s => 
        s.name && s.name.toLowerCase() === name.toLowerCase()
    );
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
        
        const description = line.substring(0, dashIndex).trim();
        const name = line.substring(dashIndex + 3).trim();
        
        if (!name) {
            invalidLines.push({ line, index: index + 1, reason: 'Nome da espécie ausente' });
            return;
        }
        
        if (!description) {
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
        validLines.push({ name, description, index: index + 1 });
    });
    
    return { validLines, invalidLines };
}

// Função principal para importar espécies
async function importSpecies() {
    // Inicializar Firebase
    const firebaseResult = await initFirebase();
    const useFirebase = firebaseResult !== null;
    
    if (useFirebase) {
        console.log("Firebase disponível, usando para a importação");
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
            console.log(`- ${item.name} (${item.description})`);
        });
    }
    
    // Exibe detalhes das novas espécies
    if (newSpecies.length > 0) {
        console.log('\n=== NOVAS ESPÉCIES ===');
        newSpecies.forEach(item => {
            console.log(`- ${item.name} (${item.description})`);
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
                    id: `species_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name,
                    description: item.description,
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
                        name: item.name, // Substitui pelo nome da lista
                        description: item.description, // Substitui pela descrição da lista
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
