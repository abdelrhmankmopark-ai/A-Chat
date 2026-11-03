import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// إعدادات Supabase العامة (Publishable Key آمن للاستخدام في الواجهة مع RLS)
const SUPABASE_URL = "https://gncoeyferzqhyhfwwmyr.supabase.co";
const SUPABASE_KEY = "sb_publishable_N0YCbA8bfJMOZ3JVRj2TlA_iBJQrpsp";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
const avatarSection = $("avatarSection");
const avatarButtons = document.querySelectorAll(".avatar-option");

const AVATARS = ["👨‍💻", "🧑‍🚀", "🦊", "🐼"];
let selectedAvatar = null;
let signupStarted = false;
let currentUser = null;
let currentProfile = null;
let currentChatId = null;
let currentFriendId = null;
let authUserId = null;
let chatsChannel = null;
let messagesChannel = null;
let friendStatusTimer = null;
let lastSeenTimer = null;

function showMessage(text) {
  message.textContent = text || "";
}
function showAppMessage(text) {
  appMessage.textContent = text || "";
}
function friendlyError(error) {
  const code = error?.code || "";
  const msg = error?.message || "حدث خطأ غير متوقع";
  if (code === "Invalid login credentials") return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (msg.toLowerCase().includes("email not confirmed")) return "أكد بريدك الإلكتروني أولاً من الرسالة التي وصلتك.";
  if (msg.toLowerCase().includes("already registered")) return "هذا البريد مسجل بالفعل، جرّب تسجيل الدخول.";
  if (msg.toLowerCase().includes("password")) return "كلمة المرور غير مناسبة. استخدم 6 أحرف على الأقل.";
  if (msg.toLowerCase().includes("fetch")) return "تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.";
  return msg;
}

avatarButtons.forEach(button => {
  button.addEventListener("click", () => {
    const avatar = button.dataset.avatar;
    if (!AVATARS.includes(avatar)) return;
    selectedAvatar = avatar;
    avatarButtons.forEach(item => item.classList.toggle("selected", item === button));
    showMessage("تم اختيار صورتك الشخصية " + avatar);
  });
});

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeToggle.textContent = theme === "light" ? "🌙" : "☀️";
  localStorage.setItem("a-chat-theme", theme);
}
applyTheme(localStorage.getItem("a-chat-theme") || "light");
themeToggle.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("light") ? "dark" : "light");
});

function updateMyDisplay(profile) {
  const avatar = profile?.avatar_url || "👤";
  const name = profile?.display_name || profile?.username || "مستخدم A-Chat";
  myName.textContent = avatar + " " + name + (profile?.username ? "  @" + profile.username : "");
}

function makeUsername(email) {
  const raw = (email || "user").split("@")[0].toLowerCase();
  const base = raw.replace(/[^a-z0-9_]/g, "").slice(0, 14) || "user";
  return base + Math.floor(1000 + Math.random() * 9000);
}

async function ensureProfile(user) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,last_seen")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    if (!existing.avatar_url && AVATARS.includes(user.user_metadata?.avatar)) {
      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: user.user_metadata.avatar })
        .eq("id", user.id)
        .select("id,username,display_name,avatar_url,last_seen")
        .single();
      if (error) throw error;
      currentProfile = data;
    } else {
      currentProfile = existing;
    }
    updateMyDisplay(currentProfile);
    return currentProfile;
  }

  let created = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = makeUsername(user.email);
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        username,
        display_name: (user.email || "مستخدم").split("@")[0],
        avatar_url: AVATARS.includes(user.user_metadata?.avatar)
          ? user.user_metadata.avatar
          : (AVATARS.includes(selectedAvatar) ? selectedAvatar : "👨‍💻")
      })
      .select("id,username,display_name,avatar_url,last_seen")
      .single();
    if (!error) {
      created = data;
      break;
    }
    lastError = error;
    if (error.code !== "23505") break;
  }
  if (!created) throw lastError || new Error("تعذر إنشاء الملف الشخصي");
  currentProfile = created;
  updateMyDisplay(currentProfile);
  return currentProfile;
}

async function updateLastSeen() {
  if (!currentUser) return;
  const { error } = await supabase
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", currentUser.id);
  if (error) console.warn("Last seen:", error.message);
}
function startLastSeen() {
  stopLastSeen();
  updateLastSeen();
  lastSeenTimer = setInterval(() => {
    if (document.visibilityState === "visible") updateLastSeen();
  }, 60000);
}
function stopLastSeen() {
  if (lastSeenTimer) clearInterval(lastSeenTimer);
  lastSeenTimer = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser) updateLastSeen();
});

function stopMessagesChannel() {
  if (messagesChannel) supabase.removeChannel(messagesChannel);
  messagesChannel = null;
}
function stopChatsChannel() {
  if (chatsChannel) supabase.removeChannel(chatsChannel);
  chatsChannel = null;
}
function stopFriendStatus() {
  if (friendStatusTimer) clearInterval(friendStatusTimer);
  friendStatusTimer = null;
}

async function handleAuthChange(user) {
  if (user && authUserId === user.id) return;
  authUserId = user?.id || null;
  currentUser = user || null;

  if (user) {
    authSection.hidden = true;
    chatSection.hidden = false;
    showAppMessage("جارٍ تجهيز حسابك...");
    try {
      currentProfile = await ensureProfile(user);
      updateMyDisplay(currentProfile);
      startLastSeen();
      await loadChats();
      listenForNewChats();
      showAppMessage("");
    } catch (error) {
      console.error(error);
      showAppMessage("تعذر تجهيز الحساب: " + friendlyError(error));
    }
  } else {
    stopLastSeen();
    stopFriendStatus();
    stopMessagesChannel();
    stopChatsChannel();
    currentProfile = null;
    currentChatId = null;
    currentFriendId = null;
    authSection.hidden = false;
    chatSection.hidden = true;
    conversationSection.hidden = true;
    chatsList.replaceChildren();
    messagesList.replaceChildren();
    searchResults.replaceChildren();
    selectedAvatar = null;
    signupStarted = false;
    avatarSection.hidden = true;
    signupBtn.textContent = "إنشاء حساب جديد";
    avatarButtons.forEach(button => button.classList.remove("selected"));
    showMessage("");
    showAppMessage("");
  }
}

signupBtn.addEventListener("click", async () => {
  if (!signupStarted) {
    signupStarted = true;
    avatarSection.hidden = false;
    signupBtn.textContent = "إنشاء الحساب";
    showMessage("اختار صورتك الشخصية أولاً");
    return;
  }

  const email = emailInput.value.trim().toLowerCase();
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
    showMessage("اختار صورة شخصية قبل إنشاء الحساب");
    return;
  }

  signupBtn.disabled = true;
  showMessage("جارٍ إنشاء الحساب...");
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { avatar: selectedAvatar },
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;

    if (data.session) {
      showMessage("تم إنشاء الحساب بنجاح 🎉");
      await handleAuthChange(data.user);
    } else {
      showMessage("تم إنشاء الحساب. راجع بريدك الإلكتروني واضغط رابط التأكيد، ثم سجّل الدخول.");
    }
  } catch (error) {
    console.error(error);
    showMessage("تعذر إنشاء الحساب: " + friendlyError(error));
  } finally {
    signupBtn.disabled = false;
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) {
    showMessage("اكتب البريد الإلكتروني وكلمة المرور");
    return;
  }

  loginBtn.disabled = true;
  showMessage("جارٍ تسجيل الدخول...");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showMessage("تم تسجيل الدخول بنجاح 🎉");
    await handleAuthChange(data.user);
  } catch (error) {
    console.error(error);
    showMessage("تعذر تسجيل الدخول: " + friendlyError(error));
  } finally {
    loginBtn.disabled = false;
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  handleAuthChange(session?.user || null).catch(error => {
    console.error(error);
    showAppMessage("حدث خطأ أثناء فتح الحساب: " + friendlyError(error));
  });
});

function makeDirectKey(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

async function openChat(friendId, friendName) {
  if (!currentUser || friendId === currentUser.id) return;
  showAppMessage("جارٍ فتح المحادثة...");
  try {
    stopMessagesChannel();
    stopFriendStatus();

    const directKey = makeDirectKey(currentUser.id, friendId);
    let { data: conversation, error } = await supabase
      .from("conversations")
      .select("id,direct_key")
      .eq("direct_key", directKey)
      .maybeSingle();
    if (error) throw error;

    if (!conversation) {
      const { data: created, error: createError } = await supabase
        .from("conversations")
        .insert({
          created_by: currentUser.id,
          is_group: false,
          direct_key: directKey
        })
        .select("id,direct_key")
        .single();

      if (createError && createError.code === "23505") {
        const retry = await supabase
          .from("conversations")
          .select("id,direct_key")
          .eq("direct_key", directKey)
          .maybeSingle();
        if (retry.error) throw retry.error;
        conversation = retry.data;
      } else if (createError) {
        throw createError;
      } else {
        conversation = created;
        const { error: membersError } = await supabase
          .from("conversation_members")
          .insert([
            { conversation_id: conversation.id, user_id: currentUser.id },
            { conversation_id: conversation.id, user_id: friendId }
          ]);
        if (membersError) throw membersError;
      }
    }

    currentChatId = conversation.id;
    currentFriendId = friendId;
    chatTitle.textContent = "💬 " + friendName;
    conversationSection.hidden = false;
    showAppMessage("");
    await loadMessages(conversation.id);
    listenToFriend(friendId);
    messageInput.focus();
    await loadChats();
  } catch (error) {
    console.error(error);
    showAppMessage("تعذر فتح المحادثة: " + friendlyError(error));
  }
}

async function loadChats() {
  if (!currentUser) return;
  const { data: memberships, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", currentUser.id);
  if (memberError) throw memberError;

  const ids = [...new Set((memberships || []).map(item => item.conversation_id))];
  chatsList.replaceChildren();
  if (!ids.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "لا توجد محادثات حتى الآن. ابحث عن صديق وابدأ أول محادثة.";
    chatsList.appendChild(empty);
    return;
  }

  const [conversationsResult, membersResult] = await Promise.all([
    supabase.from("conversations").select("id,title,is_group,created_at").in("id", ids),
    supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id", ids)
  ]);
  if (conversationsResult.error) throw conversationsResult.error;
  if (membersResult.error) throw membersResult.error;

  const friendIds = [...new Set((membersResult.data || [])
    .filter(row => row.user_id !== currentUser.id)
    .map(row => row.user_id))];
  let profiles = [];
  if (friendIds.length) {
    const result = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,last_seen")
      .in("id", friendIds);
    if (result.error) throw result.error;
    profiles = result.data || [];
  }

  const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
  const memberMap = new Map();
  (membersResult.data || []).forEach(row => {
    if (!memberMap.has(row.conversation_id)) memberMap.set(row.conversation_id, []);
    memberMap.get(row.conversation_id).push(row.user_id);
  });

  const sorted = (conversationsResult.data || []).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  sorted.forEach(conversation => {
    const friendId = (memberMap.get(conversation.id) || [])
      .find(id => id !== currentUser.id);
    if (!friendId) return;
    const profile = profileMap.get(friendId) || {};
    const friendName = profile.display_name || profile.username || "مستخدم";
    const row = document.createElement("div");
    row.className = "chat-item";
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = (profile.avatar_url || "👤") + " " + friendName;
    const sub = document.createElement("p");
    sub.textContent = "@" + (profile.username || "user");
    info.append(name, sub);
    row.appendChild(info);
    row.addEventListener("click", () => openChat(friendId, friendName));
    chatsList.appendChild(row);
  });

  if (!chatsList.children.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "لا توجد محادثات حتى الآن.";
    chatsList.appendChild(empty);
  }
}

function listenForNewChats() {
  stopChatsChannel();
  if (!currentUser) return;
  chatsChannel = supabase
    .channel("a-chat-members-" + currentUser.id)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "conversation_members",
      filter: "user_id=eq." + currentUser.id
    }, () => loadChats().catch(error => showAppMessage(friendlyError(error))))
    .subscribe();
}

async function fetchMessages(chatId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,content,created_at")
    .eq("conversation_id", chatId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;

  messagesList.replaceChildren();
  (data || []).forEach(item => {
    const bubble = document.createElement("div");
    bubble.className = "message " + (item.sender_id === currentUser.id ? "mine" : "theirs");
    const content = document.createElement("span");
    content.textContent = item.content;
    bubble.appendChild(content);
    messagesList.appendChild(bubble);
  });
  messagesList.scrollTop = messagesList.scrollHeight;
}

async function loadMessages(chatId) {
  await fetchMessages(chatId);
  stopMessagesChannel();
  messagesChannel = supabase
    .channel("a-chat-messages-" + chatId)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "messages",
      filter: "conversation_id=eq." + chatId
    }, () => {
      if (currentChatId === chatId) {
        fetchMessages(chatId).catch(error => showAppMessage(friendlyError(error)));
      }
    })
    .subscribe();
}

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !currentChatId || !currentUser) return;
  if (content.length > 2000) {
    showAppMessage("الرسالة طويلة جدًا. اختصرها قليلًا.");
    return;
  }
  sendBtn.disabled = true;
  try {
    const { error } = await supabase.from("messages").insert({
      conversation_id: currentChatId,
      sender_id: currentUser.id,
      content
    });
    if (error) throw error;
    messageInput.value = "";
    showAppMessage("");
    await fetchMessages(currentChatId);
  } catch (error) {
    console.error(error);
    showAppMessage("تعذر إرسال الرسالة: " + friendlyError(error));
  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
}
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter") sendMessage();
});

function formatLastSeen(value) {
  if (!value) return "⚫ غير متصل";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "⚫ غير متصل";
  if (Date.now() - time < 120000) return "🟢 متصل الآن";
  return "⚫ آخر ظهور " + new Date(value).toLocaleString("ar-EG");
}

async function refreshFriendStatus(friendId) {
  const status = $("friendStatus");
  if (!status) return;
  const { data, error } = await supabase
    .from("profiles")
    .select("last_seen")
    .eq("id", friendId)
    .maybeSingle();
  if (error) {
    status.textContent = "تعذر تحميل الحالة";
    return;
  }
  status.textContent = formatLastSeen(data?.last_seen);
}

function listenToFriend(friendId) {
  const old = $("friendStatus");
  if (old) old.remove();
  const status = document.createElement("p");
  status.id = "friendStatus";
  status.style.margin = "4px 0 0";
  status.style.fontSize = "12px";
  chatTitle.insertAdjacentElement("afterend", status);
  refreshFriendStatus(friendId);
  friendStatusTimer = setInterval(() => {
    if (currentFriendId === friendId) refreshFriendStatus(friendId);
  }, 30000);
}

searchBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  const username = searchInput.value.trim().replace(/^@/, "").toLowerCase();
  if (!username) {
    showAppMessage("اكتب اسم المستخدم للبحث");
    return;
  }
  searchResults.replaceChildren();
  showAppMessage("جارٍ البحث عن @" + username + "...");
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,last_seen")
      .eq("username", username)
      .neq("id", currentUser.id)
      .limit(10);
    if (error) throw error;
    if (!data?.length) {
      showAppMessage("لم يتم العثور على هذا المستخدم. تأكد من كتابة اسم المستخدم كاملًا.");
      return;
    }

    data.forEach(profile => {
      const row = document.createElement("div");
      row.className = "search-result";
      const label = document.createElement("span");
      label.textContent = (profile.avatar_url || "👤") + " " +
        (profile.display_name || profile.username) + "  @" + profile.username;
      const button = document.createElement("button");
      button.textContent = "مراسلة";
      button.addEventListener("click", () =>
        openChat(profile.id, profile.display_name || profile.username)
      );
      row.append(label, button);
      searchResults.appendChild(row);
    });
    showAppMessage("");
  } catch (error) {
    console.error(error);
    showAppMessage("حدث خطأ في البحث: " + friendlyError(error));
  }
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") searchBtn.click();
});

backBtn.addEventListener("click", () => {
  conversationSection.hidden = true;
  stopMessagesChannel();
  stopFriendStatus();
  const status = $("friendStatus");
  if (status) status.remove();
  currentChatId = null;
  currentFriendId = null;
});

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    showMessage("تم تسجيل الخروج.");
  } catch (error) {
    showAppMessage("تعذر تسجيل الخروج: " + friendlyError(error));
  } finally {
    logoutBtn.disabled = false;
  }
});
