const admin = require('firebase-admin');
const serviceAccount = require('c:/Sisweb/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app"
});

async function inspectNodes() {
    const db = admin.database();
    const snapshot = await db.ref('companies').once('value');
    const companies = snapshot.val() || {};

    console.log("🔍 DIAGNÓSTICO DE NÓS (ROOT DA EMPRESA):");
    for (const [id, data] of Object.entries(companies).slice(0, 3)) {
        if (!data) continue;
        console.log(`\n🏢 Empresa: ${id}`);
        const keys = Object.keys(data);
        console.log(`🔑 Chaves Encontradas:`, keys.join(', '));
        if (data.romaneios) {
            console.log(`   📂 romaneios sub-nós:`, Object.keys(data.romaneios).join(', '));
        }
    }
    process.exit(0);
}

inspectNodes().catch(console.error);
