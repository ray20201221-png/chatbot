const API = "https://back-i9l7.onrender.com";

const chatBox = document.getElementById("chat");
const token = localStorage.getItem("token");
const username = localStorage.getItem("username") || "User";
const isAdmin = localStorage.getItem("is_admin") === "1";
const adminButton = document.getElementById("adminButton");
const userBadge = document.getElementById("userBadge");
const conversationList = document.getElementById("conversationList");
const webSearchButton = document.getElementById("webSearchButton");
let activeConversationId = null;
let webSearchEnabled = localStorage.getItem("web_search") === "1";

document.body.classList.add("app-ready");

if(adminButton && isAdmin){
    adminButton.style.display = "flex";
}

if(userBadge){
    userBadge.innerText = username.slice(0, 1).toUpperCase();
    userBadge.title = username;
}

if(window.lucide){
    lucide.createIcons();
}

function updateWebSearchButton(){
    if(!webSearchButton) return;

    webSearchButton.classList.toggle("active", webSearchEnabled);
    webSearchButton.setAttribute("aria-pressed", String(webSearchEnabled));
    webSearchButton.title = webSearchEnabled ? t("webSearchOn") : t("webSearchOff");
}

function toggleWebSearch(){
    webSearchEnabled = !webSearchEnabled;
    localStorage.setItem("web_search", webSearchEnabled ? "1" : "0");
    updateWebSearchButton();
}

function authHeaders(){
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function removeWelcome(){
    const welcome = document.getElementById("welcome");
    if(welcome) welcome.remove();
}

function usePrompt(text){
    const input = document.getElementById("msg");
    input.value = text;
    input.focus();
}

function addMsg(text, type){
    removeWelcome();

    const row = document.createElement("div");
    row.className = `message-row ${type}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerText = type === "bot" ? "AI" : username.slice(0, 1).toUpperCase();

    const bubble = document.createElement("div");
    bubble.className = "msg";

    if(type === "bot"){
        bubble.innerHTML = marked.parse(text);
    }else{
        bubble.innerText = text;
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatBox.appendChild(row);
    scrollBottom();
}

function clearMessages(){
    chatBox.innerHTML = "";
}

function showWelcome(){
    chatBox.innerHTML = `
        <section id="welcome" class="welcome-panel">
            <div class="assistant-mark">AI</div>
            <h2 data-i18n="welcomeTitle">What can we work through today?</h2>
            <p data-i18n="welcomeText">Ask a question, explore your documents, or test the RAG pipeline.</p>
            <div class="prompt-row">
                <button onclick="usePrompt(t('promptKnowledgeText'))" data-i18n="promptKnowledge">Summarize knowledge</button>
                <button onclick="usePrompt(t('promptRagText'))" data-i18n="promptRag">Explain RAG</button>
                <button onclick="usePrompt(t('promptDeployText'))" data-i18n="promptDeploy">Debug deployment</button>
            </div>
        </section>
    `;
    applyI18n();
}

function addLoadingMsg(id){
    removeWelcome();

    const row = document.createElement("div");
    row.className = "message-row bot";
    row.id = id;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerText = "AI";

    const bubble = document.createElement("div");
    bubble.className = "msg loading";
    bubble.innerHTML = `
        <div class="typing-loader">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatBox.appendChild(row);
    scrollBottom();
}

function removeLoadingMsg(id){
    const el = document.getElementById(id);
    if(el) el.remove();
}

function scrollBottom(){
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function send(){
    const input = document.getElementById("msg");
    const msg = input.value.trim();
    if(!msg) return;

    addMsg(msg, "me");
    input.value = "";

    const loadingId = "loading-" + Date.now();
    addLoadingMsg(loadingId);

    try{
        const res = await fetch(`${API}/chat`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                message: msg,
                web_search: webSearchEnabled
            })
        });

        if(res.status === 401){
            logout();
            return;
        }

        const data = await res.json();
        if(data.conversation_id){
            activeConversationId = data.conversation_id;
        }
        removeLoadingMsg(loadingId);
        addMsg(data.reply || t("backendNoReply"), "bot");
        loadConversations();
    }catch(err){
        console.log(err);
        removeLoadingMsg(loadingId);
        addMsg(t("connectionFailed"), "bot");
    }
}

async function newChat(){
    const res = await fetch(`${API}/clear`, {
        method: "POST",
        headers: authHeaders()
    });

    if(res.status === 401){
        logout();
        return;
    }

    const data = await res.json();
    activeConversationId = data.conversation_id;
    showWelcome();
    loadConversations();
}

async function loadConversations(){
    if(!conversationList) return;

    const res = await fetch(`${API}/conversations`, {
        headers: authHeaders()
    });

    if(res.status === 401){
        logout();
        return;
    }

    const conversations = await res.json();
    conversationList.innerHTML = "";

    if(!conversations.length){
        conversationList.innerHTML = `<div class="empty-history">${t("noConversations")}</div>`;
        return;
    }

    conversations.forEach(conversation => {
        const button = document.createElement("button");
        button.className = "conversation-item";
        if(conversation.id === activeConversationId || conversation.active){
            button.classList.add("active");
            activeConversationId = conversation.id;
        }
        button.innerText = conversation.title || t("newChat");
        button.onclick = () => loadConversation(conversation.id);
        conversationList.appendChild(button);
    });
}

async function loadConversation(conversationId){
    const res = await fetch(`${API}/conversations/${conversationId}/messages`, {
        headers: authHeaders()
    });

    if(res.status === 401){
        logout();
        return;
    }

    activeConversationId = conversationId;
    const messages = await res.json();
    clearMessages();

    if(!messages.length){
        showWelcome();
    }else{
        messages.forEach(message => {
            addMsg(message.content, message.role === "user" ? "me" : "bot");
        });
    }

    loadConversations();
}

function openAdmin(){
    location.href = "admin.html";
}

function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("is_admin");
    location.href = "login.html";
}

function onLanguageChanged(){
    loadConversations();
    updateWebSearchButton();
}

updateWebSearchButton();
loadConversations();
