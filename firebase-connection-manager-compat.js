/**
 * 🔥 Firebase Connection Manager (Compat)
 * Gerenciador singleton para conexões Firebase usando SDK compat (v9 compat)
 * - Monitora .info/connected
 * - Emite eventos: connected, disconnected, loadingChange, networkChange
 * - Oferece setupRealtimeListener/removeListener sem duplicação
 * - Cria indicador visual #firebase-status (online/offline)
 * - Idempotente e seguro para múltiplos carregamentos
 */

(function initCompatManager() {
  if (window.getFirebaseManager && window.firebaseManager) {
    // Já existe um manager global; reaproveitar
    return;
  }

  const authPerfConnection = (() => {
    try { return window.__SISWEB_AUTH_PERF__ || null; } catch (_) { return null; }
  })();

  class FirebaseConnectionManagerCompat {
    constructor() {
      if (FirebaseConnectionManagerCompat.instance) {
        return FirebaseConnectionManagerCompat.instance;
      }

      FirebaseConnectionManagerCompat.instance = this;

      this.isInitialized = false;
      this.isConnected = false;
      this.isOnline = navigator.onLine;
      this.database = null;
      this.activeListeners = new Map(); // path -> unsubscribe
      this.loadingStates = new Map();
      this.connectionRef = null;
      this._networkListenersConfigured = false;

      // Inicializa quando possível
      this.init();
    }

    async init() {
      if (this.isInitialized) return;

      try {
        await this.waitForFirebase();
        this.database = firebase.database();
        this.setupNetworkListeners();
        this.setupConnectionListeners();
        this.isInitialized = true;
        this.emit('initialized');
      } catch (error) {
        console.error('❌ CompatManager init error:', error);
      }
    }

    async waitForFirebase(maxMs = 10000) {
      const start = Date.now();
      while (!(window.firebase && firebase.database)) {
        if (Date.now() - start > maxMs) throw new Error('Timeout aguardando firebase compat');
        await new Promise(r => setTimeout(r, 100));
      }
    }

    setupNetworkListeners() {
      if (this._networkListenersConfigured) return;
      window.addEventListener('online', () => {
        this.isOnline = true;
        try { authPerfConnection?.internet(true, 'firebase_event'); } catch (_) {}
        this.emit('networkChange', 'online');
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        try { authPerfConnection?.internet(false, 'firebase_event'); } catch (_) {}
        this.emit('networkChange', 'offline');
      });
      this._networkListenersConfigured = true;
    }

    setupConnectionListeners() {
      if (!this.database) return;
      try {
        if (this.connectionRef) {
          this.connectionRef.off('value');
        }
        this.connectionRef = this.database.ref('.info/connected');
        try { authPerfConnection?.listener('rtdb', 'add', 'firebase_event', 0); } catch (_) {}
        this.connectionRef.on('value', snap => {
          const connected = snap.val() === true;
          try { authPerfConnection?.rtdb(connected, 'firebase_event'); } catch (_) {}
          const prev = this.isConnected;
          this.isConnected = connected;
          this.updateConnectionStatus(connected);
          if (connected && !prev) this.emit('connected');
          if (!connected && prev) this.emit('disconnected');
        });
      } catch (e) {
        console.error('❌ Erro configurando listeners de conexão (compat):', e);
      }
      // Limpeza on unload
      if (!window._compatManagerUnloadConfigured) {
        window.addEventListener('beforeunload', () => {
          try {
            if (this.connectionRef) {
              this.connectionRef.off('value');
              try { authPerfConnection?.listener('rtdb', 'remove', 'firebase_event', 0); } catch (_) {}
            }
            for (const [path, offFn] of this.activeListeners.entries()) {
              try { offFn && offFn(); } catch {}
            }
            this.activeListeners.clear();
          } catch {}
        });
        window._compatManagerUnloadConfigured = true;
      }
    }

    async setupRealtimeListener(path, callback) {
      if (!this.database) await this.init();
      if (!path || typeof callback !== 'function') return null;

      // Evitar duplicação por path
      if (this.activeListeners.has(path)) {
        return this.activeListeners.get(path);
      }

      const ref = this.database.ref(path);
      const handler = snap => {
        const data = snap.val() || null;
        try {
          callback(data);
        } catch (e) {
          console.error('🔄 Listener callback error:', e);
        }
      };
      const errorHandler = err => {
        console.error('🔄 Listener error:', err);
        try { callback(null, err); } catch {}
      };

      ref.on('value', handler, errorHandler);
      const offFn = () => ref.off('value', handler);
      this.activeListeners.set(path, offFn);
      return offFn;
    }

    removeListener(path) {
      const offFn = this.activeListeners.get(path);
      if (offFn) {
        try { offFn(); } catch {}
        this.activeListeners.delete(path);
      }
    }

    setLoadingState(key, loading) {
      this.loadingStates.set(key, !!loading);
      this.emit('loadingChange', { path: key, loading: !!loading });
    }

    updateConnectionStatus(connected) {
      let indicator = document.getElementById('firebase-status');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'firebase-status';
        // Estilo mínimo embutido para não depender de CSS externo
        indicator.style.position = 'fixed';
        indicator.style.top = '10px';
        indicator.style.right = '10px';
        indicator.style.padding = '8px 12px';
        indicator.style.borderRadius = '20px';
        indicator.style.fontSize = '12px';
        indicator.style.fontWeight = 'bold';
        indicator.style.zIndex = '10000';
        indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        indicator.style.transition = 'all 0.2s ease';
        document.body.appendChild(indicator);
      }
      const online = connected && this.isOnline;
      indicator.className = online ? 'firebase-online' : 'firebase-offline';
      indicator.textContent = online ? '🟢 Online' : '🔴 Offline';
      indicator.style.background = online ? '#2ecc71' : '#e74c3c';
      indicator.style.color = '#fff';
    }

    getStats() {
      const loading = Array.from(this.loadingStates.entries())
        .filter(([, v]) => v)
        .map(([k]) => k);
      return {
        isInitialized: this.isInitialized,
        isConnected: this.isConnected,
        isOnline: this.isOnline,
        activeListeners: this.activeListeners.size,
        loadingStates: loading
      };
    }

    emit(event, detail = null) {
      window.dispatchEvent(new CustomEvent(`firebaseManager:${event}`, { detail }));
    }
    on(event, cb) { window.addEventListener(`firebaseManager:${event}`, cb); }
    off(event, cb) { window.removeEventListener(`firebaseManager:${event}`, cb); }
  }

  // Expor API global compatível
  function getFirebaseManager() {
    return new FirebaseConnectionManagerCompat();
  }

  window.getFirebaseManager = window.getFirebaseManager || getFirebaseManager;
  window.firebaseManager = window.firebaseManager || getFirebaseManager();

  console.log('✅ FirebaseConnectionManagerCompat disponível globalmente');
})();


