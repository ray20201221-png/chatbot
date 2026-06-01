const API = "https://back-i9l7.onrender.com";
const token = localStorage.getItem("token");

const userList = document.getElementById("userList");
const selectedUser = document.getElementById("selectedUser");
const messageList = document.getElementById("messageList");
const codeFile = document.getElementById("codeFile");
const codeViewer = document.getElementById("codeViewer");
const ragStatus = document.getElementById("ragStatus");
const searchLogList = document.getElementById("searchLogList");
const feedbackList = document.getElementById("feedbackList");

let currentUser = null;
let currentRagStatus = null;

function authHeaders(){
    return {
        "Authorization": `Bearer ${token}`
    };
}

async function apiGet(path){
    const res = await fetch(`${API}${path}`, {
        headers: authHeaders()
    });

    if(res.status === 401 || res.status === 403){
        logout();
        return null;
    }

    return res.json();
}

async function loadUsers(){
    const users = await apiGet("/admin/users");
    if(!users) return;

    userList.innerHTML = "";

    users.forEach(user => {
        const button = document.createElement("button");
        button.className = "admin-list-item";
        button.innerText = user.is_admin ? `${user.username} (admin)` : user.username;
        button.onclick = () => loadMessages(user);
        userList.appendChild(button);
    });

    if(users.length){
        loadMessages(users[0]);
    }
}

async function loadMessages(user){
    currentUser = user;
    selectedUser.innerText = user.username;
    messageList.innerHTML = "";

    const messages = await apiGet(`/admin/users/${user.id}/messages`);
    if(!messages) return;

    if(!messages.length){
        messageList.innerHTML = `<div class="empty-state">${t("emptyMessages")}</div>`;
        return;
    }

    messages.forEach(message => {
        const div = document.createElement("div");
        div.className = `admin-message ${message.role === "user" ? "me" : "bot"}`;
        div.innerText = `[${message.role}] ${message.content}`;
        messageList.appendChild(div);
    });
}

async function loadCodeFiles(){
    const files = await apiGet("/admin/code");
    if(!files) return;

    codeFile.innerHTML = "";

    files.forEach(file => {
        const option = document.createElement("option");
        option.value = file;
        option.innerText = file;
        codeFile.appendChild(option);
    });

    if(files.length){
        loadCodeFile();
    }
}

async function loadCodeFile(){
    const filename = codeFile.value;
    if(!filename) return;

    const data = await apiGet(`/admin/code/${encodeURIComponent(filename)}`);
    if(!data) return;

    codeViewer.innerText = data.content;
}

function renderRagStatus(){
    if(!currentRagStatus) return;

    const files = currentRagStatus.files.length
        ? currentRagStatus.files.map(file => `<li>${file}</li>`).join("")
        : `<li>${t("noKnowledge")}</li>`;

    ragStatus.innerHTML = `
        <p>${t("fileCount")}：${currentRagStatus.file_count}</p>
        <p>${t("minConfidence")}：${currentRagStatus.min_confidence}</p>
        <p>${t("folder")}：${currentRagStatus.knowledge_dir}</p>
        <ul>${files}</ul>
    `;
}

async function loadRagStatus(){
    currentRagStatus = await apiGet("/admin/rag/status");
    renderRagStatus();
}

async function rebuildRag(){
    const data = await fetch(`${API}/admin/rag/reindex`, {
        method: "POST",
        headers: authHeaders()
    });

    if(data.status === 401 || data.status === 403){
        logout();
        return;
    }

    alert(t("ragRebuilt"));
    loadRagStatus();
}

async function uploadKnowledgeFile(file){
    if(!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API}/admin/rag/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData
    });

    if(res.status === 401 || res.status === 403){
        logout();
        return;
    }

    if(!res.ok){
        const data = await res.json();
        alert(data.detail || "Upload failed");
        return;
    }

    alert(t("uploadDone"));
    document.getElementById("knowledgeUpload").value = "";
    loadRagStatus();
}

async function loadSearchLogs(){
    if(!searchLogList) return;

    const logs = await apiGet("/admin/search-logs");
    if(!logs) return;

    searchLogList.innerHTML = logs.length ? "" : `<div class="empty-state">${t("noConversations")}</div>`;
    logs.forEach(log => {
        const div = document.createElement("div");
        div.className = "admin-message bot";
        const sourceCount = log.sources ? log.sources.length : 0;
        div.innerText = `[${log.provider}] ${log.query}\nSources: ${sourceCount}\n${log.created_at || ""}`;
        searchLogList.appendChild(div);
    });
}

async function loadFeedback(){
    if(!feedbackList) return;

    const rows = await apiGet("/admin/feedback");
    if(!rows) return;

    feedbackList.innerHTML = rows.length ? "" : `<div class="empty-state">${t("emptyMessages")}</div>`;
    rows.forEach(row => {
        const div = document.createElement("div");
        div.className = `admin-message ${row.rating === "up" ? "me" : "bot"}`;
        div.innerText = `[${row.rating}] message #${row.message_id}\nuser #${row.user_id}\n${row.created_at || ""}`;
        feedbackList.appendChild(div);
    });
}

function onLanguageChanged(){
    renderRagStatus();
    if(currentUser){
        const empty = messageList.querySelector(".empty-state");
        if(empty){
            empty.innerText = t("emptyMessages");
        }
    }
}

function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("is_admin");
    location.href = "login.html";
}

loadUsers();
loadCodeFiles();
loadRagStatus();
loadSearchLogs();
loadFeedback();
