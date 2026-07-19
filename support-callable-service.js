const SUPPORT_FUNCTIONS_COMPAT_SRC = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js';
let functionsCompatPromise = null;

function ensureFunctionsCompat() {
    if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.functions === 'function') {
        return Promise.resolve(window.firebase);
    }
    if (functionsCompatPromise) return functionsCompatPromise;
    functionsCompatPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${SUPPORT_FUNCTIONS_COMPAT_SRC}"]`);
        const finish = () => {
            if (window.firebase && typeof window.firebase.functions === 'function') resolve(window.firebase);
            else reject(new Error('Firebase Functions não configurado.'));
        };
        if (existing) {
            existing.addEventListener('load', finish, { once: true });
            existing.addEventListener('error', () => reject(new Error('Falha ao carregar Firebase Functions.')), { once: true });
            if (window.firebase && typeof window.firebase.functions === 'function') finish();
            return;
        }
        const script = document.createElement('script');
        script.src = SUPPORT_FUNCTIONS_COMPAT_SRC;
        script.defer = true;
        script.addEventListener('load', finish, { once: true });
        script.addEventListener('error', () => reject(new Error('Falha ao carregar Firebase Functions.')), { once: true });
        document.head.appendChild(script);
    }).catch((error) => {
        functionsCompatPromise = null;
        throw error;
    });
    return functionsCompatPromise;
}

async function callSupportFunction(functionName, payload = {}) {
    try {
        const firebase = await ensureFunctionsCompat();
        const callable = firebase.functions('us-central1').httpsCallable(functionName);
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
