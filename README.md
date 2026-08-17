# 📈 StockVision AI

StockVision AI is a full-stack financial analytics and forecasting web application that predicts stock price movements using Machine Learning (Random Forest Regressor), quantitative technical indicators, and real-time news sentiment analysis.

Users can search for any stock ticker, view company fundamentals, analyze historical prices alongside forward-looking AI forecast curves, evaluate technical indicators (RSI, MACD, Moving Averages), and assess real-time market news sentiment.

- **Frontend**: HTML5, CSS3, Modern JavaScript, Chart.js, Finnhub API (Company Profile & Autocomplete)
- **Backend / ML**: Python, Flask, Scikit-learn (Random Forest Regressor), Pandas, NumPy, Yahoo Finance (`yfinance`)
- **Technical Analysis**: RSI (14), MACD (12, 26, 9), SMA (20, 50), EMA (20), Return Volatility
- **NLP Sentiment Engine**: Lexicon-based financial sentiment scoring for recent market headlines
- **Deployment**: Vercel (Serverless Python API + Static Hosting) & Docker support
- **Study Notes**: Comprehensive study & viva preparation notes in [`studynote.md`](file:///c:/Users/nanda/OneDrive/Documents/StockVision%20AI/studynote.md)

---

## ✨ Features

1. **Multi-Timeframe AI Forecasting**:
   - 1-Day Horizon (Tomorrow's Close Target & % Growth)
   - 7-Day Horizon (1-Week Target & % Growth)
   - 30-Day Horizon (1-Month Target & % Growth)
   - Automated **BUY**, **HOLD**, and **SELL** recommendation signals.

2. **Quantitative Technical Indicators**:
   - **RSI (14)** with Oversold (<30) and Overbought (>70) detection.
   - **MACD Line & Signal Line** with Bullish/Bearish crossover signals.
   - **20-Day & 50-Day Simple Moving Averages (SMA)** and **20-Day EMA**.

3. **News Sentiment Engine**:
   - Live headline news feed for any searched equity ticker.
   - NLP sentiment classification (🟢 Bullish / 🟡 Neutral / 🔴 Bearish) with an overall Sentiment Score Index.

4. **Continuous Chart.js Visualization**:
   - Interactive line chart plotting 1 year of daily closing price history seamlessly connected to a forward-projected 30-day forecast trajectory.

---

## 🚀 Deploying to Vercel

StockVision AI is pre-configured for **1-click deployment on Vercel** using Python Serverless Functions and static asset rewrites defined in `vercel.json`.

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Upgrade StockVision AI with Technical Indicators, Random Forest ML, and Sentiment Analysis"
   git push origin main
   ```

2. **Open Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
   - Click **"Add New..."** > **"Project"**.
   - Select your **`StockVision-AI`** repository and click **Import**.

3. **Configure Project Settings**:
   - **Framework Preset**: Leave as *Other* (detected automatically).
   - **Root Directory**: `./` (leave default).
   - **Build and Output Settings**: Defaults are pre-configured via `vercel.json`.

4. **Click Deploy**:
   - Vercel installs dependencies from `requirements.txt`, bundles serverless functions under `/api`, and hosts static frontend assets at `https://your-project.vercel.app`.

---

## 💻 Running Locally

### Option A: Python Virtual Environment

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Start the Flask server:
   ```bash
   python app.py
   ```
   The backend will start at `http://127.0.0.1:5000`.

3. Open `frontend/index.html` in your browser (or use Live Server / any HTTP server).

---

### Option B: Using Docker

1. Make sure Docker Desktop is running.
2. Start the backend container:
   ```bash
   docker compose up --build
   ```
3. Open `frontend/index.html` in your browser.

---

## 📁 Project Structure

```
StockVision AI/
├── api/
│   ├── index.py              # Vercel serverless function entrypoint (ML + Sentiment + Indicators)
│   └── requirements.txt      # API dependencies for Vercel
├── frontend/
│   ├── index.html            # Search & landing page
│   ├── script.js             # Stock search & autocomplete logic
│   ├── style.css             # Landing page styles
│   ├── stock.html            # Dashboard (Multi-horizon forecasts, Indicators, News feed, Chart)
│   ├── stock.js              # Prediction fetch & Chart.js rendering
│   └── stock.css             # Modern dark-mode dashboard styling
├── public/                   # Static build / mirror for Vercel static serving
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── stock.html
│   ├── stock.js
│   └── stock.css
├── backend/
│   ├── app.py                # Standalone Flask app for local/Docker dev
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Container configuration
├── studynote.md              # Complete study guide & interview/viva Q&A
├── vercel.json               # Vercel serverless routing & asset rewrites
├── requirements.txt          # Root Python dependencies for Vercel
└── README.md                 # Project documentation
```
