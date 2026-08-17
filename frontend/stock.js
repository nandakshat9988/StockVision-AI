const apiKey = "d9h0m51r01qmrn76d0c0d9h0m51r01qmrn76d0cg";
const stock = (localStorage.getItem("stock") || "").trim().toUpperCase();

let chartInstance = null;

function getApiEndpoint() {
    const isLiveServer = window.location.port === "5500" || window.location.port === "5501" || window.location.port === "8080" || window.location.protocol === "file:";
    if (isLiveServer) {
        return "http://127.0.0.1:5000/api/predict";
    }
    return "/api/predict";
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

async function loadStockProfile() {
    if (!stock) return;

    const companyInfoEl = document.getElementById("companyInfo");
    if (!companyInfoEl) return;
    
    companyInfoEl.innerHTML = `<p style="color: #94a3b8;">Loading company details for <b>${stock}</b>...</p>`;

    try {
        const response = await fetch(
            `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(stock)}&token=${apiKey}`
        );
        const data = await response.json();

        if (data && data.name) {
            const logoHtml = data.logo
                ? `<img src="${data.logo}" alt="${data.name} logo" onerror="this.style.display='none'">`
                : "";

            companyInfoEl.innerHTML = `
                ${logoHtml}
                <div>
                    <h2>${data.name} (${data.ticker || stock})</h2>
                    <p><b>Exchange:</b> ${data.exchange || "N/A"} &nbsp;|&nbsp; <b>Country:</b> ${data.country || "N/A"}</p>
                    <p><b>Industry:</b> ${data.finnhubIndustry || "N/A"} &nbsp;|&nbsp; <b>IPO Date:</b> ${data.ipo || "N/A"}</p>
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
                <p style="color: #94a3b8;">Proceeding with Yahoo Finance AI forecast...</p>
            </div>
        `;
    }
}

async function predictStock(symbol) {
    if (!symbol) {
        showStatus("No stock symbol provided. Please go back and select a stock.", "error");
        return;
    }

    showStatus(`Fetching market data, training Random Forest model, and running NLP sentiment analysis for ${symbol}...`, "loading");

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

        let data = {};
        const responseText = await response.text();
        try {
            data = JSON.parse(responseText);
        } catch (jsonErr) {
            console.error("Non-JSON response:", responseText);
            throw new Error(`Server returned unexpected response (${response.status}). Please check ticker '${symbol}'.`);
        }

        if (!response.ok || data.error) {
            throw new Error(data.error || `Server returned error (${response.status})`);
        }

        showStatus(null);

        const currentPrice = Number(data.currentPrice);
        const preds = data.predictions || {};
        const p1d = preds["1d"] || { price: data.predictedPrice, growth: data.growth, recommendation: data.recommendation, color: "green" };
        const p7d = preds["7d"] || { price: currentPrice, growth: 0, recommendation: "🟡 HOLD", color: "orange" };
        const p30d = preds["30d"] || { price: currentPrice, growth: 0, recommendation: "🟡 HOLD", color: "orange" };

        // Populate 1-Day Horizon
        document.getElementById("pred1dPrice").innerHTML = `$${Number(p1d.price).toFixed(2)}`;
        document.getElementById("pred1dGrowth").innerHTML = `${p1d.growth >= 0 ? "+" : ""}${Number(p1d.growth).toFixed(2)}%`;
        document.getElementById("pred1dGrowth").className = `growth-val ${p1d.color || (p1d.growth >= 0 ? "green" : "red")}`;
        document.getElementById("pred1dRec").innerHTML = p1d.recommendation;

        // Populate 7-Day Horizon
        document.getElementById("pred7dPrice").innerHTML = `$${Number(p7d.price).toFixed(2)}`;
        document.getElementById("pred7dGrowth").innerHTML = `${p7d.growth >= 0 ? "+" : ""}${Number(p7d.growth).toFixed(2)}%`;
        document.getElementById("pred7dGrowth").className = `growth-val ${p7d.color || (p7d.growth >= 0 ? "green" : "red")}`;
        document.getElementById("pred7dRec").innerHTML = p7d.recommendation;

        // Populate 30-Day Horizon
        document.getElementById("pred30dPrice").innerHTML = `$${Number(p30d.price).toFixed(2)}`;
        document.getElementById("pred30dGrowth").innerHTML = `${p30d.growth >= 0 ? "+" : ""}${Number(p30d.growth).toFixed(2)}%`;
        document.getElementById("pred30dGrowth").className = `growth-val ${p30d.color || (p30d.growth >= 0 ? "green" : "red")}`;
        document.getElementById("pred30dRec").innerHTML = p30d.recommendation;

        // Technical Indicators
        const inds = data.indicators || {};
        if (inds.rsi) {
            document.getElementById("indRsi").innerText = Number(inds.rsi.value).toFixed(1);
            document.getElementById("indRsiStatus").innerText = inds.rsi.status;
            document.getElementById("indRsiStatus").className = `ind-status ${inds.rsi.value < 30 ? "green" : (inds.rsi.value > 70 ? "red" : "orange")}`;
        }
        if (inds.macd) {
            document.getElementById("indMacd").innerText = `${Number(inds.macd.value).toFixed(2)} / ${Number(inds.macd.signal).toFixed(2)}`;
            document.getElementById("indMacdStatus").innerText = inds.macd.status;
            document.getElementById("indMacdStatus").className = `ind-status ${inds.macd.status.includes("Bullish") ? "green" : "red"}`;
        }
        if (inds.sma20) {
            document.getElementById("indSma").innerText = `$${Number(inds.sma20).toFixed(2)} / $${Number(inds.sma50).toFixed(2)}`;
            document.getElementById("indTrend").innerText = `Trend: ${inds.trend}`;
            document.getElementById("indTrend").className = `ind-status ${inds.trend === "Bullish" ? "green" : "red"}`;
        }
        if (inds.ema20) {
            document.getElementById("indEma20").innerText = `$${Number(inds.ema20).toFixed(2)}`;
            document.getElementById("indEmaTrend").innerText = `Short-Term Momentum: ${currentPrice >= inds.ema20 ? "Above EMA20" : "Below EMA20"}`;
            document.getElementById("indEmaTrend").className = `ind-status ${currentPrice >= inds.ema20 ? "green" : "red"}`;
        }

        // News & Sentiment
        const sent = data.sentiment || {};
        const sentScoreEl = document.getElementById("sentimentScore");
        const sentScore = Number(sent.score || 0);
        sentScoreEl.innerText = `${sentScore >= 0 ? "+" : ""}${sentScore}`;
        sentScoreEl.className = `sentiment-score-val ${sentScore > 15 ? "green" : (sentScore < -15 ? "red" : "orange")}`;
        
        document.getElementById("sentimentSummary").innerText = sent.summary || "No recent news headlines available.";
        
        const badgeEl = document.getElementById("sentimentBadge");
        if (badgeEl) {
            badgeEl.innerText = `${sent.label || "Neutral"} Sentiment`;
        }

        const newsGrid = document.getElementById("newsGrid");
        newsGrid.innerHTML = "";
        const newsItems = sent.news || [];
        if (newsItems.length > 0) {
            newsItems.forEach(item => {
                const card = document.createElement("a");
                card.href = item.link && item.link !== "#" ? item.link : `https://finance.yahoo.com/quote/${symbol}`;
                card.target = "_blank";
                card.rel = "noopener noreferrer";
                card.className = "news-card";

                const badgeClass = (item.sentiment || "Neutral").toLowerCase();
                card.innerHTML = `
                    <div>
                        <div class="news-header">
                            <span class="news-publisher">${item.publisher || "News"}</span>
                            <span class="news-badge ${badgeClass}">${item.sentiment}</span>
                        </div>
                        <div class="news-title">${item.title}</div>
                    </div>
                    <div class="news-date">${item.published || "Recent"}</div>
                `;
                newsGrid.appendChild(card);
            });
        } else {
            newsGrid.innerHTML = `<p style="color: #94a3b8; padding: 10px;">No headline news available for ${symbol}.</p>`;
        }

        // Summary Matrix Table
        document.getElementById("summaryCurrent").innerHTML = `$${currentPrice.toFixed(2)}`;
        document.getElementById("summary1d").innerHTML = `$${Number(p1d.price).toFixed(2)} (${p1d.growth >= 0 ? "+" : ""}${Number(p1d.growth).toFixed(2)}%)`;
        document.getElementById("summary7d").innerHTML = `$${Number(p7d.price).toFixed(2)} (${p7d.growth >= 0 ? "+" : ""}${Number(p7d.growth).toFixed(2)}%)`;
        document.getElementById("summary30d").innerHTML = `$${Number(p30d.price).toFixed(2)} (${p30d.growth >= 0 ? "+" : ""}${Number(p30d.growth).toFixed(2)}%)`;
        document.getElementById("summaryRec").innerHTML = p1d.recommendation;

        // Render Chart
        const history = data.history || [];
        const forecast = data.forecast || [];
        renderChart(history, forecast);

    } catch (err) {
        console.error("Prediction error:", err);
        showStatus(`Prediction failed: ${err.message}`, "error");
    }
}

function renderChart(history, forecast = []) {
    const ctx = document.getElementById("stockChart");
    if (!ctx) return;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const totalDays = history.length;
    const historyLabels = history.map((_, i) => `Day ${i + 1}`);
    const forecastLabels = forecast.map((_, i) => `+${i + 1}d`);
    const allLabels = [...historyLabels, ...forecastLabels];

    // Historical dataset padded with nulls for forecast segment
    const historyData = [...history, ...Array(forecast.length).fill(null)];

    // Forecast dataset padded with nulls for history segment (bridging from last history point)
    const lastHistPrice = history.length > 0 ? history[history.length - 1] : null;
    const forecastData = Array(totalDays - 1).fill(null);
    if (lastHistPrice !== null) {
        forecastData.push(lastHistPrice);
    }
    forecastData.push(...forecast);

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: "Historical Close ($)",
                    data: historyData,
                    borderColor: "#38bdf8",
                    backgroundColor: "rgba(56, 189, 248, 0.08)",
                    fill: true,
                    borderWidth: 2.2,
                    tension: 0.25,
                    pointRadius: 0
                },
                {
                    label: "30-Day AI Forecast ($)",
                    data: forecastData,
                    borderColor: "#a855f7",
                    backgroundColor: "rgba(168, 85, 247, 0.08)",
                    borderDash: [6, 4],
                    fill: true,
                    borderWidth: 2.5,
                    tension: 0.25,
                    pointRadius: (ctx) => {
                        const index = ctx.dataIndex;
                        return index === totalDays - 1 || index === totalDays + 6 || index === allLabels.length - 1 ? 4 : 0;
                    },
                    pointBackgroundColor: "#c084fc"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        color: "#cbd5e1",
                        font: {
                            family: "'Inter', sans-serif",
                            size: 13,
                            weight: "600"
                        },
                        boxWidth: 16
                    }
                },
                tooltip: {
                    backgroundColor: "#0f172a",
                    titleColor: "#f8fafc",
                    bodyColor: "#38bdf8",
                    borderColor: "#334155",
                    borderWidth: 1,
                    padding: 10
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Trading Timeline (1 Year History + 30-Day Forward Forecast)",
                        color: "#64748b"
                    },
                    ticks: {
                        color: "#94a3b8",
                        maxTicksLimit: 14
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.04)"
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
                        color: "rgba(255, 255, 255, 0.04)"
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

    await loadStockProfile();
    await predictStock(stock);
}

init();