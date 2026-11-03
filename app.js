import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  addDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDOGZx-9AcJv8JFQz7lxbj2_zKVCI3jce8",
  authDomain: "a-chat-d8def.firebaseapp.com",
  projectId: "a-chat-d8def",
  storageBucket: "a-chat-d8def.firebasestorage.app",
  messagingSenderId: "1095026961205",
  appId: "1:1095026961205:web:b8148f3471693c54d53a7c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// عناصر الصفحة
const $ = id => document.getElementById(id);

const authSection = $("authSection");
const chatSection = $("chatSection");

const emailInput = $("email");
const passwordInput = $("password");
const loginBtn = $("loginBtn");
const signupBtn = $("signupBtn");
const message = $("message");

const themeToggle = $("themeToggle");
const logoutBtn = $("logoutBtn");

const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const searchResults = $("searchResults");

const chatsList = $("chatsList");
const conversationSection = $("conversationSection");
const chatTitle = $("chatTitle");
const messagesList = $("messagesList");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");
const backBtn = $("backBtn");

const appMessage = $("appMessage");
const myName = $("myName");

let currentUser = null;
let currentChatId = null;
let currentFriendId = null;

let unsubscribeChats = null;
let unsubscribeMessages = null;

// الرسائل
function showMessage(text) {
  message.textContent = text;
}

function showAppMessage(text) {
  appMessage.textContent = text;
}

// الوضع الليلي والنهاري
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");

  themeToggle.textContent =
    theme === "light" ? "🌙" : "☀️";

  localStorage.setItem("a-chat-theme", theme);
}

applyTheme(localStorage.getItem("a-chat-theme") || "dark");

themeToggle.addEventListener("click", () => {
  const next = document.body.classList.contains("light")
    ? "dark"
    : "light";

  applyTheme(next);
});

// إنشاء ملف المستخدم
async function createProfile(user) {
  const privateRef = doc(db, "users", user.uid);
  const publicRef = doc(db, "publicProfiles", user.uid);

  const privateSnap = await getDoc(privateRef);
  const publicSnap = await getDoc(publicRef);

  const username = user.email.split("@")[0].toLowerCase();

  if (!privateSnap.exists()) {
    await setDoc(privateRef, {
      email: user.email,
      createdAt: serverTimestamp()
    });
  }

  if (!publicSnap.exists()) {
    await setDoc(publicRef, {
      username: username,
      usernameLower: username,
      displayName: username,
      createdAt: serverTimestamp()
    });
  }

  myName.textContent = username;
}

// إنشاء حساب
signupBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    return showMessage("اكتب البريد وكلمة المرور");
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

    await createProfile(result.user);

    showMessage("تم إنشاء الحساب بنجاح 🎉");

  } catch (error) {
    showMessage("خطأ: " + error.message);
  }
});

// تسجيل الدخول
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    return showMessage("اكتب البريد وكلمة المرور");
  }

  try {
    showMessage("جارٍ تسجيل الدخول...");

    await signInWithEmailAndPassword(auth, email, password);

    showMessage("تم تسجيل الدخول بنجاح 🎉");

  } catch (error) {
    showMessage("خطأ: " + error.message);
  }
});

// مراقبة تسجيل الدخول
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    authSection.hidden = true;
    chatSection.hidden = false;

    try {
      await createProfile(user);
      loadChats();
    } catch (error) {
      showAppMessage("تعذر تحميل الحساب: " + error.message);
    }

  } else {
    authSection.hidden = false;
    chatSection.hidden = true;

    if (unsubscribeChats) unsubscribeChats();
    if (unsubscribeMessages) unsubscribeMessages();

    unsubscribeChats = null;
    unsubscribeMessages = null;

    currentChatId = null;
    currentFriendId = null;
    conversationSection.hidden = true;
  }
});

// البحث عن الأصدقاء باسم المستخدم
searchBtn.addEventListener("click", async () => {
  const username = searchInput.value.trim().toLowerCase();

  if (!username) {
    return showAppMessage("اكتب اسم المستخدم للبحث");
  }

  searchResults.replaceChildren();
  showAppMessage("جارٍ البحث...");

  try {
    const q = query(
      collection(db, "publicProfiles"),
      where("usernameLower", "==", username),
      limit(10)
    );

    const result = await getDocs(q);

    searchResults.replaceChildren();

    if (result.empty) {
      showAppMessage("لم يتم العثور على مستخدم بهذا الاسم");
      return;
    }

    result.forEach(profileDoc => {
      const friendId = profileDoc.id;
      const profile = profileDoc.data();

      if (friendId === currentUser.uid) return;

      const row = document.createElement("div");
      row.className = "search-result";

      const name = document.createElement("span");
      name.textContent = "@" + profile.username;

      const button = document.createElement("button");
      button.textContent = "مراسلة";

      button.addEventListener("click", () => {
        openChat(friendId, profile.username);
      });

      row.append(name, button);
      searchResults.appendChild(row);
    });

    showAppMessage("");

  } catch (error) {
    showAppMessage("حدث خطأ أثناء البحث: " + error.message);
  }
});

// إنشاء معرف ثابت للمحادثة
function makeChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// فتح محادثة
async function openChat(friendId, friendName) {
  if (!currentUser) return;

  try {
    const chatId = makeChatId(currentUser.uid, friendId);
    const chatRef = doc(db, "chats", chatId);

    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        participants: [currentUser.uid, friendId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: ""
      });
    }

    currentChatId = chatId;
    currentFriendId = friendId;

    chatTitle.textContent = friendName;

    conversationSection.hidden = false;
    searchResults.replaceChildren();

    loadMessages(chatId);

  } catch (error) {
    showAppMessage("تعذر فتح المحادثة: " + error.message);
  }
}

// تحميل قائمة المحادثات
function loadChats() {
  if (unsubscribeChats) unsubscribeChats();

  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", currentUser.uid)
  );

  unsubscribeChats = onSnapshot(q, async snapshot => {
    chatsList.replaceChildren();

    if (snapshot.empty) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "لا توجد محادثات حتى الآن.";
      chatsList.appendChild(empty);
      return;
    }

    const chats = [...snapshot.docs];

    chats.sort((a, b) => {
      const timeA = a.data().updatedAt?.seconds || 0;
      const timeB = b.data().updatedAt?.seconds || 0;
      return timeB - timeA;
    });

    for (const chatDoc of chats) {
      const data = chatDoc.data();

      const friendId = data.participants.find(
        id => id !== currentUser.uid
      );

      if (!friendId) continue;

      try {
        const profileSnap = await getDoc(
          doc(db, "publicProfiles", friendId)
        );

        const friendName = profileSnap.exists()
          ? profileSnap.data().username
          : "مستخدم";

        const row = document.createElement("div");
        row.className = "chat-item";

        const info = document.createElement("div");

        const name = document.createElement("strong");
        name.textContent = "@" + friendName;

        const last = document.createElement("p");
        last.textContent = data.lastMessage || "ابدأ المحادثة";

        info.append(name, last);
        row.appendChild(info);

        row.addEventListener("click", () => {
          openChat(friendId, friendName);
        });

        chatsList.appendChild(row);

      } catch (error) {
        console.error(error);
      }
    }

  }, error => {
    showAppMessage("خطأ في تحميل المحادثات: " + error.message);
  });
}

// تحميل الرسائل لحظيًا
function loadMessages(chatId) {
  if (unsubscribeMessages) unsubscribeMessages();

  messagesList.replaceChildren();

  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages = onSnapshot(q, snapshot => {
    messagesList.replaceChildren();

    snapshot.forEach(messageDoc => {
      const data = messageDoc.data();

      const bubble = document.createElement("div");

      bubble.className =
        "message " +
        (data.senderId === currentUser.uid ? "mine" : "theirs");

      bubble.textContent = data.text;

      messagesList.appendChild(bubble);
    });

    messagesList.scrollTop = messagesList.scrollHeight;

  }, error => {
    showAppMessage("تعذر تحميل الرسائل: " + error.message);
  });
}

// إرسال رسالة
async function sendMessage() {
  const text = messageInput.value.trim();

  if (!text || !currentChatId || !currentUser) return;

  if (text.length > 2000) {
    return showAppMessage("الرسالة طويلة جدًا");
  }

  sendBtn.disabled = true;

  try {
    await addDoc(
      collection(db, "chats", currentChatId, "messages"),
      {
        senderId: currentUser.uid,
        text: text,
        createdAt: serverTimestamp()
      }
    );

    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: text,
      updatedAt: serverTimestamp()
    });

    messageInput.value = "";
    showAppMessage("");

  } catch (error) {
    showAppMessage("تعذر إرسال الرسالة: " + error.message);
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

// الرجوع لقائمة المحادثات
backBtn.addEventListener("click", () => {
  conversationSection.hidden = true;

  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  currentChatId = null;
  currentFriendId = null;
});

// تسجيل الخروج
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showMessage("تم تسجيل الخروج");
  } catch (error) {
    showAppMessage("تعذر تسجيل الخروج: " + error.message);
  }
});
