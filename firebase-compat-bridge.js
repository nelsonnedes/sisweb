/**
 * firebase-compat-bridge.js
 *
 * Ponte de compatibilidade: emula a API compat do Firebase (window.firebase.xxx())
 * usando o SDK modular do firebase-init.js. Permite que páginas legadas continuem
 * usando firebase.database().ref(), firebase.auth(), etc. sem carregar o SDK compat
 * do CDN.
 *
 * Uso: import './firebase-compat-bridge.js';  // define window.firebase automaticamente
 *
 * API emulada:
 *   firebase.initializeApp()          → no-op (app já inicializado)
 *   firebase.apps / firebase.apps.length → app list
 *   firebase.auth()                    → auth wrapper
 *   firebase.auth().currentUser        → auth.currentUser
 *   firebase.auth().onAuthStateChanged(cb) → onAuthStateChanged(auth, cb)
 *   firebase.auth().signOut()          → signOut(auth)
 *   firebase.database()               → database wrapper
 *   firebase.database().ref(path)      → Reference wrapper
 *   firebase.database().ref(path).once('value') → get()
 *   firebase.database().ref(path).set(data)     → set()
 *   firebase.database().ref(path).update(data)  → update()
 *   firebase.database().ref(path).remove()      → remove()
 *   firebase.database().ref(path).push(data)    → push()
 *   firebase.database().ref(path).on('value', cb) → onValue()
 *   firebase.database().ref(path).off()          → off()
 *   firebase.database().ServerValue.TIMESTAMP    → serverTimestamp()
 *   firebase.functions()               → functions wrapper
 *   firebase.functions().httpsCallable(name)     → httpsCallable(functions, name)
 *   firebase.storage()                 → storage wrapper (se necessário)
 */

import {
  app, auth, db, storage, functions,
  ref, set, get, remove, push, update, child,
  onValue, off, serverTimestamp,
  onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInAnonymously,
  httpsCallable,
  storageRef, uploadBytes, getDownloadURL, getBytes, deleteObject
} from './firebase-init.js?v=21eb04e409d8';

// ─── Database Reference Wrapper ──────────────────────────────────────────────

function createCompatRef(databaseRef) {
  const compatRef = {
    _ref: databaseRef,

    get key() {
      return databaseRef.key;
    },

    once(eventType) {
      if (eventType === 'value') {
        return get(databaseRef).then(snapshot => ({
          val: () => snapshot.val(),
          exists: () => snapshot.exists(),
          forEach: (cb) => { snapshot.forEach(cb); }
        }));
      }
      return get(databaseRef).then(snapshot => ({
        val: () => snapshot.val(),
        exists: () => snapshot.exists()
      }));
    },

    set(value) {
      return set(databaseRef, value);
    },

    update(value) {
      return update(databaseRef, value);
    },

    remove() {
      return remove(databaseRef);
    },

    push(value) {
      const newRef = push(databaseRef);
      // Emula ThenableReference do SDK compat: expoe .key sincronamente
      // e mantem comportamento de Promise para await ref.push(value).
      //
      // IMPORTANTE: o wrapper compat NUNCA deve ser o valor de resolucao
      // de uma promise, pois ele e thenable e o assimilador entraria em
      // recursao infinita (promise -> compatNewRef -> promise -> ...).
      // Por isso resolvemos sempre com newRef (ThenableReference real do
      // SDK modular), que assimila para um valor plain apos a escrita.
      const compatNewRef = createCompatRef(newRef);
      const promise = value !== undefined
        ? set(newRef, value).then(() => newRef)
        : Promise.resolve(newRef);
      compatNewRef.then = (onFulfilled, onRejected) => promise.then(
        () => (typeof onFulfilled === 'function' ? onFulfilled(newRef) : newRef),
        onRejected
      );
      compatNewRef.catch = (onRejected) => compatNewRef.then(undefined, onRejected);
      compatNewRef.finally = (onFinally) => promise.finally(onFinally).then(() => newRef);
      return compatNewRef;
    },

    on(eventType, callback, cancelCallback) {
      if (eventType === 'value') {
        return onValue(databaseRef, (snapshot) => {
          callback({
            val: () => snapshot.val(),
            exists: () => snapshot.exists(),
            forEach: (cb) => { snapshot.forEach(cb); }
          });
        }, cancelCallback);
      }
    },

    off(eventType, callback) {
      return off(databaseRef, eventType, callback);
    },

    child(path) {
      return createCompatRef(child(databaseRef, path));
    },

    toString() {
      return databaseRef.toString();
    }
  };
  return compatRef;
}

// ─── Database Wrapper ────────────────────────────────────────────────────────

function createCompatDatabase() {
  return {
    ref(path) {
      return createCompatRef(ref(db, path));
    },
    ServerValue: {
      TIMESTAMP: serverTimestamp()
    }
  };
}
createCompatDatabase.ServerValue = {
  TIMESTAMP: serverTimestamp()
};

// ─── Auth Wrapper ────────────────────────────────────────────────────────────

function createCompatAuth() {
  const compatAuth = {
    get currentUser() { return auth.currentUser; },

    onAuthStateChanged(callback) {
      return onAuthStateChanged(auth, callback);
    },

    signOut() {
      return signOut(auth);
    },

    signInWithEmailAndPassword(email, password) {
      return signInWithEmailAndPassword(auth, email, password)
        .then(userCredential => ({
          user: userCredential.user
        }));
    },

    createUserWithEmailAndPassword(email, password) {
      return createUserWithEmailAndPassword(auth, email, password)
        .then(userCredential => ({
          user: userCredential.user
        }));
    },

    signInAnonymously() {
      return signInAnonymously(auth);
    }
  };
  return compatAuth;
}
createCompatAuth.EmailAuthProvider = {
  PROVIDER_ID: 'password'
};

// ─── Functions Wrapper ───────────────────────────────────────────────────────

function createCompatFunctions() {
  return {
    httpsCallable(name) {
      const callable = httpsCallable(functions, name);
      return (data) => callable(data).then(result => ({
        data: result.data
      }));
    }
  };
}

// ─── Storage Wrapper ─────────────────────────────────────────────────────────

function createCompatStorage() {
  return {
    ref(path) {
      const storageReference = storageRef(storage, path);
      return {
        put(file) {
          return uploadBytes(storageReference, file).then(snapshot => ({
            ref: storageReference,
            snapshot
          }));
        },
        getDownloadURL() {
          return getDownloadURL(storageReference);
        },
        delete() {
          return deleteObject(storageReference);
        },
        child(subPath) {
          const childRef = storageRef(storage, path ? `${path}/${subPath}` : subPath);
          return createCompatStorageRef(childRef);
        }
      };
    }
  };
}

function createCompatStorageRef(storageReference) {
  return {
    put(file) {
      return uploadBytes(storageReference, file).then(snapshot => ({
        ref: storageReference,
        snapshot
      }));
    },
    getDownloadURL() {
      return getDownloadURL(storageReference);
    },
    delete() {
      return deleteObject(storageReference);
    }
  };
}

// ─── Global firebase object ──────────────────────────────────────────────────

window.firebase = {
  app,
  apps: [app],
  initializeApp: () => app,

  auth: createCompatAuth,
  database: createCompatDatabase,
  functions: createCompatFunctions,
  storage: createCompatStorage
};

console.log('✅ firebase-compat-bridge: API compat emulada via firebase-init.js (modular)');
