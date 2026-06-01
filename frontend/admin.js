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
const dashboardCards = document.getElementById("dashboardCards");
const knowledgeCategory = document.getElementById("knowledgeCategory");
const knowledgeSearch = document.getElementById("knowledgeSearch");
const knowledgeFilter = document.getElementById("knowledgeFilter");

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

function escapeHtml(value){
    return String(value || "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

async function loadDashboard(){
    if(!dashboardCards) return;

    const data = await apiGet("/admin/dashboard");
    if(!data) return;

    const cards = [
        [t("users"), data.users],
        [t("chatHistory"), data.conversations],
        [t("userMessages"), data.messages],
        [t("searchLogs"), data.web_searches],
        [t("feedback"), `${data.feedback_up} / ${data.feedback_down}`],
        [t("fileCount"), data.rag_file_count],
        [t("minConfidence"), data.min_confidence],
        [t("webUsage"), `${Math.round(data.web_usage_rate * 100)}%`],
    ];

    dashboardCards.innerHTML = cards.map(([label, value]) => `
        <div class="dashboard-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `).join("");

    const trend = document.getElementById("dashboardTrend");
    const domains = document.getElementById("topDomains");
    const frequent = document.getElementById("frequentQuestions");
    const refusal = document.getElementById("refusalStats");
    if(trend){
        trend.innerHTML = data.daily_activity.map(day => `
            <div class="trend-row">
                <span>${escapeHtml(day.date)}</span>
                <div class="trend-bars">
                    <div class="trend-bar message" style="width:${Math.min(day.messages * 12, 100)}%"></div>
                    <div class="trend-bar search" style="width:${Math.min(day.searches * 12, 100)}%"></div>
                    <div class="trend-bar up" style="width:${Math.min(day.feedback_up * 20, 100)}%"></div>
                    <div class="trend-bar down" style="width:${Math.min(day.feedback_down * 20, 100)}%"></div>
                </div>
            </div>
        `).join("");
    }

    if(domains){
        domains.innerHTML = data.top_domains.length
            ? data.top_domains.map(item => `
                <li>
                    <strong>${escapeHtml(item.domain)}</strong>
                    <span>${escapeHtml(item.count)}</span>
                </li>
            `).join("")
            : `<li class="empty-state">${t("noKnowledge")}</li>`;
    }

    if(frequent){
        frequent.innerHTML = data.frequent_questions.length
            ? data.frequent_questions.map(item => `
                <li>
                    <strong>${escapeHtml(item.question)}</strong>
                    <span>${escapeHtml(item.count)}</span>
                </li>
            `).join("")
            : `<li class="empty-state">${t("noConversations")}</li>`;
    }

    if(refusal){
        const rate = Math.round((data.refusal_rate || 0) * 100);
        refusal.innerHTML = `
            <strong>${escapeHtml(data.refused_count || 0)}</strong>
            <span>${escapeHtml(rate)}%</span>
            <div class="quality-track">
                <div style="width:${Math.min(rate, 100)}%"></div>
            </div>
        `;
    }
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
    renderKnowledgeCategories();
    renderRagStatus();
}

function renderKnowledgeCategories(){
    if(!currentRagStatus || !knowledgeFilter) return;

    const selected = knowledgeFilter.value;
    knowledgeFilter.innerHTML = `<option value="">${t("allCategories")}</option>`;
    (currentRagStatus.categories || ["general"]).forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.innerText = category;
        knowledgeFilter.appendChild(option);
    });
    knowledgeFilter.value = selected;
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
    formData.append("category", knowledgeCategory?.value || "general");

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
    loadDashboard();
}

async function previewKnowledgeFile(filename){
    const data = await apiGet(`/admin/rag/files/${encodeURIComponent(filename)}`);
    if(!data) return;

    codeViewer.innerText = data.preview;
}

async function showKnowledgeVersions(filename){
    const data = await apiGet(`/admin/rag/versions/${encodeURIComponent(filename)}`);
    if(!data) return;

    codeViewer.innerText = data.versions.length
        ? data.versions.map(version => `${version.name} | ${version.size} bytes | ${version.created_at}`).join("\n")
        : t("noVersions");
}

async function deleteKnowledgeFile(filename){
    if(!confirm(`${t("delete")} ${filename}?`)) return;

    const res = await fetch(`${API}/admin/rag/files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: authHeaders()
    });

    if(res.status === 401 || res.status === 403){
        logout();
        return;
    }

    if(!res.ok){
        const data = await res.json();
        alert(data.detail || "Delete failed");
        return;
    }

    loadRagStatus();
    loadDashboard();
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
        const sources = (log.sources || [])
            .map((source, index) => `[${index + 1}] ${source.credibility || "unknown"} - ${source.title || source.url}`)
            .join("\n");
        div.innerText = `[${log.provider}] ${log.query}\nSources: ${sourceCount}\n${sources}\n${log.created_at || ""}`;
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
    loadDashboard();
    renderRagStatus();
    if(currentUser){
        const empty = messageList.querySelector(".empty-state");
        if(empty){
            empty.innerText = t("emptyMessages");
        }
    }
}

function renderRagStatus(){
    if(!currentRagStatus) return;

    const query = (knowledgeSearch?.value || "").trim().toLowerCase();
    const category = knowledgeFilter?.value || "";
    const visibleFiles = currentRagStatus.files.filter(file => {
        const item = typeof file === "string" ? { name: file, category: "general" } : file;
        const matchesQuery = !query || item.name.toLowerCase().includes(query);
        const matchesCategory = !category || item.category === category;
        return matchesQuery && matchesCategory;
    });

    const files = visibleFiles.length
        ? visibleFiles.map(file => {
            const item = typeof file === "string" ? { name: file } : file;
            return `
                <li class="knowledge-file">
                    <span>
                        <strong>${escapeHtml(item.name)}</strong>
                        <small>${escapeHtml(item.category || "general")} | ${escapeHtml(item.extension || "")} | ${escapeHtml(item.size || 0)} bytes | v${escapeHtml((item.version_count || 0) + 1)} | ${escapeHtml(item.modified_at || "")}</small>
                    </span>
                    <button onclick="previewKnowledgeFile('${escapeHtml(item.name)}')" title="${t("preview")}">
                        <i data-lucide="eye"></i>
                    </button>
                    <button onclick="showKnowledgeVersions('${escapeHtml(item.name)}')" title="${t("versions")}">
                        <i data-lucide="history"></i>
                    </button>
                    <button onclick="deleteKnowledgeFile('${escapeHtml(item.name)}')" title="${t("delete")}">
                        <i data-lucide="trash-2"></i>
                    </button>
                </li>
            `;
        }).join("")
        : `<li>${t("noKnowledge")}</li>`;

    ragStatus.innerHTML = `
        <p>${t("fileCount")}: ${currentRagStatus.file_count}</p>
        <p>${t("minConfidence")}: ${currentRagStatus.min_confidence}</p>
        <p>${t("folder")}: ${currentRagStatus.knowledge_dir}</p>
        <ul>${files}</ul>
    `;
    if(window.lucide){
        lucide.createIcons();
    }
}

function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("is_admin");
    location.href = "login.html";
}

loadUsers();
loadDashboard();
loadCodeFiles();
loadRagStatus();
loadSearchLogs();
loadFeedback();
