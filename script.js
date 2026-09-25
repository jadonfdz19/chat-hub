
// ==========================================
// CHAT HUB - PRIVATE CONVERSATIONS
// ==========================================

const SUPABASE_URL = "https://tqedgpapfslnhxavlivu.supabase.co";

// Paste your Supabase PUBLISHABLE KEY here
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6bWIsy2wN0L6k1ocp6eOQA_AMITaJLe";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let currentConversation = null;


// ==========================================
// LOGIN / SIGN UP SCREENS
// ==========================================

function showLogin() {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("signupForm").style.display = "none";
}

function showSignup() {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("signupForm").style.display = "block";
}


// ==========================================
// SIGN UP
// ==========================================

async function signup() {

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
        alert("Please fill in all the fields.");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }

    const { data, error } =
        await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

    if (error) {
        alert(error.message);
        return;
    }

    if (!data.user) {
        alert("Account could not be created.");
        return;
    }

    const { error: profileError } =
        await supabaseClient
            .from("profiles")
            .insert({
                id: data.user.id,
                name: name,
                email: email
            });

    if (profileError) {
        alert("Profile error: " + profileError.message);
        return;
    }

    if (!data.session) {
        alert(
            "Account created successfully! 🎉\n\n" +
            "Please confirm your email and then sign in."
        );

        showLogin();
        return;
    }

    alert("Account created successfully! 🎉");

    showChatScreen(data.user);
}


// ==========================================
// LOGIN
// ==========================================

async function login() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    if (!email || !password) {
        alert("Please enter your email and password.");
        return;
    }

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

    if (error) {
        alert(error.message);
        return;
    }

    showChatScreen(data.user);
}


// ==========================================
// SHOW CHAT SCREEN
// ==========================================

async function showChatScreen(user) {

    currentUser = user;

    document.getElementById("authScreen").style.display = "none";
    document.getElementById("chatScreen").style.display = "flex";

    await loadProfile(user);
    await loadConversations();
}


// ==========================================
// LOAD PROFILE
// ==========================================

async function loadProfile(user) {

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("name, email")
            .eq("id", user.id)
            .single();

    if (error) {
        console.error(error);

        document.getElementById("currentUserName").textContent =
            user.email;

        return;
    }

    document.getElementById("currentUserName").textContent =
        data.name;
}


// ==========================================
// LOGOUT
// ==========================================

async function logout() {

    await supabaseClient.auth.signOut();

    currentUser = null;
    currentConversation = null;

    document.getElementById("chatScreen").style.display = "none";
    document.getElementById("authScreen").style.display = "flex";

    showLogin();
}


// ==========================================
// LOAD PRIVATE CONVERSATIONS
// ==========================================

async function loadConversations() {

    const privateChats =
        document.getElementById("privateChats");

    privateChats.innerHTML = "";

    const { data, error } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .or(
                `user1.eq.${currentUser.id},user2.eq.${currentUser.id}`
            );

    if (error) {

        console.error(error);

        privateChats.innerHTML =
            `<div class="empty-conversations">
                Could not load conversations.
            </div>`;

        return;
    }

    if (!data || data.length === 0) {

        privateChats.innerHTML =
            `<div class="empty-conversations">
                No conversations yet.
            </div>`;

        return;
    }

    for (const conversation of data) {

        const otherUserId =
            conversation.user1 === currentUser.id
                ? conversation.user2
                : conversation.user1;

        const { data: profile } =
            await supabaseClient
                .from("profiles")
                .select("name, email")
                .eq("id", otherUserId)
                .single();

        if (!profile) continue;

        const chatItem =
            document.createElement("div");

        chatItem.className = "conversation-item";

        chatItem.innerHTML = `
            <div class="avatar">👤</div>

            <div class="conversation-info">
                <strong>${escapeHTML(profile.name)}</strong>
                <small>Private conversation</small>
            </div>
        `;

        chatItem.onclick = function () {
            openPrivateChat(
                conversation,
                profile
            );
        };

        privateChats.appendChild(chatItem);
    }
}


// ==========================================
// NEW PRIVATE CONVERSATION
// ==========================================

async function newConversation() {

    if (!currentUser) return;

    const email = prompt(
        "Enter the email address of the person you want to chat with:"
    );

    if (!email) return;

    const cleanEmail =
        email.trim().toLowerCase();


    // Find the other user
    const { data: otherUser, error: userError } =
        await supabaseClient
            .from("profiles")
            .select("id, name, email")
            .eq("email", cleanEmail)
            .single();

    if (userError || !otherUser) {

        alert(
            "No Chat Hub user was found with that email address."
        );

        return;
    }


    if (otherUser.id === currentUser.id) {

        alert(
            "You cannot start a private chat with yourself."
        );

        return;
    }


    // Check if conversation already exists
    const { data: existing } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .or(
                `and(user1.eq.${currentUser.id},user2.eq.${otherUser.id}),and(user1.eq.${otherUser.id},user2.eq.${currentUser.id})`
            );


    if (existing && existing.length > 0) {

        openPrivateChat(
            existing[0],
            otherUser
        );

        return;
    }


    // Create conversation
    const { data: conversation, error } =
        await supabaseClient
            .from("conversations")
            .insert({
                user1: currentUser.id,
                user2: otherUser.id
            })
            .select()
            .single();

    if (error) {

        alert(
            "Could not create conversation: "
            + error.message
        );

        return;
    }


    await loadConversations();

    openPrivateChat(
        conversation,
        otherUser
    );
}


// ==========================================
// OPEN PRIVATE CHAT
// ==========================================

function openPrivateChat(
    conversation,
    otherUser
) {

    currentConversation = conversation;

    document.getElementById("conversationName").textContent =
        otherUser.name;

    document.getElementById("conversationStatus").textContent =
        "Private conversation";

    document.getElementById("conversationAvatar").textContent =
        "👤";


    document.getElementById("messageInput").disabled = false;

    document.getElementById("sendButton").disabled = false;


    loadMessages();
}


// ==========================================
// LOAD MESSAGES
// ==========================================

async function loadMessages() {

    const messagesBox =
        document.getElementById("messages");

    messagesBox.innerHTML = "";

    if (!currentConversation) return;


    const { data, error } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "conversation_id",
                currentConversation.id
            )
            .order("created_at", {
                ascending: true
            });


    if (error) {

        console.error("Message loading error:", error);

        messagesBox.innerHTML =
            `<div class="welcome-panel">
                <div class="welcome-icon">⚠</div>
                <h2>Unable to load messages</h2>
                <p>${escapeHTML(error.message)}</p>
            </div>`;

        return;
    }


    if (!data || data.length === 0) {

        messagesBox.innerHTML =
            `<div class="welcome-panel">

                <div class="welcome-icon">✦</div>

                <h2>Start the conversation</h2>

                <p>Send your first message.</p>

            </div>`;

        return;
    }


    for (const message of data) {

        displayMessage(message);

    }


    messagesBox.scrollTop =
        messagesBox.scrollHeight;
}


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(message) {

    const messagesBox =
        document.getElementById("messages");

    const messageDiv =
        document.createElement("div");

    const mine =
        message.sender_id === currentUser.id;


    messageDiv.className =
        mine
            ? "message message-own"
            : "message message-other";


    const time =
        message.created_at
            ? new Date(message.created_at)
                .toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                })
            : "";


    messageDiv.innerHTML = `
        <div class="message-bubble">
            ${escapeHTML(message.message)}
        </div>

        <small class="message-time">
            ${time}
        </small>
    `;


    messagesBox.appendChild(messageDiv);
}


// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage() {

    if (!currentUser || !currentConversation) {

        alert(
            "Please open a conversation first."
        );

        return;
    }


    const input =
        document.getElementById("messageInput");

    const text =
        input.value.trim();


    if (!text) return;


    const { error } =
        await supabaseClient
            .from("messages")
            .insert({
                conversation_id: currentConversation.id,
                sender_id: currentUser.id,
                message: text
            });


    if (error) {

        alert(
            "Could not send message: "
            + error.message
        );

        return;
    }


    input.value = "";

    await loadMessages();
}


// ==========================================
// ENTER KEY
// ==========================================

function handleEnter(event) {

    if (event.key === "Enter") {

        event.preventDefault();

        sendMessage();

    }
}


// ==========================================
// SEARCH
// ==========================================

function searchChats() {

    const search =
        document.getElementById("searchChats")
            .value
            .toLowerCase();

    const items =
        document.querySelectorAll(
            ".conversation-item"
        );


    items.forEach(item => {

        const text =
            item.textContent.toLowerCase();

        item.style.display =
            text.includes(search)
                ? "flex"
                : "none";

    });
}


// ==========================================
// SECURITY
// ==========================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text || "";

    return div.innerHTML;
}


// ==========================================
// CHECK LOGIN
// ==========================================

async function checkUser() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {

        console.error(error);

        return;
    }

    if (data.session) {

        showChatScreen(
            data.session.user
        );

    }
}


// ==========================================
// START CHAT HUB
// ==========================================

checkUser();