/**
 * Firebase Rules Helper
 * 
 * Ferramenta para ajudar a diagnosticar problemas com regras de segurança do Firebase
 * e explicar as melhores práticas para configuração segura.
 */

// Função para verificar o acesso para um caminho específico
async function checkAccess(db, path, operation = 'read') {
  try {
    const { ref, get, set, push } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js");
    
    console.log(`🔍 Verificando permissões de ${operation} para o caminho: ${path}`);
    
    if (operation === 'read') {
      const snapshot = await get(ref(db, path));
      console.log(`✅ Acesso de leitura permitido para ${path}`);
      return {
        success: true,
        value: snapshot.exists() ? snapshot.val() : null
      };
    } else if (operation === 'write') {
      const testData = {
        timestamp: new Date().toISOString(),
        test: true
      };
      
      // Criar um nó filho temporário se for um path que pode ter múltiplos items
      if (path === 'test_connection') {
        const newRef = push(ref(db, path));
        await set(newRef, testData);
      } else {
        await set(ref(db, path), testData);
      }
      
      console.log(`✅ Acesso de escrita permitido para ${path}`);
      return { success: true };
    }
  } catch (error) {
    console.error(`❌ Acesso de ${operation} negado para ${path}: ${error.message}`);
    return { 
      success: false, 
      error: error.message, 
      code: error.code 
    };
  }
}

// Função para diagnosticar problemas de regras
async function diagnosticarRegras(db, auth) {
  // Caminhos para testar
  const paths = [
    'test_connection',
    'users',
    'test_public'
  ];
  
  // Verificar se o usuário está autenticado
  let authStatus = "não autenticado";
  if (auth.currentUser) {
    authStatus = `autenticado como ${auth.currentUser.uid}`;
  }
  
  console.log(`👤 Status de autenticação: ${authStatus}`);
  
  // Verificar permissões para cada caminho
  const results = {};
  
  for (const path of paths) {
    results[path] = {
      read: await checkAccess(db, path, 'read'),
      write: await checkAccess(db, path, 'write')
    };
  }
  
  // Analisar resultados
  console.log("📊 Resultados do diagnóstico:");
  console.table(Object.keys(results).map(path => ({
    'Caminho': path,
    'Leitura': results[path].read.success ? '✓' : '✗',
    'Escrita': results[path].write.success ? '✓' : '✗',
    'Erro': results[path].read.success ? (results[path].write.success ? '-' : results[path].write.code) : results[path].read.code
  })));
  
  // Identificar problemas comuns
  const temProblemaPermissao = Object.values(results).some(r => 
    !r.read.success && r.read.code === 'PERMISSION_DENIED' || 
    !r.write.success && r.write.code === 'PERMISSION_DENIED'
  );
  
  if (temProblemaPermissao) {
    // Gerar sugestão de regras baseado no diagnóstico
    sugerirRegras(results, auth.currentUser !== null);
  }
  
  return results;
}

// Sugerir regras com base nos resultados do diagnóstico
function sugerirRegras(resultados, estaAutenticado) {
  console.log("📝 Sugestão de regras para resolver problemas encontrados:");
  
  // Verificar se tem acesso a algo
  const temAlgumAcesso = Object.values(resultados).some(r => r.read.success || r.write.success);
  
  // Regras base
  let regras = {
    "rules": {
      ".read": estaAutenticado ? "auth != null" : "false",
      ".write": estaAutenticado ? "auth != null" : "false"
    }
  };
  
  // Adicionar exceções para caminhos específicos
  Object.keys(resultados).forEach(path => {
    const result = resultados[path];
    
    // Se estiver autenticado mas não tiver acesso
    if (estaAutenticado && (!result.read.success || !result.write.success)) {
      regras.rules[path] = {
        ".read": true,
        ".write": true
      };
    }
    // Se não estiver autenticado e precisar de acesso especial
    else if (!estaAutenticado) {
      regras.rules[path] = {
        ".read": true,
        ".write": true
      };
    }
  });
  
  // Adicionar exemplos de regras mais avançadas
  regras.rules.users = {
    "$userId": {
      ".read": "auth != null && auth.uid == $userId",
      ".write": "auth != null && auth.uid == $userId"
    }
  };
  
  console.log(JSON.stringify(regras, null, 2));
  
  console.log("\n📋 Instruções para atualizar as regras:");
  console.log("1. Acesse o console do Firebase: https://console.firebase.google.com/");
  console.log("2. Selecione seu projeto e vá para Realtime Database > Rules");
  console.log("3. Cole as regras acima e clique em 'Publish'");
  console.log("\n⚠️ ATENÇÃO: Estas regras são apenas sugestões. Ajuste conforme a necessidade de segurança do seu aplicativo.");
}

// Verificar se o Firebase está configurado corretamente
async function verificarConfiguracaoFirebase(config) {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js");
    const { getDatabase } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js");
    
    console.log("🔍 Verificando configuração do Firebase...");
    
    // Validar configuração básica
    if (!config.apiKey || config.apiKey.length < 10) {
      throw new Error("API Key inválida ou muito curta");
    }
    
    if (!config.databaseURL || !config.authDomain) {
      throw new Error("Configuração incompleta: faltam databaseURL ou authDomain");
    }
    
    // Testar inicialização
    const app = initializeApp(config, "rules-checker");
    const db = getDatabase(app);
    const auth = getAuth(app);
    
    console.log("✅ Configuração do Firebase válida");
    
    return { app, db, auth };
  } catch (error) {
    console.error("❌ Erro na configuração do Firebase:", error);
    return { error };
  }
}

// Função principal para análise de regras do Firebase
export async function analisarRegrasFirebase(config) {
  console.group("🔒 Análise de Regras de Segurança do Firebase");
  
  try {
    // Verificar configuração
    const { app, db, auth, error } = await verificarConfiguracaoFirebase(config);
    
    if (error) {
      throw error;
    }
    
    // Diagnosticar regras
    const resultado = await diagnosticarRegras(db, auth);
    
    console.log("✅ Análise concluída");
    return resultado;
  } catch (error) {
    console.error("❌ Não foi possível completar a análise:", error);
    return { error };
  } finally {
    console.groupEnd();
  }
}

// Exportar outras funções úteis
export {
  verificarConfiguracaoFirebase,
  diagnosticarRegras,
  sugerirRegras
}; 
