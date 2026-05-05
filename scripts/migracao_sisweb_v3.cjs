const admin = require('firebase-admin');
const fs = require('fs');

// INSTRUÇÕES: 
// 1. Instale as dependências se não tiver: npm install firebase-admin
// 2. Coloque sua service-account.json na mesma pasta deste script (ou modifique o caminho abaixo).
// 3. Este script rodará em modo DRY RUN por padrão (não altera nada). Mude para commit=true quando tiver certeza.

const DRY_RUN = false; 

// Inicialize com as credenciais do seu projeto real
const serviceAccount = require('c:/Sisweb/service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "sisweb-7ce82.appspot.com" // .appspot.com é o padrão do Bucket Admin
});

async function migrateSiswebToV3() {
    console.log("🚀 Iniciando Script de Migração Sisweb 3.0...");
    if (DRY_RUN) console.log("⚠️ MODO DRY RUN ATIVADO - Nenhuma alteração real será feita no banco.");
    
    const db = admin.database();
    const bucket = admin.storage().bucket();
    
    // 1. Puxando todos os locatários
    console.log("📡 Baixando Snapshot total de Companies (Isso pode demorar alguns segundos)...");
    const snapshot = await db.ref('companies').once('value');
    const companies = snapshot.val() || {};
    
    let updates = {};
    let migrationsCount = 0;
    
    for (const [companyId, companyData] of Object.entries(companies)) {
        if (!companyData) continue;
        console.log(`\n🔍 Processando empresa: ${companyId}`);
        
        // --- A. DESANINHANDO ROTAS CORROMPIDAS ('companies' dentro de 'companies') ---
        if (companyData.companies) {
            console.log(`⚠️ Aninhamento duplo detectado em ${companyId}. Consertando...`);
            const nestedData = companyData.companies;
            // Levanta as propriedades primitivas aninhadas para o nível correto de 'profile'
            updates[`companies/${companyId}/profile`] = {
                ...(companyData.profile || {}),
                address: nestedData.address || companyData.address || '',
                city: nestedData.city || companyData.city || '',
                cnpj: nestedData.cnpj || companyData.cnpj || '',
                name: nestedData.name || nestedData.nome || companyData.name || '',
                phone: nestedData.phone || companyData.phone || ''
            };
            // Marca nó podre para remoção
            updates[`companies/${companyId}/companies`] = null;
            migrationsCount++;
        }
        
        // Mover propriedades primitivas soltas na raiz (ex: company 1774030248295) para 'profile'
        if (companyData.name || companyData.city || companyData.cnpj) {
             const profileUpdate = updates[`companies/${companyId}/profile`] || companyData.profile || {};
             updates[`companies/${companyId}/profile`] = {
                 ...profileUpdate,
                 name: companyData.name || profileUpdate.name || '',
                 city: companyData.city || profileUpdate.city || '',
                 cnpj: companyData.cnpj || profileUpdate.cnpj || ''
             };
             // Limpar as primitivas da raiz
             updates[`companies/${companyId}/name`] = null;
             updates[`companies/${companyId}/city`] = null;
             updates[`companies/${companyId}/cnpj`] = null;
        }

        // --- B. PADRONIZAÇÃO DE CAMINHOS DE ROMANEIOS (ALIAS) ---
        const rotasLegadas = [
            { old: 'romaneios_tl', new: 'tl' },
            { old: 'romaneiosTl', new: 'tl' },
            { old: 'romaneios_tora', new: 'tora' },
            { old: 'romaneiosTora', new: 'tora' },
            { old: 'romaneios_pct', new: 'pct' },
            { old: 'romaneiosPct', new: 'pct' }
        ];

        for (const rota of rotasLegadas) {
            if (companyData[rota.old]) {
                console.log(`🔄 Migrando módulo legado: ${rota.old} -> romaneios/${rota.new}`);
                updates[`companies/${companyId}/romaneios/${rota.new}`] = companyData[rota.old];
                updates[`companies/${companyId}/${rota.old}`] = null; // Remove a velha
                migrationsCount++;
            }
        }
        
        // --- C. PADRONIZAÇÃO DO FINANCEIRO ---
        if (companyData.contasPagar) {
            updates[`companies/${companyId}/financas/pagar`] = companyData.contasPagar;
            updates[`companies/${companyId}/contasPagar`] = null;
            migrationsCount++;
        }
        if (companyData.contasReceber) {
            updates[`companies/${companyId}/financas/receber`] = companyData.contasReceber;
            updates[`companies/${companyId}/contasReceber`] = null;
            migrationsCount++;
        }

        // --- D. MIGRAÇÃO DE LOGO BASE64 PARA STORAGE ---
        const base64Data = companyData.logoBase64 || (companyData.companies && companyData.companies.logoBase64);
        if (base64Data && base64Data.startsWith('data:image')) {
            console.log(`📦 Logo Base64 detectado em ${companyId}. Realizando upload para o Firebase Storage...`);
            
            if (!DRY_RUN) {
                try {
                    // Extrair tipo MIME e Buffer
                    const [mimeHeader, base64String] = base64Data.split(',');
                    const mimeType = mimeHeader.match(/:(.*?);/)[1];
                    const extension = mimeType.split('/')[1] || 'png';
                    const buffer = Buffer.from(base64String, 'base64');
                    
                    const filePath = `company-logos/${companyId}/profile_logo.${extension}`;
                    const file = bucket.file(filePath);
                    
                    await file.save(buffer, {
                        metadata: { contentType: mimeType },
                        public: true
                    });
                    
                    // Tornar p\u00fablico para obtermos a URL direta (ou usar signed URL duradoura)
                    await file.makePublic();
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
                    
                    // Adicionar na flag de update do profile
                    const prof = updates[`companies/${companyId}/profile`] || companyData.profile || {};
                    prof.logoUrl = publicUrl;
                    updates[`companies/${companyId}/profile`] = prof;
                    
                    // Limpar o peso do banco
                    updates[`companies/${companyId}/logoBase64`] = null;
                    if (updates[`companies/${companyId}/companies`]) {
                        updates[`companies/${companyId}/companies/logoBase64`] = null;
                    }
                    console.log(`✅ Upload concluído! URL: ${publicUrl}`);
                } catch (err) {
                    console.error(`❌ Erro no upload da logo de ${companyId}:`, err);
                }
            } else {
                console.log(`(DRY RUN) Simularia o upload do buffer e regravaria como URL em profile.logoUrl.`);
            }
        }
    }

    if (Object.keys(updates).length > 0) {
        console.log(`\n✅ Varredura concluída. ${Object.keys(updates).length} atualizações cirúrgicas preparadas.`);
        if (!DRY_RUN) {
            console.log("💾 Aplicando Patch Massivo no Banco de Dados...");
            await db.ref().update(updates);
            console.log("🎉 MODO DE PRODUÇÃO: Banco de Dados 3.0 estruturado com sucesso!");
        } else {
            console.log("🛑 MODO DRY RUN: Execução finalizada. Para aplicar no banco real, modifique const DRY_RUN = false no código e rode junto com sua chave Service-Account.");
            // Salvar preview do payload:
            fs.writeFileSync('./migration_preview.json', JSON.stringify(updates, null, 2));
            console.log("Salvo 'migration_preview.json' com o mapeamento das modificações para a sua conferência.");
        }
    } else {
        console.log("\n✅ O banco já parece estar 100% padronizado na versão 3.0!");
    }
}

migrateSiswebToV3().catch(console.error).then(() => process.exit(0));
