function selectStock() {
    const inputEl = document.getElementById("stockInput");
    const stock = (inputEl.value || "").trim().toUpperCase();

    if (!stock) {
        alert("Please enter or select a stock symbol (e.g., AAPL, TSLA, MSFT).");
        return;
    }

    localStorage.setItem("stock", stock);
    window.location.href = "stock.html";
}

const input = document.getElementById("stockInput");
const suggestions = document.getElementById("suggestions");

// Allow pressing Enter key to submit
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        selectStock();
    }
});

let debounceTimer = null;

input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    if (query.length < 2) {
        suggestions.innerHTML = "";
        return;
    }

    debounceTimer = setTimeout(async () => {
        const apiKey = "d9h0m51r01qmrn76d0c0d9h0m51r01qmrn76d0cg";
        try {
            const response = await fetch(
                `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`
            );
            const data = await response.json();
            suggestions.innerHTML = "";

            if (data && Array.isArray(data.result)) {
                data.result.slice(0, 6).forEach((stock) => {
                    const item = document.createElement("div");
                    item.innerHTML = `<span><b>${stock.symbol}</b></span> - <small>${stock.description}</small>`;
                    item.classList.add("stock-item");
                    item.onclick = () => {
                        input.value = stock.symbol;
                        suggestions.innerHTML = "";
                        selectStock();
                    };
                    suggestions.appendChild(item);
                });
            }
        } catch (error) {
            console.warn("Autocomplete error:", error);
        }
    }, 250);
});

// Close suggestions on outside click
document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
        suggestions.innerHTML = "";
    }
});
