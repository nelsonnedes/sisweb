const admin = require('firebase-admin');

// ⚠️ INSTRUÇÕES:
// 1. Obtenha sua chave de serviço (serviceAccountKey.json) no Console do Firebase > Configurações > Contas de serviço.
// 2. Salve o arquivo na raiz do projeto como 'serviceAccountKey.json'.
// 3. Execute: node admin-wipe-db.js

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

async function wipeDatabase() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('⚠️ PERIGO: Isso apagará TODO o banco de dados. Digite "CONFIRMAR" para continuar: ', async (answer) => {
    if (answer === 'CONFIRMAR') {
      console.log('🗑️ Iniciando limpeza...');
      try {
        await db.ref('/').remove();
        console.log('✅ Banco de dados limpo com sucesso!');
        
        // Opcional: Recriar estrutura básica
        console.log('🏗️ Recriando estrutura básica...');
        await db.ref('/_metadata').set({
            createdAt: new Date().toISOString(),
            status: 'fresh_start'
        });
        
        console.log('✨ Pronto para produção!');
      } catch (error) {
        console.error('❌ Erro ao limpar banco:', error);
      }
    } else {
      console.log('❌ Operação cancelada.');
    }
    readline.close();
    process.exit();
  });
}

wipeDatabase();
