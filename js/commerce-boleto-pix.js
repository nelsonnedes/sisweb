/**
 * commerce-boleto-pix.js
 * Gerador de Lâmina de Cobrança PIX com layout visual de boleto bancário usando jsPDF e qrcode.min.js/QRCode.
 */
(function() {
  const JSPDF_LOCAL = '/assets/vendor/jspdf.umd.min.js';
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  async function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.jsPDF) return window.jsPDF;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = JSPDF_LOCAL;
      script.onload = () => {
        const lib = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
        if (lib) resolve(lib);
        else {
          const fallbackScript = document.createElement('script');
          fallbackScript.src = JSPDF_CDN;
          fallbackScript.onload = () => {
            const fallbackLib = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
            if (fallbackLib) resolve(fallbackLib);
            else reject(new Error('jsPDF não pôde ser carregado.'));
          };
          fallbackScript.onerror = () => reject(new Error('jsPDF CDN falhou.'));
          document.head.appendChild(fallbackScript);
        }
      };
      script.onerror = () => {
        const fallbackScript = document.createElement('script');
        fallbackScript.src = JSPDF_CDN;
        fallbackScript.onload = () => {
          const fallbackLib = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
          if (fallbackLib) resolve(fallbackLib);
          else reject(new Error('jsPDF CDN falhou no carregamento.'));
        };
        fallbackScript.onerror = () => reject(new Error('jsPDF CDN falhou.'));
        document.head.appendChild(fallbackScript);
      };
      document.head.appendChild(script);
    });
  }

  function generateQrCodeDataUrl(text, size = 200) {
    return new Promise((resolve) => {
      if (!window.QRCode) {
        console.warn('QRCode library not loaded.');
        resolve('');
        return;
      }
      const holder = document.createElement('div');
      holder.style.position = 'fixed';
      holder.style.left = '-9999px';
      holder.style.top = '-9999px';
      document.body.appendChild(holder);
      try {
        new window.QRCode(holder, {
          text: text,
          width: size,
          height: size,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined
        });
        setTimeout(() => {
          const canvas = holder.querySelector('canvas');
          if (canvas && typeof canvas.toDataURL === 'function') {
            const dataUrl = canvas.toDataURL('image/png');
            holder.remove();
            resolve(dataUrl);
          } else {
            const img = holder.querySelector('img');
            const src = img ? String(img.src || '') : '';
            holder.remove();
            resolve(src);
          }
        }, 100);
      } catch (err) {
        console.error('Erro ao gerar QR Code:', err);
        holder.remove();
        resolve('');
      }
    });
  }

  async function resolveCompanyLogo(company) {
    const logoUrl = company.logoDataUrl || company.logoDataURL || company.logoUrl || company.logoURL || company.logo || '';
    if (/^data:image\/(png|jpe?g|webp);base64,/i.test(String(logoUrl || '').trim())) return logoUrl;
    try {
      if (window.SiswebCommercePdf && typeof window.SiswebCommercePdf.resolveCompanyLogoDataUrl === 'function') {
        return await window.SiswebCommercePdf.resolveCompanyLogoDataUrl(company);
      }
    } catch (_) {}
    return '';
  }

  function getPdfImageFormat(dataUrl) {
    const value = String(dataUrl || '');
    if (/^data:image\/jpe?g;base64,/i.test(value)) return 'JPEG';
    if (/^data:image\/webp;base64,/i.test(value)) return 'WEBP';
    return 'PNG';
  }

  const CommerceBoletoPixPdf = {
    async gerarLaminaPix(opts = {}) {
      const { conta, empresa, pixProfile, sacado, financeInfo } = opts;
      if (!conta || !empresa || !pixProfile) {
        throw new Error('Dados incompletos para geração da Lâmina PIX.');
      }

      const jsPDF = await loadJsPdf();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      // Margens e Dimensões
      const startX = 15;
      let startY = 15;
      const width = 180;
      
      // Título do documento
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text('LÂMINA DE COBRANÇA PIX', startX, startY + 4);
      
      // Buscar e desenhar a logo do Beneficiário (Tenant)
      let logoDataUrl = '';
      try {
        logoDataUrl = await resolveCompanyLogo(empresa);
      } catch (err) {
        console.warn('Erro ao obter logo para PDF:', err);
      }

      if (logoDataUrl && (logoDataUrl.startsWith('data:image') || logoDataUrl.startsWith('http'))) {
        try {
          doc.addImage(logoDataUrl, getPdfImageFormat(logoDataUrl), startX + width - 35, startY - 2, 35, 14);
        } catch (e) {
          console.warn('Falha ao adicionar imagem da logo no PDF:', e);
        }
      }
      
      // Linha separadora principal
      startY += 14;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(startX, startY, startX + width, startY);
      
      // Cabeçalho - Dados do Beneficiário (Empresa)
      startY += 6;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.text(empresa.name || empresa.nome || 'BENEFICIÁRIO', startX, startY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      
      const cnpj = empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : '';
      const address = empresa.address || empresa.endereco || '';
      const cityState = [empresa.city || empresa.cidade, empresa.state || empresa.estado].filter(Boolean).join(' - ');
      const phone = empresa.phone || empresa.telefone ? `Tel: ${empresa.phone || empresa.telefone}` : '';
      
      const companyDetails = [cnpj, address, cityState, phone].filter(Boolean).join(' | ');
      doc.text(companyDetails, startX, startY + 4);
      
      // Linha divisória
      startY += 8;
      doc.line(startX, startY, startX + width, startY);
      
      // Bloco do Boleto - Grid de Informações
      startY += 6;
      
      // Retângulo contêiner do boleto
      const blockHeight = 60;
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, startY, width, blockHeight, 'F');
      doc.rect(startX, startY, width, blockHeight, 'S');
      
      // Subdivisões internas do grid estilo boleto
      doc.line(startX, startY + 15, startX + width, startY + 15); // Linha Row 1
      doc.line(startX, startY + 30, startX + width, startY + 30); // Linha Row 2
      doc.line(startX + 130, startY + 45, startX + width, startY + 45); // Divisão Juros/Total
      
      // Linha vertical dividindo dados textuais da coluna de valores
      doc.line(startX + 130, startY, startX + 130, startY + blockHeight);
      
      // --- DADOS DINÂMICOS DE JUROS E VALORES ---
      const valorOriginal = Number(financeInfo ? financeInfo.valorOriginal : (conta.valorOriginal || conta.valor || 0));
      const jurosVal = Number(financeInfo ? (financeInfo.jurosAberto + financeInfo.jurosAcumulado) : 0);
      const valorTotal = Number(financeInfo && financeInfo.totalAtualizado > 0 ? financeInfo.totalAtualizado : (conta.valor || valorOriginal));
      const diasAtraso = financeInfo ? (financeInfo.diasAtraso || 0) : 0;
      
      // --- CÉLULA 1: Beneficiário ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('BENEFICIÁRIO', startX + 3, startY + 4);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(empresa.name || empresa.nome || 'BENEFICIÁRIO', startX + 3, startY + 9);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(cnpj ? `CNPJ: ${empresa.cnpj}` : '', startX + 3, startY + 13);
      
      // --- CÉLULA 2: Vencimento (Coluna Valores) ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('DATA DE VENCIMENTO', startX + 133, startY + 4);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const dataVenc = conta.dataVencimento || conta.vencimento || 'N/A';
      const formatData = dataVenc.includes('-') ? dataVenc.split('-').reverse().join('/') : dataVenc;
      doc.text(formatData, startX + 133, startY + 10);
      
      // --- CÉLULA 3: Pagador / Sacado ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('PAGADOR / SACADO', startX + 3, startY + 19);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const sacadoNome = sacado?.name || sacado?.nome || sacado?.nomeCompleto || conta.clienteNome || conta.fornecedorNome || conta.cliente || conta.fornecedor || 'NÃO INFORMADO';
      const sacadoDoc = sacado?.cnpj || sacado?.cpf || sacado?.cnpjCpf || sacado?.documento || conta.clienteDocumento || conta.fornecedorDocumento || '';
      doc.text(`${sacadoNome}${sacadoDoc ? ` (${sacadoDoc})` : ''}`, startX + 3, startY + 24);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const sacadoEnd = sacado?.endereco || sacado?.address || 'Endereço não informado';
      doc.text(sacadoEnd, startX + 3, startY + 28);
      
      // --- CÉLULA 4: Valor do Documento (Coluna Valores) ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('VALOR DO DOCUMENTO', startX + 133, startY + 19);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const valorFormatado = valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      doc.text(valorFormatado, startX + 133, startY + 25);
      
      // --- CÉLULA 5: Demonstrativo / Instruções ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('DEMONSTRATIVO / INSTRUÇÕES DE COBRANÇA', startX + 3, startY + 34);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const refDoc = conta.pedidoNumero || conta.numero || conta.documento || conta.id || '';
      doc.text(`Cobrança ref. Pedido/Fatura #${refDoc}`, startX + 3, startY + 39);
      
      let jurosText = 'Sem juros contratuais cadastrados para esta conta.';
      if (conta.jurosTipo && conta.jurosTipo !== 'none' && Number(conta.jurosTaxa || 0) > 0) {
        const jType = conta.jurosTipo === 'composto' ? 'Composto' : 'Simples';
        jurosText = `Juros ${jType} de ${conta.jurosTaxa}% ao mês.`;
      }
      doc.text(jurosText, startX + 3, startY + 44);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(185, 28, 28); // Vermelho escuro para instrução de atraso
      doc.text(`* Atraso acumulado: ${diasAtraso} dias. Multa de 2% e juros de 1% a.m. se aplicam após vencimento.`, startX + 3, startY + 49);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Beneficiário Final: ${pixProfile.pixFavorecidoCobranca} | Banco: ${pixProfile.pixBancoCobranca}`, startX + 3, startY + 54);
      
      // --- CÉLULA 6: (+) Juros / Multas (Coluna Valores) ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('(+) JUROS / MULTAS', startX + 133, startY + 34);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(jurosVal > 0 ? 185 : 15, jurosVal > 0 ? 28 : 23, jurosVal > 0 ? 28 : 42);
      doc.text(jurosVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), startX + 133, startY + 40);
      
      // --- CÉLULA 7: (=) Valor Cobrado / Atualizado (Coluna Valores) ---
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('(=) VALOR COBRADO / ATUALIZADO', startX + 133, startY + 49);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), startX + 133, startY + 55);
      
      // Área de Pagamento (QR Code PIX e Copia e Cola)
      startY += blockHeight + 10;
      
      // Geração do Payload PIX
      const brCodePayload = window.PixBrCode.buildBrCode({
        pix: pixProfile.pixChaveCobranca,
        tipoPix: pixProfile.pixTipoChaveCobranca,
        favorecido: pixProfile.pixFavorecidoCobranca,
        cidade: empresa.city || empresa.cidade || 'BRASILIA',
        valor: valorTotal,
        txId: String(refDoc).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 25) || 'BOLETOPX'
      });
      
      // Desenhar Retângulo do QR Code
      const qrBoxWidth = 85;
      const qrBoxHeight = 85;
      doc.setFillColor(255, 255, 255);
      doc.rect(startX + 47.5, startY, qrBoxWidth, qrBoxHeight, 'S');
      
      // Gerar e Inserir QR Code
      const qrDataUrl = await generateQrCodeDataUrl(brCodePayload, 250);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', startX + 50, startY + 2.5, 80, 80);
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Erro ao gerar QR Code PIX.', startX + 60, startY + 40);
      }
      
      // Título PIX e instruções abaixo
      startY += qrBoxHeight + 6;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('INSTRUÇÕES DE PAGAMENTO:', startX, startY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('1. Abra o aplicativo do seu banco de preferência.', startX, startY + 4);
      doc.text('2. Selecione a opção pagar com Pix / Escanear QR Code.', startX, startY + 8);
      doc.text('3. Aponte a câmera para o QR Code acima e confirme as informações do favorecido antes de finalizar.', startX, startY + 12);
      
      // Clausulas Jurídicas (SPC/SERASA e Execução CPC)
      startY += 17;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('TERMOS JURÍDICOS E CONDIÇÕES DE COBRANÇA:', startX, startY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      
      const clausula1 = "INSTRUÇÃO DE INADIMPLEMENTO E NEGATIVAÇÃO: O não pagamento deste título até a data de vencimento ensejará a aplicação imediata de multa moratória de 2% e juros de mora de 1% ao mês, calculados pro rata die, conforme art. 406 do Código Civil. Decorrido o prazo de 5 (cinco) dias de atraso, o débito será encaminhado para inclusão definitiva nos órgãos de proteção ao crédito (SPC/SERASA), bem como ao Tabelionato de Protesto de Títulos da comarca, sob amparo da Lei Federal nº 9.492/97, gerando restrição imediata ao crédito do devedor.";
      const splitC1 = doc.splitTextToSize(clausula1, width);
      doc.text(splitC1, startX, startY + 3.5);
      
      const c1Height = splitC1.length * 2.8;
      
      const clausula2 = "DA EXECUÇÃO JUDICIAL E SUCUMBÊNCIA: Restando infrutífera a cobrança amigável após 15 (quinze) dias do vencimento, este documento — vinculado ao respectivo pedido/fatura de venda e comprovante de entrega — ensejará a propositura imediata de Ação Judicial de Cobrança ou Execução de Título, nos termos do art. 784 do Código de Processo Civil (CPC). O devedor responderá integralmente pelas custas processuais, despesas de cartório e honorários advocatícios sucumbenciais fixados em até 20% sobre o valor total atualizado da dívida, conforme art. 85 do CPC, além de sofrer imissão de posse ou penhora online de contas bancárias (SisbaJud).";
      const splitC2 = doc.splitTextToSize(clausula2, width);
      doc.text(splitC2, startX, startY + 3.5 + c1Height + 1.5);
      
      const c2Height = splitC2.length * 2.8;

      // Pix Copia e Cola
      startY += 3.5 + c1Height + 1.5 + c2Height + 4;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('CÓDIGO PIX COPIA E COLA:', startX, startY);
      
      doc.setFont('Courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      
      // Quebrar a string do payload em linhas para caber na página
      const splitPayload = doc.splitTextToSize(brCodePayload, width);
      doc.text(splitPayload, startX, startY + 4);
 
      return doc.output('blob');
    },

    async abrirLaminaPix(opts = {}) {
      try {
        const blob = await this.gerarLaminaPix(opts);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        console.error('Falha ao abrir Lâmina PIX:', err);
        alert('Erro ao gerar PDF da Lâmina PIX: ' + err.message);
      }
    },

    async compartilharLaminaPix(opts = {}) {
      try {
        const blob = await this.gerarLaminaPix(opts);
        const refDoc = opts.conta.pedidoNumero || opts.conta.numero || opts.conta.documento || opts.conta.id || 'fatura';
        const fileName = `Lamina-PIX-${refDoc}.pdf`;
        
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Lâmina de Cobrança PIX #${refDoc}`,
              text: `Olá, segue a lâmina de cobrança PIX para o documento ref. #${refDoc}.`
            });
            return;
          }
        }
        
        // Fallback: Download tradicional
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (err) {
        console.error('Falha ao compartilhar Lâmina PIX:', err);
        alert('Erro ao compartilhar PDF: ' + err.message);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.CommerceBoletoPixPdf = CommerceBoletoPixPdf;
  }
})();
