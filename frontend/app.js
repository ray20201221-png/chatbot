const API = "https://back-i9l7.onrender.com";

const chatBox = document.getElementById("chat");
const token = localStorage.getItem("token");
const username = localStorage.getItem("username") || "User";
const isAdmin = localStorage.getItem("is_admin") === "1";
const adminButton = document.getElementById("adminButton");
const userBadge = document.getElementById("userBadge");
const conversationList = document.getElementById("conversationList");
const conversationSearch = document.getElementById("conversationSearch");
const webSearchButton = document.getElementById("webSearchButton");
const searchModeSelect = document.getElementById("searchMode");
let activeConversationId = null;
let searchMode = localStorage.getItem("search_mode") || (localStorage.getItem("web_search") === "1" ? "web" : "auto");
let lastUserMessage = "";

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

    const webSearchEnabled = searchMode === "web" || searchMode === "mixed";
    webSearchButton.classList.toggle("active", webSearchEnabled);
    webSearchButton.setAttribute("aria-pressed", String(webSearchEnabled));
    webSearchButton.title = webSearchEnabled ? t("webSearchOn") : t("webSearchOff");

    if(searchModeSelect){
        searchModeSelect.value = searchMode;
    }
}

function toggleWebSearch(){
    searchMode = searchMode === "web" || searchMode === "mixed" ? "auto" : "web";
    localStorage.setItem("search_mode", searchMode);
    localStorage.setItem("web_search", searchMode === "web" || searchMode === "mixed" ? "1" : "0");
    updateWebSearchButton();
}

function setSearchMode(mode){
    searchMode = ["auto", "rag", "web", "mixed"].includes(mode) ? mode : "auto";
    localStorage.setItem("search_mode", searchMode);
    localStorage.setItem("web_search", searchMode === "web" || searchMode === "mixed" ? "1" : "0");
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

function escapeHtml(value){
    return String(value || "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
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
    return row;
}

function addBotShell(){
    removeWelcome();

    const row = document.createElement("div");
    row.className = "message-row bot";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerText = "AI";

    const bubble = document.createElement("div");
    bubble.className = "msg";

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatBox.appendChild(row);
    scrollBottom();

    return { row, bubble };
}

function renderSourceCards(row, data){
    const webSources = data.web_sources || [];
    const ragSources = data.sources || [];
    const confidence = data.source_confidence;
    if(!webSources.length && !ragSources.length && !confidence) return;

    const panel = document.createElement("div");
    panel.className = "source-panel";

    if(confidence){
        const summary = document.createElement("div");
        summary.className = `source-confidence ${confidence.level || "low"}`;
        summary.innerHTML = `
            <strong>${escapeHtml(t("sourceConfidence"))}: ${escapeHtml(confidence.level || "low")}</strong>
            <span>${escapeHtml(confidence.reason || "")}</span>
        `;
        panel.appendChild(summary);
    }

    webSources.forEach(source => {
        const card = document.createElement("a");
        card.className = "source-card";
        card.href = source.url;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.innerHTML = `
            <span>${escapeHtml(source.provider || "web")} · ${escapeHtml(source.credibility || "unknown")} · [${escapeHtml(source.citation || "?")}]</span>
            <strong>${escapeHtml(source.title || source.url)}</strong>
            <p>${escapeHtml(source.domain || "")}</p>
            <p>${escapeHtml(source.snippet || "")}</p>
        `;
        panel.appendChild(card);
    });

    ragSources.forEach(source => {
        const card = document.createElement("div");
        card.className = "source-card";
        card.innerHTML = `
            <span>RAG · [${escapeHtml(source.citation || "?")}]</span>
            <strong>${escapeHtml(source.source)}#${escapeHtml(source.chunk)}</strong>
            <p>${escapeHtml(source.domain || "knowledge-base")}</p>
            <p>Score: ${escapeHtml(source.score)}</p>
        `;
        panel.appendChild(card);
    });

    row.appendChild(panel);
}

function renderFeedback(row, messageId, replyText){
    if(!messageId) return;

    const controls = document.createElement("div");
    controls.className = "feedback-row";
    controls.innerHTML = `
        <button type="button" title="${t("copyAnswer")}" onclick="copyAnswer(this)">
            <i data-lucide="copy"></i>
        </button>
        <button type="button" title="${t("regenerate")}" onclick="regenerateAnswer()">
            <i data-lucide="rotate-cw"></i>
        </button>
        <button type="button" title="${t("goodAnswer")}" onclick="rateAnswer(${messageId}, 'up', this)">
            <i data-lucide="thumbs-up"></i>
        </button>
        <button type="button" title="${t("badAnswer")}" onclick="rateAnswer(${messageId}, 'down', this)">
            <i data-lucide="thumbs-down"></i>
        </button>
    `;
    controls.dataset.answer = replyText || "";
    row.appendChild(controls);
    if(window.lucide){
        lucide.createIcons();
    }
}

async function copyAnswer(button){
    const text = button.parentElement.dataset.answer || "";
    if(!text) return;

    await navigator.clipboard.writeText(text);
    button.classList.add("active");
    setTimeout(() => button.classList.remove("active"), 900);
}

async function rateAnswer(messageId, rating, button){
    try{
        const res = await fetch(`${API}/feedback`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ message_id: messageId, rating })
        });

        if(res.status === 401){
            logout();
            return;
        }

        button.parentElement.querySelectorAll("button").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
    }catch(err){
        console.log(err);
    }
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

    lastUserMessage = msg;
    addMsg(msg, "me");
    input.value = "";

    const loadingId = "loading-" + Date.now();
    addLoadingMsg(loadingId);

    try{
        const res = await fetch(`${API}/chat/stream`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(buildChatPayload(msg))
        });

        if(res.status === 401){
            logout();
            return;
        }

        removeLoadingMsg(loadingId);
        const bot = addBotShell();
        let reply = "";
        let buffer = "";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while(true){
            const { value, done } = await reader.read();
            if(done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop();

            for(const part of parts){
                if(!part.startsWith("data: ")) continue;
                const payload = JSON.parse(part.slice(6));
                if(payload.chunk){
                    reply += payload.chunk;
                    bot.bubble.innerHTML = marked.parse(reply);
                    scrollBottom();
                }
                if(payload.done){
                    if(payload.conversation_id){
                        activeConversationId = payload.conversation_id;
                    }
                    renderSourceCards(bot.row, payload);
                    renderFeedback(bot.row, payload.message_id, reply);
                }
            }
        }

        loadConversations();
    }catch(err){
        console.log(err);
        removeLoadingMsg(loadingId);
        addMsg(t("connectionFailed"), "bot");
    }
}

function buildChatPayload(message, regenerate = false){
    return {
        message,
        web_search: searchMode === "web" || searchMode === "mixed",
        search_mode: searchMode,
        regenerate
    };
}

async function regenerateAnswer(){
    const msg = lastUserMessage || [...chatBox.querySelectorAll(".message-row.me .msg")].pop()?.innerText || "";
    if(!msg) return;

    const loadingId = "loading-" + Date.now();
    addLoadingMsg(loadingId);

    try{
        const res = await fetch(`${API}/chat/stream`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(buildChatPayload(msg, true))
        });

        if(res.status === 401){
            logout();
            return;
        }

        removeLoadingMsg(loadingId);
        const bot = addBotShell();
        let reply = "";
        let buffer = "";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while(true){
            const { value, done } = await reader.read();
            if(done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop();

            for(const part of parts){
                if(!part.startsWith("data: ")) continue;
                const payload = JSON.parse(part.slice(6));
                if(payload.chunk){
                    reply += payload.chunk;
                    bot.bubble.innerHTML = marked.parse(reply);
                    scrollBottom();
                }
                if(payload.done){
                    renderSourceCards(bot.row, payload);
                    renderFeedback(bot.row, payload.message_id, reply);
                }
            }
        }
        loadConversations();
    }catch(err){
        console.log(err);
        removeLoadingMsg(loadingId);
        addMsg(t("connectionFailed"), "bot");
    }
}

function exportChat(){
    const rows = [...chatBox.querySelectorAll(".message-row")];
    const content = rows.map(row => {
        const role = row.classList.contains("me") ? username : "RUI AI";
        const text = row.querySelector(".msg")?.innerText || "";
        return `## ${role}\n\n${text}`;
    }).join("\n\n");

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rui-ai-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
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

    const query = (conversationSearch?.value || "").trim().toLowerCase();
    const filtered = query
        ? conversations.filter(conversation => (conversation.title || "").toLowerCase().includes(query))
        : conversations;

    if(!filtered.length){
        conversationList.innerHTML = `<div class="empty-history">${t("noConversations")}</div>`;
        return;
    }

    filtered.forEach(conversation => {
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
            if(message.role === "user"){
                lastUserMessage = message.content;
            }
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
