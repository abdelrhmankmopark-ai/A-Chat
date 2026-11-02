import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOGZx-9AcJv8JFQz7lxbj2_zKVCI3jce8",
  authDomain: "a-chat-d8def.firebaseapp.com",
  projectId: "a-chat-d8def",
  storageBucket: "a-chat-d8def.firebasestorage.app",
  messagingSenderId: "1095026961205",
  appId: "1:1095026961205:web:b8148f3471693c54d53a7c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Elements
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");

// Display messages
function showMessage(text) {
  message.textContent = text;
}

// Create Account
signupBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    return showMessage("اكتب البريد الإلكتروني وكلمة المرور");
  }

  try {
    showMessage("جارٍ إنشاء الحساب...");

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await setDoc(doc(db, "users", result.user.uid), {
      email: email,
      username: email.split("@")[0],
      createdAt: serverTimestamp()
    });

    showMessage("تم إنشاء حسابك بنجاح 🎉");

  } catch (error) {
    showMessage("خطأ: " + error.message);
  }
});

// Login
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    return showMessage("اكتب البريد الإلكتروني وكلمة المرور");
  }

  try {
    showMessage("جارٍ تسجيل الدخول...");

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    showMessage("تم تسجيل الدخول بنجاح 🎉");

  } catch (error) {
    showMessage("خطأ: " + error.message);
  }
});

// Authentication State
onAuthStateChanged(auth, (user) => {
  if (user) {
    showMessage("مرحباً بك في A-Chat 👋");
  }
});
