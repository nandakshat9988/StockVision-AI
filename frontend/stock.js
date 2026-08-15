const apiKey = "d9h0m51r01qmrn76d0c0d9h0m51r01qmrn76d0cg";
const stock = (localStorage.getItem("stock") || "").trim().toUpperCase();

let chartInstance = null;

function getApiEndpoint() {
    // Check if hosted or served locally
    const isLiveServer = window.location.port === "5500" || window.location.port === "5501" || window.location.port === "8080" || window.location.protocol === "file:";
    if (isLiveServer) {
        return "http://127.0.0.1:5000/predict";
    }
    // In production (Vercel) or when served through Flask/proxy, use relative path
    return "/predict";
}

function showStatus(message, type = "loading") {
    const banner = document.getElementById("statusBanner");
    if (!banner) return;

    if (!message) {
        banner.style.display = "none";
        banner.className = "status-banner";
        banner.innerHTML = "";
        return;
    }

    banner.className = `status-banner ${type}`;
    if (type === "error") {
        banner.innerHTML = `
            <span>⚠️ ${message}</span>
            <button onclick="window.location.href='index.html'">Search Another Stock</button>
        `;
    } else {
        banner.innerHTML = `<span>⏳ ${message}</span>`;
    }
    banner.style.display = "flex";
}

async function loadStock() {
    if (!stock) return;

    const companyInfoEl = document.getElementById("companyInfo");
    companyInfoEl.innerHTML = `<p style="color: #94a3b8;">Loading company details for <b>${stock}</b>...</p>`;

    try {
        const response = await fetch(
            `https://finnhub.io/api/v1/stock/profile2?symbol=${stock}&token=${apiKey}`
        );
        const data = await response.json();

        if (data && data.name) {
            const logoHtml = data.logo
                ? `<img src="${data.logo}" width="80" alt="${data.name} logo" onerror="this.style.display='none'">`
                : "";

            companyInfoEl.innerHTML = `
                ${logoHtml}
                <div>
                    <h2>${data.name} (${data.ticker || stock})</h2>
                    <p><b>Country:</b> ${data.country || "N/A"}</p>
                    <p><b>Exchange:</b> ${data.exchange || "N/A"}</p>
                    <p><b>Industry:</b> ${data.finnhubIndustry || "N/A"}</p>
                    <p><b>IPO Date:</b> ${data.ipo || "N/A"}</p>
                </div>
            `;
        } else {
            companyInfoEl.innerHTML = `
                <div>
                    <h2>${stock}</h2>
                    <p style="color: #94a3b8;">Company profile details not available on Finnhub for ticker <b>${stock}</b>.</p>
                </div>
            `;
        }
    } catch (err) {
        console.warn("Finnhub profile fetch error:", err);
        companyInfoEl.innerHTML = `
            <div>
                <h2>${stock}</h2>
                <p style="color: #94a3b8;">Proceeding with Yahoo Finance ML price prediction...</p>
            </div>
        `;
    }
}

async function predictStock(symbol) {
    if (!symbol) {
        showStatus("No stock symbol provided. Please go back and select a stock.", "error");
        return;
    }

    showStatus(`Fetching market data and calculating ML prediction for ${symbol}...`, "loading");

    document.getElementById("currentPrice").innerText = "...";
    document.getElementById("predictedPrice").innerText = "...";
    document.getElementById("growth").innerText = "...";
    document.getElementById("recommendation").innerText = "...";

    try {
        const endpoint = getApiEndpoint();
        console.log(`Sending prediction request to: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ symbol: symbol })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || `Server responded with status ${response.status}`);
        }

        // Hide status banner on success
        showStatus(null);

        const currentPrice = Number(data.currentPrice);
        const predictedPrice = Number(data.predictedPrice);

        document.getElementById("currentPrice").innerHTML = "$" + currentPrice.toFixed(2);
        document.getElementById("predictedPrice").innerHTML = "$" + predictedPrice.toFixed(2);

        const growth = ((predictedPrice - currentPrice) / currentPrice) * 100;
        const growthEl = document.getElementById("growth");
        growthEl.innerHTML = (growth >= 0 ? "+" : "") + growth.toFixed(2) + "%";
        growthEl.className = growth >= 0 ? "green" : "red";

        let recommendation = "";
        let recClass = "";

        if (growth > 1) {
            recommendation = "🟢 BUY";
            recClass = "green";
        } else if (growth < -1) {
            recommendation = "🔴 SELL";
            recClass = "red";
        } else {
            recommendation = "🟡 HOLD";
            recClass = "orange";
        }

        const recEl = document.getElementById("recommendation");
        recEl.innerHTML = recommendation;
        recEl.className = recClass;

        document.getElementById("summaryCurrent").innerHTML = "$" + currentPrice.toFixed(2);
        document.getElementById("summaryPrediction").innerHTML = "$" + predictedPrice.toFixed(2);
        document.getElementById("summaryGrowth").innerHTML = (growth >= 0 ? "+" : "") + growth.toFixed(2) + "%";
        document.getElementById("summaryRecommendation").innerHTML = recommendation;

        // Render Historical Price Chart
        const history = data.history || [];
        if (history.length > 0) {
            renderChart(history);
        }

    } catch (err) {
        console.error("Prediction error:", err);
        showStatus(`Prediction failed: ${err.message}`, "error");

        document.getElementById("currentPrice").innerText = "--";
        document.getElementById("predictedPrice").innerText = "--";
        document.getElementById("growth").innerText = "--";
        document.getElementById("recommendation").innerText = "Unavailable";
    }
}

function renderChart(history) {
    const labels = history.map((_, index) => index + 1);
    const ctx = document.getElementById("stockChart");

    if (!ctx) return;

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Closing Price ($)",
                data: history,
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56,189,248,0.15)",
                fill: true,
                borderWidth: 2.5,
                tension: 0.3,
                pointRadius: history.length > 100 ? 0 : 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#94a3b8"
                    }
                },
                tooltip: {
                    mode: "index",
                    intersect: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Days (Past 1 Year)",
                        color: "#64748b"
                    },
                    ticks: {
                        color: "#94a3b8",
                        maxTicksLimit: 12
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)"
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Price (USD)",
                        color: "#64748b"
                    },
                    ticks: {
                        color: "#94a3b8"
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)"
                    }
                }
            }
        }
    });
}

async function init() {
    if (!stock) {
        alert("No stock selected. Please choose a stock on the home page.");
        window.location.href = "index.html";
        return;
    }

    await loadStock();
    await predictStock(stock);
}

init();