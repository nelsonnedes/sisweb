(() => {
    const messages = Object.freeze({
        'romaneio.confirm.delete': 'Tem certeza que deseja excluir este romaneio?',
        'romaneio.confirm.duplicate_lancamento': 'Este romaneio já foi lançado em Contas a Receber. Deseja criar uma nova conta a receber?',
        'romaneio.success.delete': 'Romaneio excluído com sucesso.',
        'romaneio.success.lancar_contas_receber': 'Conta a receber lançada com sucesso.',
        'romaneio.warning.already_lancado_edit_blocked': 'Este romaneio já foi lançado em Contas a Receber. Para editar, cancele primeiro o lançamento.',
        'romaneio.error.not_found': 'Romaneio não encontrado.',
        'romaneio.error.cliente_missing': 'Cliente não informado no romaneio.',
        'romaneio.error.valor_invalido': 'Valor do romaneio inválido.',
        'romaneio.error.delete_failed': 'Não foi possível excluir o romaneio.',
        'romaneio.error.print_unavailable': 'Funcionalidade de impressão não disponível.',
        'romaneio.error.edit_unavailable': 'Funcionalidade de edição não disponível.',
        'romaneio.warning.lancar_contas_receber_failed_prefix': 'Não foi possível lançar contas a receber: '
    });

    function getMessage(key, fallback = '') {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) return String(fallback || '');
        const value = messages[normalizedKey];
        if (typeof value === 'string' && value.trim()) return value;
        return String(fallback || '');
    }

    window.RomaneioMessages = messages;
    window.getRomaneioMessage = getMessage;
})();
