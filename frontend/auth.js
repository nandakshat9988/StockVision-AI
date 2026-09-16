/**
 * StockVision AI - Authentication & Session Management Module
 */

const AUTH_TOKEN_KEY = "stockvision_jwt_token";
const AUTH_USER_KEY = "stockvision_user";

// Determine backend API host based on environment
function getBackendUrl(path) {
    const isLiveServer = window.location.port === "5500" || window.location.port === "5501" || window.location.port === "8080" || window.location.protocol === "file:";
    const baseUrl = isLiveServer ? "http://127.0.0.1:5000" : "";
    return `${baseUrl}${path}`;
}

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || null;
}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem(AUTH_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function setSession(token, user) {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    updateNavAuthUI();
}

function clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    updateNavAuthUI();
}

function isLoggedIn() {
    return Boolean(getAuthToken());
}

async function authFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = options.headers ? { ...options.headers } : {};
    
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const fullUrl = url.startsWith("http") ? url : getBackendUrl(url);
    const response = await fetch(fullUrl, {
        ...options,
        headers
    });

    if (response.status === 401) {
        // Token expired or invalid
        console.warn("Session expired or unauthorized. Clearing session.");
        clearSession();
    }

    return response;
}

// -------------------------------------------------------------
// Auth Modal Controller & Form Logic
// -------------------------------------------------------------
function ensureAuthModalDOM() {
    if (document.getElementById("authModal")) return;

    const modalHtml = `
    <div id="authModal" class="auth-modal-overlay" style="display: none;">
        <div class="auth-modal-card">
            <button class="auth-close-btn" onclick="closeAuthModal()">&times;</button>
            
            <div class="auth-modal-header">
                <span class="auth-logo-icon">📈</span>
                <h3 id="authModalTitle">Welcome to <span class="gradient-text">StockVision AI</span></h3>
                <p id="authModalSubtitle">Sign in to save recent stocks, track favorites, and get curated news.</p>
            </div>

            <!-- Tab Switcher -->
            <div class="auth-tabs">
                <button id="tabLogin" class="auth-tab active" onclick="switchAuthTab('login')">Sign In</button>
                <button id="tabRegister" class="auth-tab" onclick="switchAuthTab('register')">Create Account</button>
            </div>

            <!-- Error Banner -->
            <div id="authErrorBanner" class="auth-error-banner" style="display: none;"></div>

            <!-- Form -->
            <form id="authForm" onsubmit="handleAuthSubmit(event)">
                <div id="usernameFieldGroup" class="auth-form-group" style="display: none;">
                    <label for="authUsername">Username</label>
                    <input type="text" id="authUsername" placeholder="e.g. quantum_trader" autocomplete="username">
                </div>

                <div class="auth-form-group">
                    <label id="identifierLabel" for="authIdentifier">Email or Username</label>
                    <input type="text" id="authIdentifier" placeholder="name@example.com" required autocomplete="username">
                </div>

                <div class="auth-form-group">
                    <label for="authPassword">Password</label>
                    <input type="password" id="authPassword" placeholder="••••••••" required autocomplete="current-password">
                </div>

                <button type="submit" id="authSubmitBtn" class="btn-auth-submit">
                    <span>Sign In</span> ⚡
                </button>
            </form>

            <div class="auth-modal-footer">
                <small>🔒 Secured with JWT, MongoDB & Redis caching.</small>
            </div>
        </div>
    </div>
    `;

    const div = document.createElement("div");
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);

    // Close on overlay click
    const modalEl = document.getElementById("authModal");
    modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) closeAuthModal();
    });
}

let currentAuthMode = "login";

function openAuthModal(mode = "login") {
    ensureAuthModalDOM();
    currentAuthMode = mode;
    switchAuthTab(mode);
    const modal = document.getElementById("authModal");
    if (modal) {
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("active"), 10);
    }
}

function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => {
            modal.style.display = "none";
        }, 200);
    }
    const err = document.getElementById("authErrorBanner");
    if (err) err.style.display = "none";
}

function switchAuthTab(mode) {
    currentAuthMode = mode;
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const usernameGroup = document.getElementById("usernameFieldGroup");
    const idLabel = document.getElementById("identifierLabel");
    const idInput = document.getElementById("authIdentifier");
    const title = document.getElementById("authModalTitle");
    const subtitle = document.getElementById("authModalSubtitle");
    const submitBtn = document.getElementById("authSubmitBtn");
    const err = document.getElementById("authErrorBanner");
    if (err) err.style.display = "none";

    if (mode === "login") {
        if (tabLogin) tabLogin.classList.add("active");
        if (tabRegister) tabRegister.classList.remove("active");
        if (usernameGroup) usernameGroup.style.display = "none";
        if (idLabel) idLabel.innerText = "Email or Username";
        if (idInput) idInput.placeholder = "name@example.com or trader123";
        if (title) title.innerHTML = `Welcome back to <span class="gradient-text">StockVision AI</span>`;
        if (subtitle) subtitle.innerText = "Sign in to access your portfolio, recent checks, and AI news.";
        if (submitBtn) submitBtn.innerHTML = `<span>Sign In</span> ⚡`;
    } else {
        if (tabLogin) tabLogin.classList.remove("active");
        if (tabRegister) tabRegister.classList.add("active");
        if (usernameGroup) usernameGroup.style.display = "block";
        if (idLabel) idLabel.innerText = "Email Address";
        if (idInput) idInput.placeholder = "trader@domain.com";
        if (title) title.innerHTML = `Create Your <span class="gradient-text">Account</span>`;
        if (subtitle) subtitle.innerText = "Store your favorite stocks in MongoDB, with instant Redis cache retrieval.";
        if (submitBtn) submitBtn.innerHTML = `<span>Create Account</span> 🚀`;
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const err = document.getElementById("authErrorBanner");
    const submitBtn = document.getElementById("authSubmitBtn");
    if (err) err.style.display = "none";

    const password = document.getElementById("authPassword").value;
    const identifier = document.getElementById("authIdentifier").value;
    const username = document.getElementById("authUsername") ? document.getElementById("authUsername").value : "";

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Processing...</span> ⏳`;

    try {
        let endpoint, body;
        if (currentAuthMode === "login") {
            endpoint = "/api/auth/login";
            body = { emailOrUsername: identifier, password };
        } else {
            endpoint = "/api/auth/register";
            body = { username: username, email: identifier, password };
        }

        const res = await fetch(getBackendUrl(endpoint), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || "Authentication failed. Please check your credentials.");
        }

        // Save session
        setSession(data.token, data.user);
        closeAuthModal();

        // If on stock or profile page, refresh or update UI
        if (window.location.pathname.includes("profile.html")) {
            window.location.reload();
        } else if (typeof syncFavoriteButtonState === "function") {
            syncFavoriteButtonState();
        }

    } catch (error) {
        if (err) {
            err.innerText = error.message;
            err.style.display = "block";
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = currentAuthMode === "login" ? `<span>Sign In</span> ⚡` : `<span>Create Account</span> 🚀`;
    }
}

function handleLogout() {
    clearSession();
    if (window.location.pathname.includes("profile.html")) {
        window.location.href = "index.html";
    } else {
        window.location.reload();
    }
}

// -------------------------------------------------------------
// Dynamic Navbar Sync (Index, Stock, Profile)
// -------------------------------------------------------------
function updateNavAuthUI() {
    const user = getCurrentUser();
    const navActions = document.querySelector(".nav-actions") || document.querySelector(".dash-header");
    if (!navActions) return;

    let authContainer = document.getElementById("navAuthControls");
    if (!authContainer) {
        authContainer = document.createElement("div");
        authContainer.id = "navAuthControls";
        authContainer.className = "nav-auth-controls";
        navActions.appendChild(authContainer);
    }

    if (user && user.username) {
        authContainer.innerHTML = `
            <a href="profile.html" class="btn-profile-nav" title="View Profile">
                <span class="user-avatar-pill">${user.username.slice(0, 2).toUpperCase()}</span>
                <span class="user-name-pill">${user.username}</span>
            </a>
            <button onclick="handleLogout()" class="btn-nav-logout" title="Sign Out">Sign Out</button>
        `;
    } else {
        authContainer.innerHTML = `
            <button onclick="openAuthModal('login')" class="btn-nav-login">Sign In</button>
            <button onclick="openAuthModal('register')" class="btn-nav-register">Register</button>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    ensureAuthModalDOM();
    updateNavAuthUI();
});
