/**
 * FORMULÁRIO DE LOGIN
 * Interface de autenticação completa e responsiva
 * 
 * @author Sistema de Excelência Firebase
 * @version 4.0.0
 * @created 2024
 */

import authService from '../../services/authService.js';
import { getNotificationSystem } from '../ui/notifications.js';
import { Validator } from '../../utils/validators.js';
import logger from '../../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DO FORMULÁRIO DE LOGIN
// =============================================================================
class LoginForm {
    constructor() {
        this.container = null;
        this.currentMode = 'login'; // 'login', 'register', 'forgot'
        this.validator = new Validator();
        this.notifications = getNotificationSystem();
        this.isLoading = false;
        
        this.initialize();
    }

    /**
     * Inicializa o formulário de login
     */
    initialize() {
        this.createLoginInterface();
        this.setupEventListeners();
        this.setupValidation();
        this.checkAuthState();
        
        logger.success('Formulário de login inicializado', '🔐 LOGIN FORM');
    }

    /**
     * Cria interface de login
     */
    createLoginInterface() {
        // Remove container existente
        const existing = document.getElementById('login-container');
        if (existing) existing.remove();

        const loginHTML = `
            <div id="login-container" class="login-container">
                <div class="login-background">
                    <div class="background-pattern"></div>
                    <div class="background-overlay"></div>
                </div>

                <div class="login-content">
                    <!-- Logo e Header -->
                    <div class="login-header">
                        <div class="login-logo">
                            <span class="logo-icon">🌲</span>
                            <h1 class="logo-text">SisWeb</h1>
                        </div>
                        <p class="login-subtitle">Sistema de Gestão de Madeira</p>
                    </div>

                    <!-- Formulários -->
                    <div class="login-forms">
                        <!-- Formulário de Login -->
                        <form id="login-form" class="auth-form active" novalidate>
                            <h2 class="form-title">Entrar na sua conta</h2>
                            
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <div class="input-group">
                                    <span class="input-icon">📧</span>
                                    <input type="email" 
                                           class="form-control" 
                                           id="login-email"
                                           placeholder="seu@email.com"
                                           required>
                                </div>
                                <div class="invalid-feedback"></div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Senha</label>
                                <div class="input-group">
                                    <span class="input-icon">🔒</span>
                                    <input type="password" 
                                           class="form-control" 
                                           id="login-password"
                                           placeholder="Sua senha"
                                           required>
                                    <button type="button" class="password-toggle" id="toggle-login-password">
                                        <span class="toggle-icon">👁️</span>
                                    </button>
                                </div>
                                <div class="invalid-feedback"></div>
                            </div>

                            <div class="form-options">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="remember-me">
                                    <span class="checkmark"></span>
                                    Lembrar de mim
                                </label>
                                
                                <button type="button" class="link-button" id="show-forgot">
                                    Esqueci minha senha
                                </button>
                            </div>

                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary btn-block" id="btn-login">
                                    <span class="btn-text">Entrar</span>
                                    <span class="btn-spinner" style="display: none;">
                                        <div class="spinner"></div>
                                    </span>
                                </button>

                                <div class="divider">
                                    <span>ou</span>
                                </div>

                                <button type="button" class="btn btn-google btn-block" id="btn-google-login">
                                    <span class="google-icon">🔍</span>
                                    Entrar com Google
                                </button>
                            </div>

                            <div class="form-footer">
                                <p>Não tem uma conta? 
                                    <button type="button" class="link-button" id="show-register">
                                        Criar conta
                                    </button>
                                </p>
                            </div>
                        </form>

                        <!-- Formulário de Registro -->
                        <form id="register-form" class="auth-form" novalidate>
                            <h2 class="form-title">Criar nova conta</h2>
                            
                            <div class="form-group">
                                <label class="form-label">Nome completo</label>
                                <div class="input-group">
                                    <span class="input-icon">👤</span>
                                    <input type="text" 
                                           class="form-control" 
                                           id="register-name"
                                           placeholder="Seu nome completo"
                                           required>
                                </div>
                                <div class="invalid-feedback"></div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <div class="input-group">
                                    <span class="input-icon">📧</span>
                                    <input type="email" 
                                           class="form-control" 
                                           id="register-email"
                                           placeholder="seu@email.com"
                                           required>
                                </div>
                                <div class="invalid-feedback"></div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Senha</label>
                                <div class="input-group">
                                    <span class="input-icon">🔒</span>
                                    <input type="password" 
                                           class="form-control" 
                                           id="register-password"
                                           placeholder="Mínimo 6 caracteres"
                                           required>
                                    <button type="button" class="password-toggle" id="toggle-register-password">
                                        <span class="toggle-icon">👁️</span>
                                    </button>
                                </div>
                                <div class="invalid-feedback"></div>
                                <div class="password-strength" id="password-strength">
                                    <div class="strength-bar">
                                        <div class="strength-fill"></div>
                                    </div>
                                    <div class="strength-text">Digite uma senha</div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Confirmar senha</label>
                                <div class="input-group">
                                    <span class="input-icon">🔒</span>
                                    <input type="password" 
                                           class="form-control" 
                                           id="register-confirm-password"
                                           placeholder="Digite a senha novamente"
                                           required>
                                </div>
                                <div class="invalid-feedback"></div>
                            </div>

                            <div class="form-options">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="agree-terms" required>
                                    <span class="checkmark"></span>
                                    Concordo com os <a href="#" class="link">Termos de Uso</a>
                                </label>
                            </div>

                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary btn-block" id="btn-register">
                                    <span class="btn-text">Criar conta</span>
                                    <span class="btn-spinner" style="display: none;">
                                        <div class="spinner"></div>
                                    </span>
                                </button>
                            </div>

                            <div class="form-footer">
                                <p>Já tem uma conta? 
                                    <button type="button" class="link-button" id="show-login">
                                        Fazer login
                                    </button>
                                </p>
                            </div>
                        </form>

                        <!-- Formulário de Recuperação -->
                        <form id="forgot-form" class="auth-form" novalidate>
                            <h2 class="form-title">Recuperar senha</h2>
                            <p class="form-description">
                                Digite seu email e enviaremos instruções para redefinir sua senha.
                            </p>
                            
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <div class="input-group">
                                    <span class="input-icon">📧</span>
                                    <input type="email" 
                                           class="form-control" 
                                           id="forgot-email"
                                           placeholder="seu@email.com"
                                           required>
                                </div>
                                <div class="invalid-feedback"></div>
                            </div>

                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary btn-block" id="btn-forgot">
                                    <span class="btn-text">Enviar instruções</span>
                                    <span class="btn-spinner" style="display: none;">
                                        <div class="spinner"></div>
                                    </span>
                                </button>
                            </div>

                            <div class="form-footer">
                                <p>Lembrou sua senha? 
                                    <button type="button" class="link-button" id="back-to-login">
                                        Voltar ao login
                                    </button>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Footer -->
                <div class="login-footer">
                    <p>&copy; 2024 SisWeb - Sistema de Gestão de Madeira</p>
                    <div class="footer-links">
                        <a href="#" class="footer-link">Privacidade</a>
                        <a href="#" class="footer-link">Termos</a>
                        <a href="#" class="footer-link">Suporte</a>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', loginHTML);
        this.container = document.getElementById('login-container');
        this.injectStyles();
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Navegação entre formulários
        document.getElementById('show-register')?.addEventListener('click', () => this.showForm('register'));
        document.getElementById('show-login')?.addEventListener('click', () => this.showForm('login'));
        document.getElementById('show-forgot')?.addEventListener('click', () => this.showForm('forgot'));
        document.getElementById('back-to-login')?.addEventListener('click', () => this.showForm('login'));

        // Toggle de senha
        document.getElementById('toggle-login-password')?.addEventListener('click', () => 
            this.togglePassword('login-password', 'toggle-login-password'));
        document.getElementById('toggle-register-password')?.addEventListener('click', () => 
            this.togglePassword('register-password', 'toggle-register-password'));

        // Submissão de formulários
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form')?.addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('forgot-form')?.addEventListener('submit', (e) => this.handleForgotPassword(e));

        // Login com Google
        document.getElementById('btn-google-login')?.addEventListener('click', () => this.handleGoogleLogin());

        // Validação em tempo real
        document.getElementById('register-password')?.addEventListener('input', (e) => 
            this.updatePasswordStrength(e.target.value));

        // Validação de formulários
        ['login-form', 'register-form', 'forgot-form'].forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                form.addEventListener('input', (e) => this.validateField(e.target));
            }
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                const activeForm = document.querySelector('.auth-form.active');
                if (activeForm) {
                    const submitBtn = activeForm.querySelector('button[type="submit"]');
                    submitBtn?.click();
                }
            }
        });
    }

    /**
     * Configura validação
     */
    setupValidation() {
        // Validação de email
        this.validator.addRule('email', {
            required: true,
            email: true,
            message: 'Email válido é obrigatório'
        });

        // Validação de senha
        this.validator.addRule('password', {
            required: true,
            minLength: 6,
            message: 'Senha deve ter pelo menos 6 caracteres'
        });

        // Validação de nome
        this.validator.addRule('name', {
            required: true,
            minLength: 2,
            message: 'Nome completo é obrigatório'
        });
    }

    // =========================================================================
    // MANIPULADORES DE EVENTO
    // =========================================================================

    /**
     * Manipula login
     */
    async handleLogin(e) {
        e.preventDefault();
        
        if (this.isLoading) return;

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me').checked;

        if (!this.validateLoginForm()) return;

        this.setLoading('login', true);

        try {
            const result = await authService.login(email, password, rememberMe);

            if (result.success) {
                this.notifications.success('Login realizado com sucesso!');
                this.hideLoginForm();
            } else {
                this.notifications.error(result.error);
                
                if (result.remainingAttempts !== undefined && result.remainingAttempts > 0) {
                    this.notifications.warning(`Tentativas restantes: ${result.remainingAttempts}`);
                }
            }

        } catch (error) {
            this.notifications.error('Erro interno. Tente novamente.');
            logger.error('Erro no login', '🔐 LOGIN FORM', error);
        } finally {
            this.setLoading('login', false);
        }
    }

    /**
     * Manipula registro
     */
    async handleRegister(e) {
        e.preventDefault();
        
        if (this.isLoading) return;

        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const agreeTerms = document.getElementById('agree-terms').checked;

        if (!this.validateRegisterForm()) return;

        if (password !== confirmPassword) {
            this.showFieldError('register-confirm-password', 'Senhas não coincidem');
            return;
        }

        if (!agreeTerms) {
            this.notifications.warning('Você deve concordar com os termos de uso');
            return;
        }

        this.setLoading('register', true);

        try {
            const result = await authService.register({
                displayName: name,
                email: email,
                password: password,
                role: 'user'
            });

            if (result.success) {
                this.notifications.success('Conta criada com sucesso!');
                this.showForm('login');
            } else {
                this.notifications.error(result.error);
            }

        } catch (error) {
            this.notifications.error('Erro interno. Tente novamente.');
            logger.error('Erro no registro', '🔐 LOGIN FORM', error);
        } finally {
            this.setLoading('register', false);
        }
    }

    /**
     * Manipula recuperação de senha
     */
    async handleForgotPassword(e) {
        e.preventDefault();
        
        if (this.isLoading) return;

        const email = document.getElementById('forgot-email').value.trim();

        if (!this.validateForgotForm()) return;

        this.setLoading('forgot', true);

        try {
            const result = await authService.resetPassword(email);

            if (result.success) {
                this.notifications.success(result.message);
                this.showForm('login');
            } else {
                this.notifications.error(result.error);
            }

        } catch (error) {
            this.notifications.error('Erro interno. Tente novamente.');
            logger.error('Erro na recuperação de senha', '🔐 LOGIN FORM', error);
        } finally {
            this.setLoading('forgot', false);
        }
    }

    /**
     * Manipula login com Google
     */
    async handleGoogleLogin() {
        if (this.isLoading) return;

        try {
            const result = await authService.loginWithGoogle();

            if (result.success) {
                this.notifications.success('Login com Google realizado com sucesso!');
                this.hideLoginForm();
            } else {
                this.notifications.error(result.error);
            }

        } catch (error) {
            this.notifications.error('Erro no login com Google');
            logger.error('Erro no login Google', '🔐 LOGIN FORM', error);
        }
    }

    // =========================================================================
    // MÉTODOS DE INTERFACE
    // =========================================================================

    /**
     * Mostra formulário específico
     */
    showForm(formType) {
        // Remove classe active de todos os formulários
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        // Adiciona classe active ao formulário selecionado
        const targetForm = document.getElementById(`${formType}-form`);
        if (targetForm) {
            targetForm.classList.add('active');
            
            // Foca no primeiro campo
            const firstInput = targetForm.querySelector('input:not([type="checkbox"])');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }

        this.currentMode = formType;
    }

    /**
     * Mostra formulário de login
     */
    showLoginForm() {
        if (this.container) {
            this.container.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Esconde formulário de login
     */
    hideLoginForm() {
        if (this.container) {
            this.container.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    /**
     * Toggle de visibilidade da senha
     */
    togglePassword(inputId, toggleId) {
        const input = document.getElementById(inputId);
        const toggle = document.getElementById(toggleId);
        const icon = toggle?.querySelector('.toggle-icon');

        if (input && icon) {
            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = '🙈';
            } else {
                input.type = 'password';
                icon.textContent = '👁️';
            }
        }
    }

    /**
     * Atualiza força da senha
     */
    updatePasswordStrength(password) {
        const strengthContainer = document.getElementById('password-strength');
        if (!strengthContainer) return;

        const strengthBar = strengthContainer.querySelector('.strength-fill');
        const strengthText = strengthContainer.querySelector('.strength-text');

        let strength = 0;
        let text = '';
        let color = '';

        if (password.length === 0) {
            text = 'Digite uma senha';
            color = '#e9ecef';
        } else if (password.length < 6) {
            strength = 20;
            text = 'Muito fraca';
            color = '#dc3545';
        } else {
            strength = 40;
            text = 'Fraca';
            color = '#fd7e14';

            if (password.length >= 8) {
                strength = 60;
                text = 'Média';
                color = '#ffc107';
            }

            if (/[A-Z]/.test(password)) strength += 10;
            if (/[0-9]/.test(password)) strength += 10;
            if (/[^A-Za-z0-9]/.test(password)) strength += 20;

            if (strength >= 80) {
                text = 'Forte';
                color = '#28a745';
            } else if (strength >= 60) {
                text = 'Boa';
                color = '#20c997';
            }
        }

        strengthBar.style.width = `${strength}%`;
        strengthBar.style.backgroundColor = color;
        strengthText.textContent = text;
        strengthText.style.color = color;
    }

    /**
     * Define estado de carregamento
     */
    setLoading(formType, isLoading) {
        this.isLoading = isLoading;
        
        const button = document.getElementById(`btn-${formType}`);
        const btnText = button?.querySelector('.btn-text');
        const btnSpinner = button?.querySelector('.btn-spinner');

        if (button && btnText && btnSpinner) {
            button.disabled = isLoading;
            btnText.style.display = isLoading ? 'none' : 'inline';
            btnSpinner.style.display = isLoading ? 'inline-flex' : 'none';
        }
    }

    // =========================================================================
    // VALIDAÇÃO
    // =========================================================================

    /**
     * Valida formulário de login
     */
    validateLoginForm() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        let isValid = true;

        if (!email) {
            this.showFieldError('login-email', 'Email é obrigatório');
            isValid = false;
        } else if (!this.validator.isValidEmail(email)) {
            this.showFieldError('login-email', 'Email inválido');
            isValid = false;
        } else {
            this.clearFieldError('login-email');
        }

        if (!password) {
            this.showFieldError('login-password', 'Senha é obrigatória');
            isValid = false;
        } else {
            this.clearFieldError('login-password');
        }

        return isValid;
    }

    /**
     * Valida formulário de registro
     */
    validateRegisterForm() {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        let isValid = true;

        if (!name || name.length < 2) {
            this.showFieldError('register-name', 'Nome completo é obrigatório');
            isValid = false;
        } else {
            this.clearFieldError('register-name');
        }

        if (!email) {
            this.showFieldError('register-email', 'Email é obrigatório');
            isValid = false;
        } else if (!this.validator.isValidEmail(email)) {
            this.showFieldError('register-email', 'Email inválido');
            isValid = false;
        } else {
            this.clearFieldError('register-email');
        }

        if (!password || password.length < 6) {
            this.showFieldError('register-password', 'Senha deve ter pelo menos 6 caracteres');
            isValid = false;
        } else {
            this.clearFieldError('register-password');
        }

        return isValid;
    }

    /**
     * Valida formulário de recuperação
     */
    validateForgotForm() {
        const email = document.getElementById('forgot-email').value.trim();

        if (!email) {
            this.showFieldError('forgot-email', 'Email é obrigatório');
            return false;
        } else if (!this.validator.isValidEmail(email)) {
            this.showFieldError('forgot-email', 'Email inválido');
            return false;
        } else {
            this.clearFieldError('forgot-email');
            return true;
        }
    }

    /**
     * Valida campo individual
     */
    validateField(field) {
        if (!field) return;

        const value = field.value.trim();
        const fieldId = field.id;

        this.clearFieldError(fieldId);

        switch (fieldId) {
            case 'login-email':
            case 'register-email':
            case 'forgot-email':
                if (value && !this.validator.isValidEmail(value)) {
                    this.showFieldError(fieldId, 'Email inválido');
                }
                break;
                
            case 'register-password':
                if (value && value.length < 6) {
                    this.showFieldError(fieldId, 'Senha deve ter pelo menos 6 caracteres');
                }
                break;
                
            case 'register-confirm-password':
                const password = document.getElementById('register-password').value;
                if (value && value !== password) {
                    this.showFieldError(fieldId, 'Senhas não coincidem');
                }
                break;
        }
    }

    /**
     * Mostra erro no campo
     */
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const feedback = field?.closest('.form-group')?.querySelector('.invalid-feedback');
        
        if (field && feedback) {
            field.classList.add('is-invalid');
            feedback.textContent = message;
        }
    }

    /**
     * Limpa erro do campo
     */
    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const feedback = field?.closest('.form-group')?.querySelector('.invalid-feedback');
        
        if (field && feedback) {
            field.classList.remove('is-invalid');
            feedback.textContent = '';
        }
    }

    // =========================================================================
    // ESTADO DE AUTENTICAÇÃO
    // =========================================================================

    /**
     * Verifica estado de autenticação
     */
    checkAuthState() {
        authService.onAuthStateChange((event, user) => {
            if (event === 'login') {
                this.hideLoginForm();
            } else if (event === 'logout') {
                this.showLoginForm();
            }
        });

        // Mostra login se não estiver autenticado
        if (!authService.isLoggedIn()) {
            this.showLoginForm();
        }
    }

    /**
     * Injeta estilos CSS
     */
    injectStyles() {
        if (document.getElementById('login-form-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'login-form-styles';
        styles.textContent = `
            .login-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .login-background {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }

            .background-pattern {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: 
                    radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%);
                background-size: 100px 100px;
                animation: float 20s ease-in-out infinite;
            }

            .background-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.2);
            }

            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-20px); }
            }

            .login-content {
                position: relative;
                background: white;
                border-radius: 20px;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25);
                width: 100%;
                max-width: 400px;
                max-height: 90vh;
                overflow-y: auto;
                margin: 20px;
            }

            .login-header {
                text-align: center;
                padding: 40px 40px 20px;
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white;
                border-radius: 20px 20px 0 0;
            }

            .login-logo {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 10px;
            }

            .logo-icon {
                font-size: 2.5rem;
                margin-right: 10px;
            }

            .logo-text {
                font-size: 2rem;
                font-weight: 700;
                margin: 0;
            }

            .login-subtitle {
                margin: 0;
                opacity: 0.9;
                font-size: 0.95rem;
            }

            .login-forms {
                padding: 40px;
                position: relative;
            }

            .auth-form {
                display: none;
            }

            .auth-form.active {
                display: block;
                animation: slideIn 0.3s ease-out;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .form-title {
                text-align: center;
                margin-bottom: 30px;
                color: #2c3e50;
                font-size: 1.5rem;
                font-weight: 600;
            }

            .form-description {
                text-align: center;
                color: #6c757d;
                margin-bottom: 30px;
                font-size: 0.9rem;
                line-height: 1.5;
            }

            .form-group {
                margin-bottom: 20px;
            }

            .form-label {
                display: block;
                margin-bottom: 8px;
                color: #2c3e50;
                font-weight: 500;
                font-size: 0.9rem;
            }

            .input-group {
                position: relative;
                display: flex;
                align-items: center;
            }

            .input-icon {
                position: absolute;
                left: 15px;
                z-index: 2;
                font-size: 1rem;
                opacity: 0.7;
            }

            .form-control {
                width: 100%;
                padding: 15px 15px 15px 45px;
                border: 2px solid #e9ecef;
                border-radius: 10px;
                font-size: 1rem;
                transition: all 0.3s ease;
                background: #f8f9fa;
            }

            .form-control:focus {
                outline: none;
                border-color: #28a745;
                background: white;
                box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
            }

            .form-control.is-invalid {
                border-color: #dc3545;
                background: #fff5f5;
            }

            .password-toggle {
                position: absolute;
                right: 15px;
                background: none;
                border: none;
                cursor: pointer;
                font-size: 1rem;
                opacity: 0.7;
                transition: opacity 0.2s;
                z-index: 2;
            }

            .password-toggle:hover {
                opacity: 1;
            }

            .invalid-feedback {
                display: block;
                color: #dc3545;
                font-size: 0.85rem;
                margin-top: 5px;
            }

            .password-strength {
                margin-top: 8px;
            }

            .strength-bar {
                height: 4px;
                background: #e9ecef;
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 5px;
            }

            .strength-fill {
                height: 100%;
                transition: all 0.3s ease;
                border-radius: 2px;
            }

            .strength-text {
                font-size: 0.8rem;
                font-weight: 500;
            }

            .form-options {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
            }

            .checkbox-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 0.9rem;
                color: #6c757d;
                position: relative;
            }

            .checkbox-label input[type="checkbox"] {
                position: absolute;
                opacity: 0;
            }

            .checkmark {
                width: 18px;
                height: 18px;
                border: 2px solid #e9ecef;
                border-radius: 4px;
                margin-right: 8px;
                position: relative;
                transition: all 0.2s;
            }

            .checkbox-label input[type="checkbox"]:checked + .checkmark {
                background: #28a745;
                border-color: #28a745;
            }

            .checkbox-label input[type="checkbox"]:checked + .checkmark::after {
                content: '✓';
                position: absolute;
                top: -2px;
                left: 2px;
                color: white;
                font-size: 12px;
                font-weight: bold;
            }

            .link-button {
                background: none;
                border: none;
                color: #28a745;
                cursor: pointer;
                font-size: 0.9rem;
                text-decoration: none;
                transition: color 0.2s;
            }

            .link-button:hover {
                color: #1e7e34;
                text-decoration: underline;
            }

            .form-actions {
                margin-bottom: 30px;
            }

            .btn {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 15px 20px;
                border: none;
                border-radius: 10px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                position: relative;
            }

            .btn-block {
                width: 100%;
            }

            .btn-primary {
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white;
            }

            .btn-primary:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);
            }

            .btn-primary:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }

            .btn-google {
                background: white;
                color: #5f6368;
                border: 2px solid #e9ecef;
                margin-top: 15px;
            }

            .btn-google:hover {
                border-color: #dadce0;
                background: #f8f9fa;
            }

            .google-icon {
                margin-right: 10px;
                font-size: 1.2rem;
            }

            .btn-spinner {
                display: inline-flex;
                align-items: center;
            }

            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .divider {
                text-align: center;
                margin: 20px 0;
                position: relative;
                color: #6c757d;
            }

            .divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: #e9ecef;
            }

            .divider span {
                background: white;
                padding: 0 15px;
                position: relative;
            }

            .form-footer {
                text-align: center;
                color: #6c757d;
                font-size: 0.9rem;
            }

            .form-footer p {
                margin: 0;
            }

            .link {
                color: #28a745;
                text-decoration: none;
            }

            .link:hover {
                text-decoration: underline;
            }

            .login-footer {
                text-align: center;
                padding: 20px;
                color: white;
                font-size: 0.8rem;
            }

            .login-footer p {
                margin: 0 0 10px 0;
                opacity: 0.8;
            }

            .footer-links {
                display: flex;
                justify-content: center;
                gap: 20px;
            }

            .footer-link {
                color: white;
                text-decoration: none;
                opacity: 0.8;
                transition: opacity 0.2s;
            }

            .footer-link:hover {
                opacity: 1;
                text-decoration: underline;
            }

            /* Responsive */
            @media (max-width: 480px) {
                .login-content {
                    margin: 10px;
                    border-radius: 15px;
                }

                .login-header {
                    padding: 30px 30px 15px;
                    border-radius: 15px 15px 0 0;
                }

                .logo-icon {
                    font-size: 2rem;
                }

                .logo-text {
                    font-size: 1.75rem;
                }

                .login-forms {
                    padding: 30px 25px;
                }

                .form-title {
                    font-size: 1.3rem;
                }

                .form-options {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 15px;
                }
            }
        `;

        document.head.appendChild(styles);
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
let loginFormInstance = null;

function initializeLoginForm() {
    if (!loginFormInstance) {
        loginFormInstance = new LoginForm();
    }
    return loginFormInstance;
}

function getLoginForm() {
    if (!loginFormInstance) {
        return initializeLoginForm();
    }
    return loginFormInstance;
}

// Auto-inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeLoginForm();
});

export default LoginForm;
export { initializeLoginForm, getLoginForm }; 