# 📈 StockVision AI

StockVision AI is a full-stack web application that predicts the next day's stock closing price using Machine Learning.

Users can search for any stock, view real-time company details, analyze historical price charts, and receive an AI-generated predicted closing price along with Buy, Hold, or Sell recommendations.

- **Frontend**: HTML5, CSS3, Modern JavaScript, Chart.js, Finnhub API (Company Profile & Autocomplete)
- **Backend / ML**: Python, Flask, Scikit-learn (Linear Regression), Pandas, Yahoo Finance (`yfinance`)
- **Deployment**: Vercel (Serverless Python API + Static Hosting) & Docker support

---

## 🚀 Deploying to Vercel

StockVision AI is pre-configured for **1-click deployment on Vercel** using Python Serverless Functions and static asset rewrites defined in `vercel.json`.

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure project for Vercel deployment"
   git push origin main
   ```

2. **Open Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
   - Click **"Add New..."** > **"Project"**.
   - Select your **`StockVision-AI`** (or `Stock-Help`) repository and click **Import**.

3. **Configure Project Settings**:
   - **Framework Preset**: Leave as *Other* (detected automatically).
   - **Root Directory**: `./` (leave default).
   - **Build and Output Settings**: Defaults are pre-configured via `vercel.json`.
   - **Environment Variables**: *(Optional - Finnhub key is already embedded or can be configured)*.

4. **Click Deploy**:
   - Vercel will install dependencies from `requirements.txt`, bundle your serverless functions under `/api`, and host your static frontend at `https://your-project.vercel.app`.

---

### Method 2: Deploy via Vercel CLI

You can also deploy directly from your terminal using the Vercel CLI:

```bash
# Run Vercel deployment
npx vercel
```

- Follow the prompts to log in and select your scope.
- When prompted for settings, accept default values (`vercel.json` handles routing).
- To deploy to production:
  ```bash
  npx vercel --prod
  ```

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
│   ├── index.py              # Vercel serverless function entrypoint
│   └── requirements.txt      # API dependencies for Vercel
├── frontend/
│   ├── index.html            # Search & landing page
│   ├── script.js             # Stock search & autocomplete logic
│   ├── style.css             # Landing page styles
│   ├── stock.html            # Dashboard & chart view
│   ├── stock.js              # Prediction fetch & Chart.js rendering
│   └── stock.css             # Dashboard styles
├── backend/
│   ├── app.py                # Standalone Flask app for local/Docker dev
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Container configuration
├── vercel.json               # Vercel serverless routing & asset rewrites
├── requirements.txt          # Root Python dependencies for Vercel
└── README.md                 # Project documentation
```
