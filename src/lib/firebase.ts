import type { FirebaseApp } from 'firebase/app'
import type { Auth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, updateProfile } from 'firebase/auth'
import type { Database, DatabaseReference, get as DatabaseGet, onValue as DatabaseOnValue, ref as DatabaseRef, set as DatabaseSet, update as DatabaseUpdate } from 'firebase/database'
import type { FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyCQM2Tz3xGGmLcjQsKkEKTPEaot2yqVzM4',
  authDomain: 'vtaiwan-8160b.firebaseapp.com',
  databaseURL: 'https://vtaiwan-8160b-default-rtdb.firebaseio.com',
  projectId: 'vtaiwan-8160b',
  storageBucket: 'vtaiwan-8160b.firebasestorage.app',
  messagingSenderId: '1090593078456',
  appId: '1:1090593078456:web:1cedfa627491832306484d',
  measurementId: 'G-2GBP8JEJ8M',
}

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  database: Database
  storage: FirebaseStorage
  blogsRef: DatabaseReference
  usersRef: DatabaseReference
  meetingsRef: DatabaseReference
  GoogleAuthProvider: typeof GoogleAuthProvider
  signInWithPopup: typeof signInWithPopup
  onAuthStateChanged: typeof onAuthStateChanged
  signOut: typeof signOut
  updateProfile: typeof updateProfile
  databaseRef: typeof DatabaseRef
  databaseGet: typeof DatabaseGet
  databaseSet: typeof DatabaseSet
  databaseUpdate: typeof DatabaseUpdate
  databaseOnValue: typeof DatabaseOnValue
}

let servicesPromise: Promise<FirebaseServices> | undefined

/**
 * Firebase 僅在瀏覽器端初始化，避免 SSR 請求存取瀏覽器專屬 API。
 */
export function getFirebaseServices(): Promise<FirebaseServices> {
  if (import.meta.env.SSR) {
    return Promise.reject(new Error('Firebase 僅能在瀏覽器端使用'))
  }

  servicesPromise ??= initializeFirebase()
  return servicesPromise
}

async function initializeFirebase(): Promise<FirebaseServices> {
  const [appModule, authModule, databaseModule, storageModule] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/database'), import('firebase/storage')])
  const app = appModule.getApps().length > 0 ? appModule.getApp() : appModule.initializeApp(firebaseConfig)
  const database = databaseModule.getDatabase(app)

  return {
    app,
    auth: authModule.getAuth(app),
    database,
    storage: storageModule.getStorage(app),
    blogsRef: databaseModule.ref(database, 'blogs'),
    usersRef: databaseModule.ref(database, 'users'),
    meetingsRef: databaseModule.ref(database, 'meetings'),
    GoogleAuthProvider: authModule.GoogleAuthProvider,
    signInWithPopup: authModule.signInWithPopup,
    onAuthStateChanged: authModule.onAuthStateChanged,
    signOut: authModule.signOut,
    updateProfile: authModule.updateProfile,
    databaseRef: databaseModule.ref,
    databaseGet: databaseModule.get,
    databaseSet: databaseModule.set,
    databaseUpdate: databaseModule.update,
    databaseOnValue: databaseModule.onValue,
  }
}
