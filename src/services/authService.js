/**
 * SERVIÇO DE AUTENTICAÇÃO FIREBASE
 * Sistema completo de autenticação e controle de acesso
 * 
 * @author Sistema de Excelência Firebase
 * @version 4.0.0
 * @created 2024
 */

import { 
    auth, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    updatePassword,
    deleteUser,
    GoogleAuthProvider,
    signInWithPopup
} from '../constants/app-constants.js';
import stateManager, { EVENT_TYPES } from './stateManager.js';
import logger from '../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DE AUTENTICAÇÃO
// =============================================================================
class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.userPermissions = [];
        this.authStateListeners = [];
        this.loginAttempts = 0;
        this.maxLoginAttempts = 5;
        this.lockoutTime = 15 * 60 * 1000; // 15 minutos
        this.lockoutUntil = null;
        
        this.initialize();
    }

    /**
     * Inicializa o serviço de autenticação
     */
    initialize() {
        this.setupAuthStateListener();
        this.loadUserFromStorage();
        
        logger.success('Serviço de autenticação inicializado', '🔐 AUTH');
    }

    /**
     * Configura listener de estado de autenticação
     */
    setupAuthStateListener() {
        if (auth) {
            onAuthStateChanged(auth, (user) => {
                this.handleAuthStateChange(user);
            });
        }
    }

    /**
     * Manipula mudanças no estado de autenticação
     */
    async handleAuthStateChange(user) {
        try {
            if (user) {
                await this.setCurrentUser(user);
                this.isAuthenticated = true;
                this.saveUserToStorage();
                
                // Notifica sobre login
                this.notifyAuthStateListeners('login', this.currentUser);
                stateManager.emit(EVENT_TYPES.USER_LOGGED_IN, this.currentUser);
                
                logger.success(`Usuário logado: ${user.email}`, '🔐 AUTH');
            } else {
                this.clearCurrentUser();
                this.isAuthenticated = false;
                this.clearUserFromStorage();
                
                // Notifica sobre logout
                this.notifyAuthStateListeners('logout', null);
                stateManager.emit(EVENT_TYPES.USER_LOGGED_OUT);
                
                logger.info('Usuário deslogado', '🔐 AUTH');
            }
        } catch (error) {
            logger.error('Erro ao processar mudança de estado de autenticação', '🔐 AUTH', error);
        }
    }

    // =========================================================================
    // MÉTODOS DE AUTENTICAÇÃO
    // =========================================================================

    /**
     * Faz login com email e senha
     */
    async login(email, password, rememberMe = false) {
        try {
            // Verifica bloqueio por tentativas
            if (this.isAccountLocked()) {
                const remainingTime = Math.ceil((this.lockoutUntil - Date.now()) / 1000 / 60);
                throw new Error(`Conta bloqueada. Tente novamente em ${remainingTime} minutos.`);
            }

            logger.startPerformance('user_login');
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Reset contador de tentativas
            this.loginAttempts = 0;
            this.lockoutUntil = null;
            
            // Configura persistência
            if (rememberMe) {
                localStorage.setItem('sisweb_remember_user', 'true');
            }

            logger.endPerformance('user_login');
            logger.success(`Login realizado com sucesso: ${email}`, '🔐 AUTH');
            
            return {
                success: true,
                user: this.formatUserData(user),
                message: 'Login realizado com sucesso!'
            };

        } catch (error) {
            logger.endPerformance('user_login');
            
            // Incrementa contador de tentativas
            this.loginAttempts++;
            
            if (this.loginAttempts >= this.maxLoginAttempts) {
                this.lockoutUntil = Date.now() + this.lockoutTime;
                logger.warn(`Conta bloqueada após ${this.maxLoginAttempts} tentativas`, '🔐 AUTH');
            }

            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro no login: ${errorMessage}`, '🔐 AUTH', error);
            
            return {
                success: false,
                error: errorMessage,
                remainingAttempts: Math.max(0, this.maxLoginAttempts - this.loginAttempts)
            };
        }
    }

    /**
     * Registra novo usuário
     */
    async register(userData) {
        try {
            logger.startPerformance('user_register');
            
            const { email, password, displayName, role = 'user' } = userData;
            
            // Cria usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Atualiza perfil do usuário
            await updateProfile(user, {
                displayName: displayName
            });

            // Salva dados adicionais no Firestore
            await this.saveUserProfile(user.uid, {
                email,
                displayName,
                role,
                createdAt: new Date().toISOString(),
                isActive: true,
                permissions: this.getDefaultPermissions(role)
            });

            logger.endPerformance('user_register');
            logger.success(`Usuário registrado: ${email}`, '🔐 AUTH');
            
            return {
                success: true,
                user: this.formatUserData(user),
                message: 'Conta criada com sucesso!'
            };

        } catch (error) {
            logger.endPerformance('user_register');
            
            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro no registro: ${errorMessage}`, '🔐 AUTH', error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Login com Google
     */
    async loginWithGoogle() {
        try {
            logger.startPerformance('google_login');
            
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;

            // Verifica se é primeiro login
            const isNewUser = userCredential.additionalUserInfo?.isNewUser;
            
            if (isNewUser) {
                // Salva dados do novo usuário
                await this.saveUserProfile(user.uid, {
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: 'user',
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    permissions: this.getDefaultPermissions('user'),
                    provider: 'google'
                });
            }

            logger.endPerformance('google_login');
            logger.success(`Login Google realizado: ${user.email}`, '🔐 AUTH');
            
            return {
                success: true,
                user: this.formatUserData(user),
                message: 'Login com Google realizado com sucesso!'
            };

        } catch (error) {
            logger.endPerformance('google_login');
            
            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro no login Google: ${errorMessage}`, '🔐 AUTH', error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Logout do usuário
     */
    async logout() {
        try {
            await signOut(auth);
            localStorage.removeItem('sisweb_remember_user');
            
            logger.success('Logout realizado com sucesso', '🔐 AUTH');
            
            return {
                success: true,
                message: 'Logout realizado com sucesso!'
            };

        } catch (error) {
            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro no logout: ${errorMessage}`, '🔐 AUTH', error);
            // ✅ Tratamento resiliente: realizar cleanup local mesmo com erro de rede
            try {
                this.clearCurrentUser();
                this.isAuthenticated = false;
                this.clearUserFromStorage();
                this.notifyAuthStateListeners('logout', null);
                stateManager.emit(EVENT_TYPES.USER_LOGGED_OUT);
                logger.info('Logout local concluído (rede indisponível)', '🔐 AUTH');
            } catch (e) { logger.error('Falha no cleanup local após erro de logout', '🔐 AUTH', e); }
            return {
                success: true,
                message: 'Logout local concluído (rede indisponível).'
            };
        }
    }

    /**
     * Recuperação de senha
     */
    async resetPassword(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            
            logger.success(`Email de recuperação enviado para: ${email}`, '🔐 AUTH');
            
            return {
                success: true,
                message: 'Email de recuperação enviado! Verifique sua caixa de entrada.'
            };

        } catch (error) {
            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro na recuperação de senha: ${errorMessage}`, '🔐 AUTH', error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    // =========================================================================
    // GERENCIAMENTO DE USUÁRIO
    // =========================================================================

    /**
     * Atualiza perfil do usuário
     */
    async updateUserProfile(profileData) {
        try {
            if (!this.currentUser) {
                throw new Error('Usuário não autenticado');
            }

            const user = auth.currentUser;
            
            // Atualiza dados no Firebase Auth
            if (profileData.displayName) {
                await updateProfile(user, {
                    displayName: profileData.displayName
                });
            }

            // Atualiza dados no Firestore
            await this.saveUserProfile(user.uid, {
                ...profileData,
                updatedAt: new Date().toISOString()
            });

            // Atualiza dados locais
            await this.setCurrentUser(user);

            logger.success('Perfil atualizado com sucesso', '🔐 AUTH');
            
            return {
                success: true,
                message: 'Perfil atualizado com sucesso!'
            };

        } catch (error) {
            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro ao atualizar perfil: ${errorMessage}`, '🔐 AUTH', error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Altera senha do usuário
     */
    async changePassword(newPassword) {
        try {
            if (!auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }

            await updatePassword(auth.currentUser, newPassword);
            
            logger.success('Senha alterada com sucesso', '🔐 AUTH');
            
            return {
                success: true,
                message: 'Senha alterada com sucesso!'
            };

        } catch (error) {
            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro ao alterar senha: ${errorMessage}`, '🔐 AUTH', error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Exclui conta do usuário
     */
    async deleteAccount() {
        try {
            if (!auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }

            const user = auth.currentUser;
            
            // Remove dados do Firestore
            await this.deleteUserProfile(user.uid);
            
            // Exclui conta do Firebase Auth
            await deleteUser(user);
            
            logger.success('Conta excluída com sucesso', '🔐 AUTH');
            
            return {
                success: true,
                message: 'Conta excluída com sucesso!'
            };

        } catch (error) {
            const errorMessage = this.getAuthErrorMessage(error);
            logger.error(`Erro ao excluir conta: ${errorMessage}`, '🔐 AUTH', error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    // =========================================================================
    // CONTROLE DE ACESSO E PERMISSÕES
    // =========================================================================

    /**
     * Verifica se usuário tem permissão
     */
    hasPermission(permission) {
        if (!this.isAuthenticated || !this.currentUser) {
            return false;
        }

        // Administradores têm todas as permissões
        if (this.currentUser.role === 'admin') {
            return true;
        }

        return this.userPermissions.includes(permission);
    }

    /**
     * Verifica se usuário tem papel específico
     */
    hasRole(role) {
        return this.isAuthenticated && this.currentUser?.role === role;
    }

    /**
     * Obtém permissões padrão por papel
     */
    getDefaultPermissions(role) {
        const permissions = {
            admin: [
                'create_romaneio', 'edit_romaneio', 'delete_romaneio', 'view_romaneio',
                'create_fornecedor', 'edit_fornecedor', 'delete_fornecedor', 'view_fornecedor',
                'create_especie', 'edit_especie', 'delete_especie', 'view_especie',
                'view_dashboard', 'export_data', 'manage_users', 'view_reports'
            ],
            manager: [
                'create_romaneio', 'edit_romaneio', 'view_romaneio',
                'create_fornecedor', 'edit_fornecedor', 'view_fornecedor',
                'create_especie', 'edit_especie', 'view_especie',
                'view_dashboard', 'export_data', 'view_reports'
            ],
            user: [
                'create_romaneio', 'edit_romaneio', 'view_romaneio',
                'view_fornecedor', 'view_especie', 'view_dashboard'
            ],
            viewer: [
                'view_romaneio', 'view_fornecedor', 'view_especie', 'view_dashboard'
            ]
        };

        return permissions[role] || permissions.viewer;
    }

    // =========================================================================
    // MÉTODOS DE UTILIDADE
    // =========================================================================

    /**
     * Define usuário atual
     */
    async setCurrentUser(user) {
        this.currentUser = this.formatUserData(user);
        
        // Carrega permissões do usuário
        const userProfile = await this.getUserProfile(user.uid);
        if (userProfile) {
            this.currentUser = { ...this.currentUser, ...userProfile };
            this.userPermissions = userProfile.permissions || this.getDefaultPermissions(userProfile.role || 'user');
        }
    }

    /**
     * Limpa usuário atual
     */
    clearCurrentUser() {
        this.currentUser = null;
        this.userPermissions = [];
    }

    /**
     * Formata dados do usuário
     */
    formatUserData(user) {
        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            createdAt: user.metadata?.creationTime,
            lastLoginAt: user.metadata?.lastSignInTime
        };
    }

    /**
     * Verifica se conta está bloqueada
     */
    isAccountLocked() {
        return this.lockoutUntil && Date.now() < this.lockoutUntil;
    }

    /**
     * Obtém mensagem de erro amigável
     */
    getAuthErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'Usuário não encontrado',
            'auth/wrong-password': 'Senha incorreta',
            'auth/email-already-in-use': 'Email já está em uso',
            'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres)',
            'auth/invalid-email': 'Email inválido',
            'auth/user-disabled': 'Conta desativada',
            'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
            'auth/network-request-failed': 'Erro de conexão com a internet',
            'auth/popup-closed-by-user': 'Login cancelado pelo usuário',
            'auth/requires-recent-login': 'É necessário fazer login novamente para esta operação'
        };

        return errorMessages[error.code] || error.message || 'Erro desconhecido';
    }

    // =========================================================================
    // PERSISTÊNCIA E STORAGE
    // =========================================================================

    /**
     * Salva perfil do usuário no Firestore
     */
    async saveUserProfile(uid, profileData) {
        try {
            await stateManager.firebaseService.save('users', profileData, uid);
        } catch (error) {
            logger.error('Erro ao salvar perfil do usuário', '🔐 AUTH', error);
        }
    }

    /**
     * Obtém perfil do usuário do Firestore
     */
    async getUserProfile(uid) {
        try {
            return await stateManager.firebaseService.get('users', uid);
        } catch (error) {
            logger.error('Erro ao obter perfil do usuário', '🔐 AUTH', error);
            return null;
        }
    }

    /**
     * Exclui perfil do usuário do Firestore
     */
    async deleteUserProfile(uid) {
        try {
            await stateManager.firebaseService.delete('users', uid);
        } catch (error) {
            logger.error('Erro ao excluir perfil do usuário', '🔐 AUTH', error);
        }
    }

    /**
     * Salva usuário no localStorage
     */
    saveUserToStorage() {
        if (this.currentUser) {
            localStorage.setItem('sisweb_user', JSON.stringify(this.currentUser));
        }
    }

    /**
     * Carrega usuário do localStorage
     */
    loadUserFromStorage() {
        try {
            const userData = localStorage.getItem('sisweb_user');
            if (userData && localStorage.getItem('sisweb_remember_user')) {
                this.currentUser = JSON.parse(userData);
                this.isAuthenticated = true;
            }
        } catch (error) {
            logger.error('Erro ao carregar usuário do storage', '🔐 AUTH', error);
        }
    }

    /**
     * Remove usuário do localStorage
     */
    clearUserFromStorage() {
        localStorage.removeItem('sisweb_user');
        localStorage.removeItem('sisweb_remember_user');
    }

    // =========================================================================
    // LISTENERS E EVENTOS
    // =========================================================================

    /**
     * Adiciona listener de estado de autenticação
     */
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
        
        // Chama imediatamente se já estiver autenticado
        if (this.isAuthenticated) {
            callback('login', this.currentUser);
        }
    }

    /**
     * Remove listener de estado de autenticação
     */
    offAuthStateChange(callback) {
        const index = this.authStateListeners.indexOf(callback);
        if (index > -1) {
            this.authStateListeners.splice(index, 1);
        }
    }

    /**
     * Notifica listeners sobre mudanças
     */
    notifyAuthStateListeners(event, user) {
        this.authStateListeners.forEach(callback => {
            try {
                callback(event, user);
            } catch (error) {
                logger.error('Erro em listener de autenticação', '🔐 AUTH', error);
            }
        });
    }

    // =========================================================================
    // GETTERS
    // =========================================================================

    /**
     * Obtém usuário atual
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Verifica se está autenticado
     */
    isLoggedIn() {
        return this.isAuthenticated && this.currentUser !== null;
    }

    /**
     * Obtém permissões do usuário
     */
    getUserPermissions() {
        return [...this.userPermissions];
    }

    /**
     * Obtém papel do usuário
     */
    getUserRole() {
        return this.currentUser?.role || 'viewer';
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const authService = new AuthService();

// Disponibiliza globalmente
window.authService = authService;

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default authService;

export const {
    login,
    register,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    changePassword,
    deleteAccount,
    hasPermission,
    hasRole,
    getCurrentUser,
    isLoggedIn,
    getUserPermissions,
    getUserRole,
    onAuthStateChange,
    offAuthStateChange
} = authService;