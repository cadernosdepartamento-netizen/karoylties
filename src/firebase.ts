import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, getDocFromServer, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const uploadFile = async (file: File, path: string): Promise<string> => {
  console.log(`Iniciando upload para: ${path}, Tamanho: ${file.size} bytes, Tipo: ${file.type}`);
  try {
    const storageRef = ref(storage, path);
    // Usando uploadBytes em vez de uploadBytesResumable para maior simplicidade e confiabilidade em uploads simples
    const snapshot = await uploadBytes(storageRef, file);
    console.log('Upload concluído, obtendo URL de download...', snapshot);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('URL obtida com sucesso:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Erro detalhado no upload:', error);
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'storage/retry-limit-exceeded') {
        throw new Error('O limite de tempo para o upload foi excedido. Verifique sua conexão e se as regras do Firebase Storage permitem a escrita (allow write).');
      }
      if (error.code === 'storage/unauthorized') {
        throw new Error('Permissão negada para upload. Verifique as regras de segurança do Firebase Storage.');
      }
    }
    throw error;
  }
};

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);

export const registerWithEmail = async (email: string, pass: string) => {
  if (!email.endsWith('@kalunga.com.br')) {
    throw new Error('Apenas e-mails @kalunga.com.br são permitidos.');
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  // Create user profile in firestore
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    email,
    role: 'user',
    createdAt: serverTimestamp()
  });
  return userCredential;
};

export const loginWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);

// Error handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
