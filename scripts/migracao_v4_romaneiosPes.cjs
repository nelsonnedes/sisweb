const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('c:/Sisweb/service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app"
});

async function migrateV4Pes() {
    console.log("🚀 Iniciando Script de Migração Pes 4.0...");
    const db = admin.database();
    const snapshot = await db.ref('companies').once('value');
    const companies = snapshot.val() || {};
    let updates = {};
    let count = 0;

    for (const [companyId, companyData] of Object.entries(companies)) {
        if (!companyData) continue;
        
        if (companyData.romaneiosPes) {
            console.log(`📦 Empresa ${companyId}: Migrando romaneiosPes -> romaneios/pes`);
            updates[`companies/${companyId}/romaneios/pes`] = companyData.romaneiosPes;
            updates[`companies/${companyId}/romaneiosPes`] = null;
            count++;
        }
    }

    if (count > 0) {
        console.log(`📡 Aplicando ${count} alterações no Firebase...`);
        try {
            await db.ref().update(updates);
            console.log("✅ Migração Pes concluída com sucesso!");
        } catch (error) {
            console.error("❌ Erro ao aplicar atualizações:", error);
        }
    } else {
        console.log("ℹ️ Nenhuma migração pendente para romaneiosPes.");
    }
    process.exit(0);
}

migrateV4Pes().catch(error => {
    console.error("❌ Erro fatal na migração:", error);
    process.exit(1);
});
