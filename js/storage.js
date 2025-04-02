/**
 * Sistema de armazenamento de dados com Firebase Firestore
 * Funções para salvar, recuperar, atualizar e excluir dados
 */

import { db } from './firebase-config.js';
import { 
    doc, 
    collection, 
    addDoc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Salva um documento em uma coleção
 * @param {string} collectionName - Nome da coleção
 * @param {Object} data - Dados a serem salvos
 * @param {string} [docId] - ID do documento (opcional)
 * @returns {Promise<string>} ID do documento salvo
 */
async function saveDocument(collectionName, data, docId = null) {
    try {
        // Adicionar timestamp de criação
        const dataWithTimestamp = {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        let docRef;
        
        // Se ID foi fornecido, usar setDoc, senão usar addDoc
        if (docId) {
            docRef = doc(db, collectionName, docId);
            await setDoc(docRef, dataWithTimestamp);
            return docId;
        } else {
            docRef = await addDoc(collection(db, collectionName), dataWithTimestamp);
            return docRef.id;
        }
    } catch (error) {
        console.error(`Erro ao salvar documento na coleção ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Atualiza um documento existente
 * @param {string} collectionName - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {Object} data - Dados a serem atualizados
 * @returns {Promise<boolean>} Sucesso ou falha
 */
async function updateDocument(collectionName, docId, data) {
    try {
        const docRef = doc(db, collectionName, docId);
        
        // Adicionar timestamp de atualização
        const dataWithTimestamp = {
            ...data,
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(docRef, dataWithTimestamp);
        return true;
    } catch (error) {
        console.error(`Erro ao atualizar documento ${docId} na coleção ${collectionName}:`, error);
        return false;
    }
}

/**
 * Recupera um documento pelo ID
 * @param {string} collectionName - Nome da coleção
 * @param {string} docId - ID do documento
 * @returns {Promise<Object|null>} Dados do documento ou null
 */
async function getDocument(collectionName, docId) {
    try {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Erro ao recuperar documento ${docId} da coleção ${collectionName}:`, error);
        return null;
    }
}

/**
 * Remove um documento
 * @param {string} collectionName - Nome da coleção
 * @param {string} docId - ID do documento
 * @returns {Promise<boolean>} Sucesso ou falha
 */
async function deleteDocument(collectionName, docId) {
    try {
        await deleteDoc(doc(db, collectionName, docId));
        return true;
    } catch (error) {
        console.error(`Erro ao excluir documento ${docId} da coleção ${collectionName}:`, error);
        return false;
    }
}

/**
 * Recupera todos os documentos de uma coleção
 * @param {string} collectionName - Nome da coleção
 * @param {Object} [options] - Opções de consulta
 * @param {Array} [options.orderByField] - Campo para ordenação
 * @param {string} [options.orderDirection] - Direção da ordenação ('asc' ou 'desc')
 * @param {number} [options.limitTo] - Limite de documentos
 * @returns {Promise<Array>} Array de documentos
 */
async function getAllDocuments(collectionName, options = {}) {
    try {
        let q = collection(db, collectionName);
        
        // Aplicar ordenação
        if (options.orderByField) {
            q = query(q, orderBy(options.orderByField, options.orderDirection || 'asc'));
        }
        
        // Aplicar limite
        if (options.limitTo) {
            q = query(q, limit(options.limitTo));
        }
        
        const querySnapshot = await getDocs(q);
        const documents = [];
        
        querySnapshot.forEach((doc) => {
            documents.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return documents;
    } catch (error) {
        console.error(`Erro ao recuperar documentos da coleção ${collectionName}:`, error);
        return [];
    }
}

/**
 * Consulta documentos com filtros
 * @param {string} collectionName - Nome da coleção
 * @param {Array} filters - Array de filtros [{field, operator, value}]
 * @param {Object} [options] - Opções de consulta (mesmo de getAllDocuments)
 * @returns {Promise<Array>} Array de documentos
 */
async function queryDocuments(collectionName, filters = [], options = {}) {
    try {
        let q = collection(db, collectionName);
        
        // Aplicar filtros
        filters.forEach(filter => {
            q = query(q, where(filter.field, filter.operator, filter.value));
        });
        
        // Aplicar ordenação
        if (options.orderByField) {
            q = query(q, orderBy(options.orderByField, options.orderDirection || 'asc'));
        }
        
        // Aplicar limite
        if (options.limitTo) {
            q = query(q, limit(options.limitTo));
        }
        
        // Aplicar paginação
        if (options.startAfterDoc) {
            q = query(q, startAfter(options.startAfterDoc));
        }
        
        const querySnapshot = await getDocs(q);
        const documents = [];
        
        querySnapshot.forEach((doc) => {
            documents.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return documents;
    } catch (error) {
        console.error(`Erro ao consultar documentos na coleção ${collectionName}:`, error);
        return [];
    }
}

/**
 * Verifica se um documento existe
 * @param {string} collectionName - Nome da coleção
 * @param {string} docId - ID do documento
 * @returns {Promise<boolean>} true se o documento existe
 */
async function documentExists(collectionName, docId) {
    try {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error(`Erro ao verificar existência do documento ${docId} na coleção ${collectionName}:`, error);
        return false;
    }
}

/**
 * Verifica se um documento com determinado campo/valor existe
 * @param {string} collectionName - Nome da coleção
 * @param {string} field - Campo a ser verificado
 * @param {any} value - Valor a ser comparado
 * @returns {Promise<boolean>} true se o documento existe
 */
async function documentExistsByField(collectionName, field, value) {
    try {
        const q = query(collection(db, collectionName), where(field, '==', value), limit(1));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error(`Erro ao verificar existência de documento com ${field}=${value} na coleção ${collectionName}:`, error);
        return false;
    }
}

// Exportar funções
export {
    saveDocument,
    updateDocument,
    getDocument,
    deleteDocument,
    getAllDocuments,
    queryDocuments,
    documentExists,
    documentExistsByField
};