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

// Firebase
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

const $ = id => document.getElementById(id);

// عناصر الصفحة
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

const avatarSection = $("avatarSection");
const avatarButtons = document.querySelectorAll(".avatar-option");

const AVATARS = ["👨‍💻", "🧑‍🚀", "🦊", "🐼"];

let selectedAvatar = null;
let signupStarted = false;

let currentUser = null;
let currentChatId = null;
let currentFriendId = null;

let unsubscribeChats = null;
let unsubscribeMessages = null;
let lastSeenTimer = null;

// الرسائل
function showMessage(text) {
  message.textContent = text;
}

function showAppMessage(text) {
  appMessage.textContent = text;
}

// اختيار الأفاتار
avatarButtons.forEach(button => {
  button.addEventListener("click", () => {
    const avatar = button.dataset.avatar;

    if (!AVATARS.includes(avatar)) return;

    selectedAvatar = avatar;

    avatarButtons.forEach(item => {
      item.classList.toggle("selected", item === button);
    });

    showMessage("تم اختيار صورتك الشخصية " + avatar);
  });
});

// الوضع الليلي والنهاري
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");

  themeToggle.textContent =
    theme === "light" ? "🌙" : "☀️";

  localStorage.setItem("a-chat-theme", theme);
}

applyTheme(localStorage.getItem("a-chat-theme") || "dark");

themeToggle.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("light")
    ? "dark"
    : "light";

  applyTheme(newTheme);
});

// عرض اسم المستخدم والأفاتار
function updateMyDisplay(name, avatar) {
  myName.textContent = `${avatar || "👤"} ${name}`;
}

// إنشاء ملف المستخدم
async function createProfile(user, avatar = selectedAvatar) {
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
      username,
      usernameLower: username,
      displayName: username,
      avatar: AVATARS.includes(avatar) ? avatar : "👨‍💻",
      createdAt: serverTimestamp()
    });
  } else if (!publicSnap.data().avatar) {
    await updateDoc(publicRef, {
      avatar: AVATARS.includes(avatar) ? avatar : "👨‍💻"
    });
  }

  const updatedProfile = await getDoc(publicRef);
  const profile = updatedProfile.data();

  updateMyDisplay(
    profile.displayName || username,
    profile.avatar || "👨‍💻"
  );
}

// آخر ظهور
async function updateLastSeen() {
  if (!currentUser) return;

  try {
    await updateDoc(
      doc(db, "publicProfiles", currentUser.uid),
      {
        lastSeen: serverTimestamp()
      }
    );
  } catch (error) {
    console.error("Last seen error:", error);
  }
}

function stopLastSeen() {
  if (lastSeenTimer) {
    clearInterval(lastSeenTimer);
    lastSeenTimer = null;
  }
}

function startLastSeen() {
  stopLastSeen();
  updateLastSeen();

  lastSeenTimer = setInterval(() => {
    if (document.visibilityState === "visible") {
      updateLastSeen();
    }
  }, 60000);
}

document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    currentUser
  ) {
    updateLastSeen();
  }
});

// إنشاء حساب جديد
signupBtn.addEventListener("click", async () => {

  // إظهار الأفاتارات أول مرة
  if (!signupStarted) {
    signupStarted = true;
    avatarSection.hidden = false;
    signupBtn.textContent = "إنشاء الحساب";

    showMessage("اختار صورتك الشخصية أولاً");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("اكتب البريد الإلكتروني وكلمة المرور");
    return;
  }

  if (password.length < 6) {
    showMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    return;
  }

  if (!AVATARS.includes(selectedAvatar)) {
    showMessage("اختار أفاتار قبل إنشاء الحساب");
    return;
  }

  try {
    signupBtn.disabled = true;
    showMessage("جارٍ إنشاء الحساب...");

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await createProfile(result.user, selectedAvatar);

    showMessage("تم إنشاء الحساب بنجاح 🎉");

  } catch (error) {
    console.error(error);
    showMessage("تعذر إنشاء الحساب: " + error.message);

  } finally {
    signupBtn.disabled = false;
  }
});

// تسجيل الدخول
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("اكتب البريد الإلكتروني وكلمة المرور");
    return;
  }

  try {
    loginBtn.disabled = true;
    showMessage("جارٍ تسجيل الدخول...");

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    showMessage("تم تسجيل الدخول بنجاح 🎉");

  } catch (error) {
    console.error(error);
    showMessage("تعذر تسجيل الدخول: " + error.message);

  } finally {
    loginBtn.disabled = false;
  }
});

// متابعة حالة الحساب
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    authSection.hidden = true;
    chatSection.hidden = false;

    try {
      await createProfile(user);
      startLastSeen();
      loadChats();

    } catch (error) {
      console.error(error);
      showAppMessage("تعذر تحميل الحساب: " + error.message);
    }

  } else {
    stopLastSeen();

    authSection.hidden = false;
    chatSection.hidden = true;

    if (unsubscribeChats) unsubscribeChats();
    if (unsubscribeMessages) unsubscribeMessages();

    unsubscribeChats = null;
    unsubscribeMessages = null;

    currentChatId = null;
    currentFriendId = null;

    conversationSection.hidden = true;

    selectedAvatar = null;
    signupStarted = false;

    avatarSection.hidden = true;
    signupBtn.textContent = "إنشاء حساب جديد";

    avatarButtons.forEach(button => {
      button.classList.remove("selected");
    });

    showMessage("");
    showAppMessage("");
  }
});

// البحث عن الأصدقاء
searchBtn.addEventListener("click", async () => {
  if (!currentUser) return;

  const username = searchInput.value.trim().toLowerCase();

  if (!username) {
    showAppMessage("اكتب اسم المستخدم");
    return;
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
      showAppMessage("لم يتم العثور على المستخدم");
      return;
    }

    result.forEach(profileDoc => {
      if (profileDoc.id === currentUser.uid) return;

      const profile = profileDoc.data();

      const row = document.createElement("div");
      row.className = "search-result";

      const name = document.createElement("span");
      name.textContent =
        (profile.avatar || "👤") + " @" + profile.username;

      const button = document.createElement("button");
      button.textContent = "مراسلة";

      button.addEventListener("click", () => {
        openChat(profileDoc.id, profile.username);
      });

      row.append(name, button);
      searchResults.appendChild(row);
    });

    showAppMessage("");

  } catch (error) {
    console.error(error);
    showAppMessage("خطأ في البحث: " + error.message);
  }
});

// معرف المحادثة
function makeChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// تنسيق آخر ظهور
function formatLastSeen(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return "آخر ظهور غير متاح";
  }

  return "آخر ظهور: " +
    timestamp.toDate().toLocaleString("ar-EG");
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

    const profileSnap = await getDoc(
      doc(db, "publicProfiles", friendId)
    );

    const friendProfile = profileSnap.exists()
      ? profileSnap.data()
      : {};

    chatTitle.textContent =
      (friendProfile.avatar || "👤") + " " + friendName;

    conversationSection.hidden = false;
    searchResults.replaceChildren();

    let status = $("friendStatus");

    if (!status) {
      status = document.createElement("p");
      status.id = "friendStatus";

      chatTitle.insertAdjacentElement("afterend", status);
    }

    status.textContent = formatLastSeen(friendProfile.lastSeen);

    loadMessages(chatId);

  } catch (error) {
    console.error(error);
    showAppMessage("تعذر فتح المحادثة: " + error.message);
  }
}

// تحميل المحادثات
function loadChats() {
  if (unsubscribeChats) unsubscribeChats();

  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", currentUser.uid)
  );

  unsubscribeChats = onSnapshot(
    q,
    async snapshot => {
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

          const profile = profileSnap.exists()
            ? profileSnap.data()
            : {};

          const friendName = profile.username || "مستخدم";
          const avatar = profile.avatar || "👤";

          const row = document.createElement("div");
          row.className = "chat-item";

          const info = document.createElement("div");

          const name = document.createElement("strong");
          name.textContent = avatar + " @" + friendName;

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
    },
    error => {
      console.error(error);
      showAppMessage("خطأ في المحادثات: " + error.message);
    }
  );
}

// تحميل الرسائل
function loadMessages(chatId) {
  if (unsubscribeMessages) unsubscribeMessages();

  messagesList.replaceChildren();

  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages = onSnapshot(
    q,
    snapshot => {
      messagesList.replaceChildren();

      snapshot.forEach(messageDoc => {
        const data = messageDoc.data();

        const bubble = document.createElement("div");

        const isMine = data.senderId === currentUser.uid;

        bubble.className =
          "message " + (isMine ? "mine" : "theirs");

        const text = document.createElement("span");
        text.textContent = data.text;

        bubble.appendChild(text);
        messagesList.appendChild(bubble);
      });

      messagesList.scrollTop = messagesList.scrollHeight;
    },
    error => {
      console.error(error);
      showAppMessage("تعذر تحميل الرسائل: " + error.message);
    }
  );
}

// إرسال رسالة
async function sendMessage() {
  const text = messageInput.value.trim();

  if (!text || !currentChatId || !currentUser) return;

  if (text.length > 2000) {
    showAppMessage("الرسالة طويلة جدًا");
    return;
  }

  sendBtn.disabled = true;

  try {
    await addDoc(
      collection(db, "chats", currentChatId, "messages"),
      {
        senderId: currentUser.uid,
        text,
        createdAt: serverTimestamp()
      }
    );

    await updateDoc(
      doc(db, "chats", currentChatId),
      {
        lastMessage: text,
        updatedAt: serverTimestamp()
      }
    );

    messageInput.value = "";
    showAppMessage("");

  } catch (error) {
    console.error(error);
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

// الرجوع من المحادثة
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
    console.error(error);
    showAppMessage("تعذر تسجيل الخروج: " + error.message);
  }
});
