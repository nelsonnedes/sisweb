// Gerador de XML MDF-e modelo 58, versao 3.00.
const MdfeXmlBuilder = (() => {
    'use strict';

    const NS = 'http://www.portalfiscal.inf.br/mdfe';

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
            .slice(0, 3000);
    }

    function digits(value) {
        return String(value == null ? '' : value).replace(/\D/g, '');
    }

    function cUF(uf) {
        const codes = {
            AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53',
            ES: '32', GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15',
            PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43',
            RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17'
        };
        return codes[String(uf || '').toUpperCase()] || '';
    }

    function calcDV(base43) {
        let sum = 0;
        let weight = 2;
        for (let i = base43.length - 1; i >= 0; i -= 1) {
            sum += Number(base43[i]) * weight;
            weight = weight === 9 ? 2 : weight + 1;
        }
        const rest = sum % 11;
        return rest < 2 ? 0 : 11 - rest;
    }

    function localDateTime(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return raw.length === 16 ? `${raw}:00-03:00` : raw;
    }

    function requireCode(value, label) {
        const code = digits(value);
        if (!/^\d{7}$/.test(code) || code === '0000000') throw new Error(`${label} deve ter codigo IBGE valido.`);
        return code;
    }

    function buildKey({ ufEmit, cnpj, dataEmissao, serie, numero }) {
        const ufCode = cUF(ufEmit);
        const cnpjDigits = digits(cnpj);
        if (!ufCode || cnpjDigits.length !== 14) throw new Error('CNPJ e UF do emitente sao obrigatorios para gerar a chave MDF-e.');
        const date = String(dataEmissao || '').slice(2, 7).replace('-', '');
        const number = digits(numero).padStart(9, '0').slice(-9);
        const series = digits(serie).padStart(3, '0').slice(-3);
        const cMDF = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        const base = `${ufCode}${date}${cnpjDigits}58${series}${number}1${cMDF}`;
        return { chave: `${base}${calcDV(base)}`, cMDF, cDV: String(calcDV(base)) };
    }

    function buildEmit(emit) {
        const cnpj = digits(emit.cnpj);
        const ie = digits(emit.ie);
        if (cnpj.length !== 14 || !ie) throw new Error('CNPJ e IE do emitente sao obrigatorios para o MDF-e.');
        const address = emit.endereco || {};
        return `<emit><CNPJ>${cnpj}</CNPJ><IE>${ie}</IE><xNome>${esc(emit.razaoSocial)}</xNome>`
            + (emit.nomeFantasia ? `<xFant>${esc(emit.nomeFantasia)}</xFant>` : '')
            + `<enderEmit><xLgr>${esc(address.logradouro)}</xLgr><nro>${esc(address.numero || 'S/N')}</nro>`
            + `<xBairro>${esc(address.bairro || 'Centro')}</xBairro><cMun>${requireCode(address.codigoMunicipio, 'Municipio do emitente')}</cMun>`
            + `<xMun>${esc(address.municipio)}</xMun><UF>${esc(address.uf)}</UF><CEP>${digits(address.cep)}</CEP></enderEmit></emit>`;
    }

    function buildDocuments(documents, cityCode, cityName) {
        if (!Array.isArray(documents) || documents.length === 0) throw new Error('Adicione ao menos uma NF-e ao MDF-e.');
        const items = documents.map((doc) => {
            const key = digits(doc.chave);
            if (!/^\d{44}$/.test(key)) throw new Error('Cada documento deve possuir chave NF-e com 44 digitos.');
            return `<infNFe><chNFe>${key}</chNFe></infNFe>`;
        }).join('');
        return `<infDoc><infMunDescarga><cMunDescarga>${requireCode(cityCode, 'Municipio de descarregamento')}</cMunDescarga>`
            + `<xMunDescarga>${esc(cityName)}</xMunDescarga>${items}</infMunDescarga></infDoc>`;
    }

    function buildModal(data) {
        const vehicle = data.veiculo || {};
        const driver = data.condutor || {};
        const placa = String(vehicle.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const cpf = digits(driver.cpf);
        if (!placa || cpf.length !== 11) throw new Error('Placa e CPF do condutor sao obrigatorios para o MDF-e.');
        return `<infModal versaoModal="3.00"><rodo><veicTracao><placa>${esc(placa)}</placa>`
            + `<tara>${digits(vehicle.tara)}</tara><condutor><xNome>${esc(driver.nome)}</xNome><CPF>${cpf}</CPF></condutor>`
            + `<tpRod>01</tpRod><tpCar>00</tpCar><UF>${esc(data.ufInicio)}</UF></veicTracao></rodo></infModal>`;
    }

    function buildMdfe(data) {
        const emit = data.emit || {};
        const ufEmit = String(emit.endereco?.uf || data.ufInicio || '').toUpperCase();
        const number = data.numero || 1;
        const keyInfo = buildKey({
            ufEmit,
            cnpj: emit.cnpj,
            dataEmissao: data.dataEmissao,
            serie: data.serie,
            numero: number
        });
        const origemCode = requireCode(data.codigoMunicipioCarregamento, 'Municipio de carregamento');
        const destinoCode = requireCode(data.codigoMunicipioDescarregamento, 'Municipio de descarregamento');
        const totalValue = Number(data.valorTotal || 0).toFixed(2);
        const totalWeight = Number(data.pesoTotal || 0).toFixed(4);
        const serie = digits(data.serie).padStart(3, '0').slice(-3);
        const nMDF = digits(number).padStart(9, '0').slice(-9);

        const ide = `<ide><cUF>${cUF(ufEmit)}</cUF><tpAmb>${data.tpAmb === 1 ? 1 : 2}</tpAmb><tpEmit>1</tpEmit><mod>58</mod>`
            + `<serie>${serie}</serie><nMDF>${nMDF}</nMDF><cMDF>${keyInfo.cMDF}</cMDF><cDV>${keyInfo.cDV}</cDV>`
            + `<modal>1</modal><dhEmi>${localDateTime(data.dataEmissao)}</dhEmi><tpEmis>1</tpEmis><procEmi>0</procEmi>`
            + `<verProc>Sisweb</verProc><UFIni>${esc(data.ufInicio)}</UFIni><UFFim>${esc(data.ufFim)}</UFFim>`
            + `<infMunCarrega><cMunCarrega>${origemCode}</cMunCarrega><xMunCarrega>${esc(data.municipioCarregamento)}</xMunCarrega></infMunCarrega>`
            + `</ide>`;
        const total = `<tot><qNFe>${data.documentos.length}</qNFe><vCarga>${totalValue}</vCarga><cUnid>01</cUnid><qCarga>${totalWeight}</qCarga></tot>`;
        const xml = `<?xml version="1.0" encoding="UTF-8"?><MDFe xmlns="${NS}"><infMDFe Id="MDFe${keyInfo.chave}" versao="3.00">`
            + `${ide}${buildEmit(emit)}${buildModal(data)}${buildDocuments(data.documentos, destinoCode, data.municipioDescarregamento)}${total}`
            + `</infMDFe></MDFe>`;
        return { xml, chave: keyInfo.chave, numero: nMDF };
    }

    return { buildMdfe, calcDV };
})();

window.MdfeXmlBuilder = MdfeXmlBuilder;
