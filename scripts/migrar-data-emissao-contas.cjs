const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve('C:/Sisweb/service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}

const db = admin.database();

function extractDateFromTimestampOrIso(val) {
    if (!val) return null;
    if (typeof val === 'string') {
        const match = val.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } else if (typeof val === 'number') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return null;
}

async function migrarDataEmissao() {
    console.log("🚀 Iniciando auditoria e migração de dataEmissao em contas financeiras...");
    const snapshot = await db.ref('companies').once('value');
    const companies = snapshot.val() || {};

    let totalContasVerificadas = 0;
    let totalContasAtualizadas = 0;
    const updates = {};

    for (const [companyId, companyData] of Object.entries(companies)) {
        if (!companyData || !companyData.financas) continue;

        const financas = companyData.financas;
        const tipos = ['receber', 'pagar'];

        for (const tipo of tipos) {
            const nodeTipo = financas[tipo];
            if (!nodeTipo) continue;

            // Suporta tanto nós particionados por mês quanto legados no nível do nó
            for (const [partOrId, partData] of Object.entries(nodeTipo)) {
                if (!partData || typeof partData !== 'object') continue;

                // Se for partição mensal (ex: '2026-06')
                if (partOrId.match(/^\d{4}-\d{2}$/)) {
                    for (const [contaId, conta] of Object.entries(partData)) {
                        if (!conta || typeof conta !== 'object') continue;
                        totalContasVerificadas++;

                        if (!conta.dataEmissao || String(conta.dataEmissao).trim() === '') {
                            const dataCalculada = extractDateFromTimestampOrIso(conta.created) ||
                                extractDateFromTimestampOrIso(conta.romaneioData) ||
                                extractDateFromTimestampOrIso(conta.dataCriacao) ||
                                extractDateFromTimestampOrIso(conta.dataVencimento) ||
                                extractDateFromTimestampOrIso(conta.vencimento);

                            if (dataCalculada) {
                                const dbPath = `companies/${companyId}/financas/${tipo}/${partOrId}/${contaId}/dataEmissao`;
                                updates[dbPath] = dataCalculada;
                                totalContasAtualizadas++;
                                console.log(`[${companyId}] ${tipo}/${partOrId}/${contaId} -> dataEmissao: ${dataCalculada} (ref: ${conta.descricao || conta.id})`);
                            }
                        }
                    }
                } else {
                    // Se for nó plano legado
                    const conta = partData;
                    totalContasVerificadas++;
                    if (!conta.dataEmissao || String(conta.dataEmissao).trim() === '') {
                        const dataCalculada = extractDateFromTimestampOrIso(conta.created) ||
                            extractDateFromTimestampOrIso(conta.romaneioData) ||
                            extractDateFromTimestampOrIso(conta.dataCriacao) ||
                            extractDateFromTimestampOrIso(conta.dataVencimento) ||
                            extractDateFromTimestampOrIso(conta.vencimento);

                        if (dataCalculada) {
                            const dbPath = `companies/${companyId}/financas/${tipo}/${partOrId}/dataEmissao`;
                            updates[dbPath] = dataCalculada;
                            totalContasAtualizadas++;
                            console.log(`[${companyId}] ${tipo}/${partOrId} (plano) -> dataEmissao: ${dataCalculada}`);
                        }
                    }
                }
            }
        }
    }

    console.log(`\n📊 Resumo da Auditoria:`);
    console.log(`- Total de contas verificadas: ${totalContasVerificadas}`);
    console.log(`- Contas sem dataEmissao para atualizar: ${totalContasAtualizadas}`);

    if (totalContasAtualizadas > 0) {
        console.log(`📡 Aplicando ${totalContasAtualizadas} atualizações atômicas no Firebase Realtime Database...`);
        await db.ref().update(updates);
        console.log(`✅ Sucesso! Todas as ${totalContasAtualizadas} contas foram migradas e atualizadas com suas datas reais de emissão.`);
    } else {
        console.log(`✨ Todas as contas já possuem dataEmissao preenchida.`);
    }

    process.exit(0);
}

migrarDataEmissao().catch(err => {
    console.error("❌ Erro fatal na migração de dataEmissao:", err);
    process.exit(1);
});
