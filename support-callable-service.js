import { functions, httpsCallable } from './firebase-init.js';

async function callSupportFunction(functionName, payload = {}) {
    try {
        if (!functions) throw new Error('Firebase Functions não configurado.');
        const callable = httpsCallable(functions, functionName);
        const result = await callable(payload && typeof payload === 'object' ? payload : {});
        return { success: true, data: result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : null };
    } catch (error) {
        const rawMessage = String(error && error.message ? error.message : error || '');
        const lower = rawMessage.toLowerCase();
        if (lower.includes('not found') || lower.includes('404')) {
            return { success: false, error: `Cloud Function '${functionName}' não encontrada.` };
        }
        if (lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('network')) {
            return { success: false, error: `Falha de rede ao chamar '${functionName}'.` };
        }
        return { success: false, error: rawMessage || `Falha ao chamar '${functionName}'.` };
    }
}

const supportCallableService = Object.freeze({
    createSupportTicket: (payload) => callSupportFunction('createSupportTicket', payload),
    sendPublicSupportEmail: (payload) => callSupportFunction('sendPublicSupportEmail', payload),
    addSupportTicketMessage: (ticketId, message, options = {}) => callSupportFunction('addSupportTicketMessage', {
        ...(options && typeof options === 'object' ? options : {}),
        ticketId,
        message
    }),
    listMySupportTickets: (options = {}) => callSupportFunction('listMySupportTickets', options),
    getSupportTicket: (ticketId, options = {}) => callSupportFunction('getSupportTicket', {
        ...(options && typeof options === 'object' ? options : {}),
        ticketId
    }),
    updateSupportTicketStatus: (ticketId, payload = {}) => callSupportFunction('updateSupportTicketStatus', {
        ...(payload && typeof payload === 'object' ? payload : {}),
        ticketId
    })
});

export function getSupportCallableService() {
    return supportCallableService;
}

export default supportCallableService;
