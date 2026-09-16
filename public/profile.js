/**
 * StockVision AI - User Profile Dashboard Logic
 */

let cachedUserData = null;

function formatRelativeTime(dateStr) {
    if (!dateStr) return "Recently";
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (e) {
        return "Recent";
    }
}

function launchStockAnalysis(symbol) {
    if (!symbol) return;
    localStorage.setItem("stock", symbol.toUpperCase());
    window.location.href = "stock.html";
}

async function checkSystemStatus() {
    try {
        const res = await fetch(getBackendUrl("/api/system/status"));
        if (res.ok) {
            const data = await res.json();
            const redisBadge = document.getElementById("redisBadge");
            const dbStatus = document.getElementById("sysDbStatus");
            
            if (redisBadge) {
                if (data.redis && data.redis.connected) {
                    redisBadge.innerHTML = `⚡ Redis Cache Connected`;
                    redisBadge.className = "badge-cache active-redis";
                } else {
                    redisBadge.innerHTML = `⚡ In-Memory Cache Active`;
                    redisBadge.className = "badge-cache";
                }
            }
            if (dbStatus && data.mongo && data.mongo.connected) {
                dbStatus.innerText = "MongoDB Synced";
            }
        }
    } catch (e) {
        console.warn("Status check failed:", e);
    }
}

async function loadProfileData() {
    if (!isLoggedIn()) {
        document.getElementById("guestPrompt").style.display = "block";
        document.getElementById("profileContent").style.display = "none";
        return;
    }

    document.getElementById("guestPrompt").style.display = "none";
    document.getElementById("profileContent").style.display = "block";

    try {
        const res = await authFetch("/api/user/profile");
        if (!res.ok) {
            throw new Error("Failed to load profile");
        }

        const data = await res.json();
        const profile = data.profile;
        cachedUserData = profile;

        // Render User Header
        const username = profile.username || "Trader";
        document.getElementById("profUsername").innerText = username;
        document.getElementById("profEmail").innerText = profile.email || "";
        document.getElementById("profAvatar").innerText = username.slice(0, 2).toUpperCase();

        if (profile.created_at) {
            try {
                const d = new Date(profile.created_at);
                document.getElementById("profCreated").innerText = d.toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric"
                });
            } catch (e) {
                document.getElementById("profCreated").innerText = "Recently";
            }
        }

        // Stats Counters
        const favs = profile.favorites || [];
        const recent = profile.recent_stocks || [];
        document.getElementById("statFavorites").innerText = favs.length;
        document.getElementById("statRecent").innerText = recent.length;
        document.getElementById("favCountPill").innerText = favs.length;
        document.getElementById("recentCountPill").innerText = recent.length;

        // Render Lists
        renderFavoritesList(favs);
        renderRecentStocksList(recent, favs);

        // Render News Feeds
        loadFavoriteStocksNews(favs);
        loadTopMarketNews();

    } catch (err) {
        console.error("Profile load error:", err);
    }
}

function renderFavoritesList(favs) {
    const listEl = document.getElementById("favoritesList");
    if (!listEl) return;

    if (!favs || favs.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>⭐ No favorite stocks marked yet.</p>
                <small>Quick pick to add popular stocks:</small>
                <div class="quick-pick-chips">
                    <button onclick="quickAddFavorite('AAPL')">+ AAPL</button>
                    <button onclick="quickAddFavorite('NVDA')">+ NVDA</button>
                    <button onclick="quickAddFavorite('TSLA')">+ TSLA</button>
                    <button onclick="quickAddFavorite('MSFT')">+ MSFT</button>
                </div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = "";
    favs.forEach(sym => {
        const item = document.createElement("div");
        item.className = "stock-row-card";
        item.innerHTML = `
            <div class="stock-row-info">
                <span class="stock-sym-badge">${sym}</span>
                <span class="stock-sub-meta">Favorited</span>
            </div>
            <div class="stock-row-actions">
                <button onclick="launchStockAnalysis('${sym}')" class="btn-action-analyze" title="Run AI Forecast">
                    ⚡ Forecast
                </button>
                <button onclick="removeFavoriteStock('${sym}')" class="btn-action-remove" title="Remove from favorites">
                    ✕
                </button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function renderRecentStocksList(recentList, favs = []) {
    const listEl = document.getElementById("recentStocksList");
    if (!listEl) return;

    if (!recentList || recentList.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>⏱️ No recently checked stocks yet.</p>
                <small>Analyze any ticker to see it tracked here automatically.</small>
                <div style="margin-top: 10px;">
                    <a href="index.html#search-anchor" class="btn-sm-primary">Search a Stock</a>
                </div>
            </div>
        `;
        return;
    }

    const favSet = new Set(favs.map(f => f.toUpperCase()));
    listEl.innerHTML = "";

    recentList.forEach(item => {
        const sym = (typeof item === "string" ? item : item.symbol).toUpperCase();
        const timeStr = typeof item === "object" ? formatRelativeTime(item.timestamp) : "Recent";
        const isFav = favSet.has(sym);

        const row = document.createElement("div");
        row.className = "stock-row-card";
        row.innerHTML = `
            <div class="stock-row-info">
                <span class="stock-sym-badge">${sym}</span>
                <span class="stock-sub-meta">${timeStr}</span>
            </div>
            <div class="stock-row-actions">
                ${!isFav ? `
                    <button onclick="quickAddFavorite('${sym}')" class="btn-action-fav" title="Add to Favorites">
                        ⭐ Add
                    </button>
                ` : `
                    <span class="already-fav-tag">★ Saved</span>
                `}
                <button onclick="launchStockAnalysis('${sym}')" class="btn-action-analyze" title="Run AI Forecast">
                    ⚡ Forecast
                </button>
            </div>
        `;
        listEl.appendChild(row);
    });
}

async function addFavoriteFromProfile() {
    const input = document.getElementById("addFavInput");
    if (!input) return;
    const sym = input.value.trim().toUpperCase();
    if (!sym) {
        alert("Please enter a stock ticker symbol (e.g. AAPL, NVDA).");
        return;
    }

    await quickAddFavorite(sym);
    input.value = "";
}

async function quickAddFavorite(symbol) {
    if (!symbol) return;
    try {
        const res = await authFetch("/api/user/favorites", {
            method: "POST",
            body: JSON.stringify({ symbol: symbol.toUpperCase() })
        });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Failed to add favorite stock");
            return;
        }

        // Refresh profile data
        await loadProfileData();
    } catch (e) {
        console.error("Error adding favorite:", e);
    }
}

async function removeFavoriteStock(symbol) {
    if (!symbol) return;
    try {
        const res = await authFetch(`/api/user/favorites/${encodeURIComponent(symbol)}`, {
            method: "DELETE"
        });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Failed to remove favorite stock");
            return;
        }

        // Refresh profile data
        await loadProfileData();
    } catch (e) {
        console.error("Error removing favorite:", e);
    }
}

// -------------------------------------------------------------
// News Feeds Renderers (3 Favorite News & 3 Top Market News)
// -------------------------------------------------------------

function renderNewsGrid(containerId, newsItems, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!newsItems || newsItems.length === 0) {
        container.innerHTML = `
            <div class="news-empty-box">
                <p>${emptyMessage}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = "";
    newsItems.slice(0, 3).forEach(item => {
        const card = document.createElement("a");
        card.href = item.link && item.link !== "#" ? item.link : "https://finance.yahoo.com";
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.className = "profile-news-card";

        const badgeClass = (item.sentiment || "Neutral").toLowerCase();
        const symHtml = item.symbol ? `<span class="news-sym-badge">${item.symbol}</span>` : "";

        card.innerHTML = `
            <div>
                <div class="profile-news-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${symHtml}
                        <span class="news-publisher">${item.publisher || "Financial Wire"}</span>
                    </div>
                    <span class="news-badge ${badgeClass}">${item.sentiment || "Neutral"}</span>
                </div>
                <h4 class="profile-news-title">${item.title}</h4>
                <p class="profile-news-summary">${item.summary || ""}</p>
            </div>
            <div class="profile-news-footer">
                <span class="news-date">🕒 ${item.published || "Recent"}</span>
                <span class="news-read-more">Read Article →</span>
            </div>
        `;
        container.appendChild(card);
    });
}

async function loadFavoriteStocksNews(favs) {
    const grid = document.getElementById("favoriteNewsGrid");
    if (!grid) return;

    if (!favs || favs.length === 0) {
        renderNewsGrid(
            "favoriteNewsGrid",
            [],
            "💡 You haven't added any favorite stocks yet. Add favorites above to unlock personalized AI news analysis!"
        );
        return;
    }

    try {
        const res = await authFetch("/api/user/favorite-news?limit=3");
        if (res.ok) {
            const data = await res.json();
            renderNewsGrid(
                "favoriteNewsGrid",
                data.news || [],
                "No recent headlines found for your favorite stocks."
            );
        } else {
            renderNewsGrid("favoriteNewsGrid", [], "Unable to fetch news for favorite stocks.");
        }
    } catch (e) {
        renderNewsGrid("favoriteNewsGrid", [], "Failed to load favorite stock news.");
    }
}

async function loadTopMarketNews() {
    const grid = document.getElementById("topNewsGrid");
    if (!grid) return;

    try {
        const res = await fetch(getBackendUrl("/api/news/top?limit=3"));
        if (res.ok) {
            const data = await res.json();
            renderNewsGrid(
                "topNewsGrid",
                data.news || [],
                "No market news currently available."
            );
        } else {
            renderNewsGrid("topNewsGrid", [], "Unable to fetch top market news.");
        }
    } catch (e) {
        renderNewsGrid("topNewsGrid", [], "Failed to load top market news.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    checkSystemStatus();
    loadProfileData();
});
