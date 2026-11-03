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

// HTML Elements
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");
const themeToggle = document.getElementById("themeToggle");

// Messages
function showMessage(text) {
message.textContent = text;
}

// Theme System
function applyTheme(theme) {
document.body.classList.toggle("light", theme === "light");

if (themeToggle) {
themeToggle.textContent = theme === "light" ? "🌙" : "☀️";
}

localStorage.setItem("a-chat-theme", theme);
}

// Load saved theme
applyTheme(localStorage.getItem("a-chat-theme") || "dark");

// Switch theme
themeToggle?.addEventListener("click", () => {
const newTheme = document.body.classList.contains("light")
? "dark"
: "light";

applyTheme(newTheme);
});

// Create Account
signupBtn.addEventListener("click", async () => {
const email = emailInput.value.trim();
const password = passwordInput.value;

if (!email || !password) {
return showMessage("اكتب البريد الإلكتروني وكلمة المرور");
}

if (password.length < 6) {
return showMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
}

try {
showMessage("جارٍ إنشاء الحساب...");

const result = await createUserWithEmailAndPassword(
  auth,
  email,
  password
);

await setDoc(doc(db, "users", result.user.uid), {
  email,
  username: email.split("@")[0],
  createdAt: serverTimestamp()
});

showMessage("تم إنشاء حسابك بنجاح 🎉");

} catch (error) {
showMessage("تعذر إنشاء الحساب: " + error.message);
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

await signInWithEmailAndPassword(auth, email, password);

showMessage("تم تسجيل الدخول بنجاح 🎉");

} catch (error) {
showMessage("تعذر تسجيل الدخول: " + error.message);
}
});

// Authentication State
onAuthStateChanged(auth, (user) => {
if (user) {
showMessage("مرحباً بك في A-Chat 👋");
}
});
