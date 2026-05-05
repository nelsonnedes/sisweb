const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('c:/Sisweb/service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app"
});

async function migrateV4Vendas() {
    console.log("🚀 Iniciando Script de Migração Vendas 4.0...");
    const db = admin.database();
    
    console.log("📡 Baixando Snapshot de Companies...");
    const snapshot = await db.ref('companies').once('value');
    const companies = snapshot.val() || {};
    
    let updates = {};
    let count = 0;

    for (const [companyId, companyData] of Object.entries(companies)) {
        if (!companyData) continue;
        
        // --- 1. PEDIDOS VENDA ---
        if (companyData.pedidosVenda) {
            console.log(`📦 Empresa ${companyId}: Migrando pedidosVenda -> vendas/pedidos`);
            updates[`companies/${companyId}/vendas/pedidos`] = companyData.pedidosVenda;
            updates[`companies/${companyId}/pedidosVenda`] = null;
            count++;
        }

        // --- 2. CARREGO PAGAMENTOS ---
        if (companyData.carregoPagamentos) {
            console.log(`📦 Empresa ${companyId}: Migrando carregoPagamentos -> vendas/pagamentos_carrego`);
            updates[`companies/${companyId}/vendas/pagamentos_carrego`] = companyData.carregoPagamentos;
            updates[`companies/${companyId}/carregoPagamentos`] = null;
            count++;
        }
    }

    if (count > 0) {
        console.log(`📡 Aplicando ${count} alterações no Firebase...`);
        try {
            await db.ref().update(updates);
            console.log("✅ Migração V4 (Vendas) concluída com sucesso!");
        } catch (error) {
            console.error("❌ Erro ao aplicar atualizações:", error);
        }
    } else {
        console.log("ℹ️ Nenhuma migração pendente encontrada para Vendas.");
    }
    process.exit(0);
}

migrateV4Vendas().catch(error => {
    console.error("❌ Erro fatal na migração:", error);
    process.exit(1);
});
