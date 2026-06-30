/**
 * Migração de dados para Firebase
 * 
 * Este módulo gerencia a migração de dados do localStorage para o Firebase,
 * mantendo compatibilidade com o sistema existente.
 */

import { 
  migrateDataToFirebase, 
  authService, 
  saveToFirebase,
  getFromFirebase,
  migrateFromIndexedDB
} from './firebaseService.js';

// Mapeamento de entidades e seus caminhos no Firebase
const entityMappings = {
  company: {
    localKey: 'empresa',
    firebasePath: 'empresas',
    alternativeKeys: ['empresas', 'company', 'dados_empresa']
  },
  clients: {
    localKey: 'clientes',
    firebasePath: 'clientes',
    alternativeKeys: ['clients', 'cliente', 'client', 'clientes_dados']
  },
  species: {
    localKey: 'especies',
    firebasePath: 'especies',
    alternativeKeys: ['especie', 'madeiras', 'tipos_madeira']
  },
  romaneiosPct: {
    localKey: 'pacotes',
    firebasePath: 'romaneios/pacotes',
    alternativeKeys: ['romaneios_pacotes', 'romaneio_pacotes', 'pacote', 'romaneio_pacote']
  },
  romaneiosTora: {
    localKey: 'toras',
    firebasePath: 'romaneios/toras',
    alternativeKeys: ['romaneios_toras', 'romaneio_toras', 'tora', 'romaneio_tora']
  },
  romaneiosPes: {
    localKey: 'pes',
    firebasePath: 'romaneios/pes',
    alternativeKeys: ['romaneios_pes', 'romaneio_pes', 'pe', 'romaneio_pe']
  },
  users: {
    localKey: 'users',
    firebasePath: 'users',
    alternativeKeys: ['usuarios', 'user', 'usuario']
  }
};

// Status da migração
const migrationStatus = {
  running: false,
  startTime: null,
  endTime: null,
  status: {
    company: { completed: false, count: 0 },
    clients: { completed: false, count: 0 },
    species: { completed: false, count: 0 },
    romaneiosPct: { completed: false, count: 0 },
    romaneiosTora: { completed: false, count: 0 },
    romaneiosPes: { completed: false, count: 0 },
    users: { completed: false, count: 0 },
    indexedDB: { completed: false, count: 0 }
  },
  totalMigrated: 0,
  success: false,
  error: null
};

/**
 * Realiza a migração de todos os dados para o Firebase
 * @returns {Promise<Object>} Resultado da migração
 */
export async function migrateAllDataToFirebase() {
  if (migrationStatus.running) {
    return { 
      success: false, 
      error: "Migração já em andamento", 
      status: migrationStatus.status
    };
  }

  // Atualizar status
  migrationStatus.running = true;
  migrationStatus.startTime = new Date();
  migrationStatus.totalMigrated = 0;
  
  // Verificar autenticação
  const user = await authService.getCurrentUser();
  if (!user) {
    migrationStatus.running = false;
    migrationStatus.error = "Usuário não autenticado";
    return { 
      success: false, 
      error: "Usuário não autenticado" 
    };
  }
  
  console.log(`🔄 Iniciando migração completa para Firebase`);
  console.log(`👤 Usuário autenticado: ${user.email}`);
  
  let totalMigrated = 0;
  let hasErrors = false;
  
  // Função auxiliar para migrar cada entidade
  async function migrateEntity(entity) {
    const { localKey, firebasePath, alternativeKeys = [] } = entityMappings[entity];
    console.log(`🔄 Migrando ${entity}: ${localKey} → ${firebasePath}`);
    
    try {
      // Primeiro tenta com a chave principal
      let result = await migrateDataToFirebase(localKey, firebasePath);
      
      // Se não encontrou dados, tenta com as chaves alternativas
      if (!result.success || result.migrated === 0) {
        console.log(`⚠️ Nenhum dado encontrado em ${localKey}, tentando chaves alternativas...`);
        
        for (const altKey of alternativeKeys) {
          console.log(`🔍 Verificando chave alternativa: ${altKey}`);
          const altResult = await migrateDataToFirebase(altKey, firebasePath);
          
          if (altResult.success && altResult.migrated > 0) {
            console.log(`✅ Dados encontrados na chave alternativa ${altKey}`);
            result = altResult;
            break;
          }
        }
      }
      
      migrationStatus.status[entity] = {
        completed: result.success,
        count: result.migrated || 0
      };
      
      totalMigrated += result.migrated || 0;
      
      if (!result.success) {
        hasErrors = true;
        console.error(`❌ Erro na migração de ${entity}:`, result.error);
      }
      
      return result;
    } catch (error) {
      migrationStatus.status[entity] = {
        completed: false,
        count: 0
      };
      
      hasErrors = true;
      console.error(`❌ Erro na migração de ${entity}:`, error);
      return { success: false, error };
    }
  }
  
  // Migrar empresa
  await migrateEntity('company');
  
  // Migrar clientes
  await migrateEntity('clients');
  
  // Migrar espécies
  await migrateEntity('species');
  
  // Migrar romaneios de pacotes
  await migrateEntity('romaneiosPct');
  
  // Migrar romaneios de toras
  await migrateEntity('romaneiosTora');
  
  // Migrar romaneios em pés
  await migrateEntity('romaneiosPes');
  
  // Migrar usuários
  await migrateEntity('users');
  
  // Se nenhum dado foi migrado do localStorage, verificar IndexedDB
  if (totalMigrated === 0) {
    console.log(`⚠️ Nenhum dado encontrado no localStorage. Verificando IndexedDB...`);
    
    try {
      // Tentar migrar do IndexedDB
      const indexedDBResult = await migrateFromIndexedDB('sisweb', 'indexedDB');
      
      if (indexedDBResult.success && indexedDBResult.migrated > 0) {
        console.log(`✅ Migrados ${indexedDBResult.migrated} registros do IndexedDB`);
        totalMigrated += indexedDBResult.migrated;
        
        // Adicionar um status geral para IndexedDB
        migrationStatus.status.indexedDB = {
          completed: true,
          count: indexedDBResult.migrated
        };
      } else {
        console.log(`ℹ️ Nenhum dado encontrado no IndexedDB ou erro: ${indexedDBResult.error || "Desconhecido"}`);
        
        // Se não especificamos um nome de banco, tentar migrar de qualquer banco encontrado
        const generalIndexedDBResult = await migrateFromIndexedDB(null, 'indexedDB');
        
        if (generalIndexedDBResult.success && generalIndexedDBResult.migrated > 0) {
          console.log(`✅ Migrados ${generalIndexedDBResult.migrated} registros de IndexedDB genérico`);
          totalMigrated += generalIndexedDBResult.migrated;
          
          // Adicionar um status geral para IndexedDB
          migrationStatus.status.indexedDB = {
            completed: true,
            count: generalIndexedDBResult.migrated
          };
        } else {
          console.log(`ℹ️ Nenhum dado encontrado em qualquer banco IndexedDB`);
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar IndexedDB:`, error);
    }
  }
  
  // Atualizar status final
  migrationStatus.running = false;
  migrationStatus.endTime = new Date();
  migrationStatus.totalMigrated = totalMigrated;
  migrationStatus.success = !hasErrors;
  
  console.log(`✅ Migração concluída. Total: ${totalMigrated} registros.`);
  console.log(`📊 Status: ${hasErrors ? 'Parcial (com erros)' : 'Sucesso'}`);
  
  // Registrar atividade de migração no Firebase
  try {
    await saveToFirebase('system/migrations', {
      id: `migration_${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: user.email || user.uid,
      totalMigrated,
      success: !hasErrors,
      status: migrationStatus.status,
      durationMs: migrationStatus.endTime - migrationStatus.startTime
    });
  } catch (error) {
    console.error("Erro ao registrar migração:", error);
  }
  
  return {
    success: !hasErrors,
    totalMigrated,
    status: migrationStatus.status,
    durationMs: migrationStatus.endTime - migrationStatus.startTime
  };
}

/**
 * Retorna o status atual da migração
 * @returns {Object} Status da migração
 */
export function getMigrationStatus() {
  return {
    running: migrationStatus.running,
    startTime: migrationStatus.startTime,
    endTime: migrationStatus.endTime,
    status: migrationStatus.status,
    totalMigrated: migrationStatus.totalMigrated,
    success: migrationStatus.success,
    error: migrationStatus.error,
    durationMs: migrationStatus.endTime 
      ? migrationStatus.endTime - migrationStatus.startTime 
      : null
  };
}

/**
 * Verifica se já existem dados no Firebase
 * Importante para evitar duplicação de dados na migração
 * @returns {Promise<boolean>} Existem dados no Firebase?
 */
export async function checkFirebaseData() {
  try {
    // Verificar se há dados em pelo menos uma entidade
    for (const entity in entityMappings) {
      const { firebasePath } = entityMappings[entity];
      const data = await getFromFirebase(firebasePath);
      
      if (data && (
        (typeof data === 'object' && Object.keys(data).length > 0) ||
        (Array.isArray(data) && data.length > 0)
      )) {
        console.log(`🔍 Dados existentes encontrados em: ${firebasePath}`);
        return true;
      }
    }
    
    console.log('✅ Nenhum dado encontrado no Firebase. Pronto para migração.');
    return false;
  } catch (error) {
    console.error('❌ Erro ao verificar dados no Firebase:', error);
    // Em caso de erro, assumir que não há dados
    return false;
  }
}

// Permitir execução direta do script
if (typeof window !== 'undefined' && window.runMigration) {
  migrateAllDataToFirebase().then((result) => {
    console.log('Resultado da migração:', result);
    alert(`Migração concluída! ${result.totalMigrated} registros migrados.`);
  }).catch((error) => {
    console.error('Erro na migração:', error);
    alert(`Erro na migração: ${error.message || 'Erro desconhecido'}`);
  });
} 
