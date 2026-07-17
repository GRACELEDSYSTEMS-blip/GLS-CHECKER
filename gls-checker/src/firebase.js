import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAQek-7lw3q6Y-6AF4oOtbulNUBKFAE6rs",
  authDomain: "gls-checker.firebaseapp.com",
  projectId: "gls-checker",
  storageBucket: "gls-checker.firebasestorage.app",
  messagingSenderId: "167929805562",
  appId: "1:167929805562:web:4eb1645d9a4b93e2686743"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
