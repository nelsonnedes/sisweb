/**
 * Biblioteca de cálculos de madeira
 * Contém funções específicas para cálculos volumétricos
 */

/**
 * Calcula o volume em metros cúbicos a partir das dimensões em centímetros
 * @param {number} thickness - Espessura em centímetros
 * @param {number} width - Largura em centímetros
 * @param {number} length - Comprimento em centímetros
 * @param {number} quantity - Quantidade de peças
 * @returns {number} Volume em metros cúbicos
 */
function calcularVolume(thickness, width, length, quantity = 1) {
    // Todas as medidas em centímetros, dividido por 1.000.000 para converter para metros cúbicos
    // Volume = (espessura * largura * comprimento) / 1000000 * quantidade
    const volumePorPeca = (thickness * width * length) / 1000000;
    return volumePorPeca * quantity;
}

/**
 * Calcula o volume em metros cúbicos para pacotes de madeira
 * @param {number} thickness - Espessura em centímetros
 * @param {number} width - Largura em centímetros
 * @param {number} length - Comprimento em centímetros
 * @param {number} quantity - Quantidade de pacotes
 * @param {number} pecasPorPacote - Quantidade de peças por pacote
 * @returns {number} Volume em metros cúbicos
 */
function calcularVolumePacote(thickness, width, length, quantity = 1, pecasPorPacote = 1) {
    const volumePorPeca = (thickness * width * length) / 1000000;
    const totalPecas = quantity * pecasPorPacote;
    return volumePorPeca * totalPecas;
}

/**
 * Calcula o volume em metros cúbicos para madeira em pés (fórmula especial)
 * @param {number} espessura - Espessura em centímetros
 * @param {number} largura - Largura em centímetros
 * @param {number} comprimentoPes - Comprimento em pés
 * @param {number} quantidade - Quantidade de peças
 * @returns {number} Volume em metros cúbicos
 */
function calcularVolumePes(espessura, largura, comprimentoPes, quantidade = 1) {
    // Converter pés para centímetros (1 pé = 30.48 cm)
    const comprimentoCm = comprimentoPes * 30.48;
    
    // Calcular volume usando a fórmula padrão
    return calcularVolume(espessura, largura, comprimentoCm, quantidade);
}

/**
 * Calcula o volume em metros cúbicos para toras de madeira usando fórmula de Smalian
 * @param {number} diametroMenor - Diâmetro menor em centímetros
 * @param {number} diametroMaior - Diâmetro maior em centímetros
 * @param {number} comprimento - Comprimento em metros
 * @returns {number} Volume em metros cúbicos
 */
function calcularVolumeTora(diametroMenor, diametroMaior, comprimento) {
    // Cálculo da área transversal nos dois extremos (pi * r²)
    const areaMenor = Math.PI * Math.pow(diametroMenor / 2, 2) / 10000; // cm² para m²
    const areaMaior = Math.PI * Math.pow(diametroMaior / 2, 2) / 10000; // cm² para m²
    
    // Fórmula de Smalian: V = (A1 + A2) / 2 * L
    const volume = (areaMenor + areaMaior) / 2 * comprimento;
    
    return volume;
}

/**
 * Calcula o valor total com base no volume e preço por metro cúbico
 * @param {number} volume - Volume em metros cúbicos
 * @param {number} precoUnitario - Preço por metro cúbico
 * @returns {number} Valor total
 */
function calcularValor(volume, precoUnitario) {
    return volume * precoUnitario;
}

/**
 * Calcula a quantidade de folhas (produtos) a partir do volume total e dimensões
 * @param {number} volumeTotal - Volume total em metros cúbicos
 * @param {number} espessura - Espessura em centímetros
 * @param {number} largura - Largura em centímetros
 * @param {number} comprimento - Comprimento em centímetros
 * @returns {number} Quantidade de folhas
 */
function calcularQuantidadePorVolume(volumeTotal, espessura, largura, comprimento) {
    // Volume por peça em metros cúbicos
    const volumePorPeca = (espessura * largura * comprimento) / 1000000;
    
    // Calcular quantidade arredondando para baixo
    return Math.floor(volumeTotal / volumePorPeca);
}

/**
 * Calcula o aproveitamento da madeira em porcentagem
 * @param {number} volumeProcessado - Volume após processamento em metros cúbicos
 * @param {number} volumeOriginal - Volume original em metros cúbicos
 * @returns {number} Aproveitamento em porcentagem
 */
function calcularAproveitamento(volumeProcessado, volumeOriginal) {
    if (volumeOriginal <= 0) return 0;
    
    const aproveitamento = (volumeProcessado / volumeOriginal) * 100;
    return Math.round(aproveitamento * 10) / 10; // Arredonda para 1 casa decimal
}

/**
 * Converte volume de metros cúbicos para pés cúbicos
 * @param {number} volumeM3 - Volume em metros cúbicos
 * @returns {number} Volume em pés cúbicos
 */
function converterM3ParaPesCubicos(volumeM3) {
    // 1 metro cúbico = 35.3147 pés cúbicos
    return volumeM3 * 35.3147;
}

/**
 * Converte volume de pés cúbicos para metros cúbicos
 * @param {number} volumePes3 - Volume em pés cúbicos
 * @returns {number} Volume em metros cúbicos
 */
function converterPes3ParaM3(volumePes3) {
    // 1 pé cúbico = 0.0283168 metros cúbicos
    return volumePes3 * 0.0283168;
}

/**
 * Calcula o frete com base no volume, distância e valor por km/m³
 * @param {number} volume - Volume em metros cúbicos
 * @param {number} distancia - Distância em quilômetros
 * @param {number} valorPorKmM3 - Valor por km/m³
 * @returns {number} Valor do frete
 */
function calcularFrete(volume, distancia, valorPorKmM3) {
    return volume * distancia * valorPorKmM3;
}

/**
 * Calcula o peso estimado da madeira com base no volume e densidade
 * @param {number} volume - Volume em metros cúbicos
 * @param {number} densidade - Densidade em kg/m³ (peso específico da madeira)
 * @returns {number} Peso em kg
 */
function calcularPesoMadeira(volume, densidade = 800) {
    // Densidades médias de algumas madeiras em kg/m³:
    // - Pinus: 450-500
    // - Eucalipto: 600-700
    // - Angelim: 700-800
    // - Itaúba: 900-950
    // - Ipê: 1000-1100
    return volume * densidade;
}

/**
 * Calcula o volume equivalente em dúzias de tábuas padrão
 * @param {number} volumeM3 - Volume em metros cúbicos
 * @returns {number} Quantidade em dúzias de tábuas
 */
function calcularDuzias(volumeM3) {
    // Considerando tábua padrão de 1" x 12" x 1' (2,54cm x 30,48cm x 30,48cm)
    const volumePorTabua = (2.54 * 30.48 * 30.48) / 1000000; // em m³
    const tabuasPorDuzia = 12;
    return volumeM3 / (volumePorTabua * tabuasPorDuzia);
}

/**
 * Calcula a área em metros quadrados para um determinado volume e espessura
 * @param {number} volumeM3 - Volume em metros cúbicos
 * @param {number} espessuraCm - Espessura em centímetros
 * @returns {number} Área em metros quadrados
 */
function calcularAreaPorVolume(volumeM3, espessuraCm) {
    // Área = Volume / Espessura (convertida para metros)
    const espessuraM = espessuraCm / 100;
    return volumeM3 / espessuraM;
}

/**
 * Calcula o preço por metro quadrado com base no preço por metro cúbico e espessura
 * @param {number} precoM3 - Preço por metro cúbico
 * @param {number} espessuraCm - Espessura em centímetros
 * @returns {number} Preço por metro quadrado
 */
function calcularPrecoM2(precoM3, espessuraCm) {
    const espessuraM = espessuraCm / 100;
    return precoM3 * espessuraM;
}

/**
 * Calcula o custo de produção com base no volume e custo por metro cúbico
 * @param {number} volumeM3 - Volume em metros cúbicos
 * @param {number} custoPorM3 - Custo de produção por metro cúbico
 * @returns {number} Custo total de produção
 */
function calcularCustoProducao(volumeM3, custoPorM3) {
    return volumeM3 * custoPorM3;
}

/**
 * Calcula a margem de lucro com base no preço de venda e custo
 * @param {number} precoVenda - Preço de venda
 * @param {number} custo - Custo
 * @returns {number} Margem de lucro em porcentagem
 */
function calcularMargemLucro(precoVenda, custo) {
    if (precoVenda <= 0 || custo <= 0) return 0;
    
    const lucro = precoVenda - custo;
    const margemPorcentagem = (lucro / precoVenda) * 100;
    
    return Math.round(margemPorcentagem * 10) / 10; // Arredonda para 1 casa decimal
}

/**
 * Calcula o preço sugerido de venda com base no custo e margem de lucro desejada
 * @param {number} custo - Custo
 * @param {number} margemDesejada - Margem de lucro desejada em porcentagem
 * @returns {number} Preço sugerido de venda
 */
function calcularPrecoSugerido(custo, margemDesejada) {
    if (custo <= 0 || margemDesejada <= 0) return 0;
    
    // Preço = Custo / (1 - Margem/100)
    return custo / (1 - (margemDesejada / 100));
}