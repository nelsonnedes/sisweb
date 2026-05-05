/**
 * Função para formatar uma dimensão, convertendo números para formato brasileiro
 * @param {number|string} dimensao - Valor numérico a ser formatado
 * @return {string} Dimensão formatada com vírgula como separador decimal
 */
function formatarDimensao(dimensao) {
    if (dimensao === undefined || dimensao === null) {
        return "0,00";
    }
    
    // Se for string, converter para número
    let valor = dimensao;
    if (typeof dimensao === 'string') {
        // Substituir vírgula por ponto para garantir conversão correta
        valor = parseFloat(dimensao.replace(',', '.'));
    }
    
    // Verificar se é um número válido
    if (isNaN(valor)) {
        return "0,00";
    }
    
    // Formatar com duas casas decimais e substituir ponto por vírgula
    return valor.toFixed(2).replace('.', ',');
}

/**
 * Função para formatar um volume em metros cúbicos
 * @param {number} volume - Volume a ser formatado
 * @return {string} Volume formatado com 3 casas decimais e unidade
 */
function formatarVolume(volume) {
    if (volume === undefined || volume === null) {
        return "0,000 m³";
    }
    
    // Verificar se é um número válido
    if (isNaN(volume)) {
        return "0,000 m³";
    }
    
    // Formatar com três casas decimais e substituir ponto por vírgula
    return volume.toFixed(3).replace('.', ',') + " m³";
}

// Expor as funções para uso global
window.formatarDimensao = formatarDimensao;
window.formatarVolume = formatarVolume;
