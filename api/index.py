import os
import re
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor

# Determine static assets directory
base_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(base_dir, ".."))
public_dir = os.path.join(parent_dir, "public")
frontend_dir = os.path.join(parent_dir, "frontend")

static_dir = public_dir if os.path.isdir(public_dir) else frontend_dir

app = Flask(__name__, static_folder=static_dir)
CORS(app)


# -------------------------------------------------------------
# 1. Technical Indicators Engine (Pure Pandas / Numpy)
# -------------------------------------------------------------
def calculate_indicators(df_input):
    df = df_input.copy()
    
    # Simple & Exponential Moving Averages
    df["SMA_20"] = df["Close"].rolling(window=20, min_periods=1).mean()
    df["SMA_50"] = df["Close"].rolling(window=50, min_periods=1).mean()
    df["EMA_20"] = df["Close"].ewm(span=20, adjust=False).mean()

    # Relative Strength Index (RSI - 14 period)
    delta = df["Close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14, min_periods=1).mean()
    avg_loss = loss.rolling(window=14, min_periods=1).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    df["RSI"] = 100 - (100 / (1 + rs))

    # MACD (12-day EMA - 26-day EMA) & 9-day Signal line
    ema12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema26 = df["Close"].ewm(span=26, adjust=False).mean()
    df["MACD"] = ema12 - ema26
    df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
    df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]

    # Returns & Volatility
    df["Return"] = df["Close"].pct_change().fillna(0)
    df["Volatility"] = df["Return"].rolling(window=10, min_periods=1).std().fillna(0)

    return df


# -------------------------------------------------------------
# 2. Random Forest Regressor & Multi-Timeframe Forecast Engine
# -------------------------------------------------------------
def train_and_forecast(df_raw, forecast_days=30):
    df = calculate_indicators(df_raw)

    # Feature Engineering: Lag features
    df["Lag_1"] = df["Close"].shift(1)
    df["Lag_2"] = df["Close"].shift(2)
    df["Lag_3"] = df["Close"].shift(3)
    df["Lag_5"] = df["Close"].shift(5)

    feature_cols = [
        "Lag_1", "Lag_2", "Lag_3", "Lag_5",
        "SMA_20", "SMA_50", "EMA_20",
        "RSI", "MACD", "MACD_Signal", "Volatility"
    ]

    df_clean = df.dropna().copy()
    if len(df_clean) < 15:
        df_clean = df.bfill().ffill()

    X = df_clean[feature_cols]
    y = df_clean["Close"]

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=8,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X, y)

    current_prices = df["Close"].tolist()
    simulated_prices = list(current_prices)
    forecast_curve = []

    for step in range(forecast_days):
        temp_series = pd.Series(simulated_prices)
        
        lag_1 = simulated_prices[-1]
        lag_2 = simulated_prices[-2] if len(simulated_prices) >= 2 else lag_1
        lag_3 = simulated_prices[-3] if len(simulated_prices) >= 3 else lag_2
        lag_5 = simulated_prices[-5] if len(simulated_prices) >= 5 else lag_3

        sma_20 = temp_series.tail(20).mean()
        sma_50 = temp_series.tail(50).mean()
        ema_20 = temp_series.ewm(span=20, adjust=False).mean().iloc[-1]

        delta = temp_series.diff()
        gain = delta.clip(lower=0).tail(14).mean()
        loss = (-delta.clip(upper=0)).tail(14).mean()
        rs = gain / (loss + 1e-9)
        rsi = 100 - (100 / (1 + rs))

        ema12 = temp_series.ewm(span=12, adjust=False).mean().iloc[-1]
        ema26 = temp_series.ewm(span=26, adjust=False).mean().iloc[-1]
        macd = ema12 - ema26
        macd_signal = macd * 0.9

        returns = temp_series.pct_change().tail(10)
        volatility = returns.std() if len(returns) > 1 else 0.01

        input_row = pd.DataFrame([{
            "Lag_1": lag_1,
            "Lag_2": lag_2,
            "Lag_3": lag_3,
            "Lag_5": lag_5,
            "SMA_20": sma_20,
            "SMA_50": sma_50,
            "EMA_20": ema_20,
            "RSI": rsi,
            "MACD": macd,
            "MACD_Signal": macd_signal,
            "Volatility": volatility
        }])

        pred_price = float(model.predict(input_row)[0])
        forecast_curve.append(round(pred_price, 2))
        simulated_prices.append(pred_price)

    current_price = float(current_prices[-1])
    
    pred_1d = forecast_curve[0]
    pred_7d = forecast_curve[min(6, len(forecast_curve) - 1)]
    pred_30d = forecast_curve[-1]

    def make_rec(pred, curr):
        pct = ((pred - curr) / curr) * 100
        if pct > 1.5:
            return "🟢 BUY", "green", round(pct, 2)
        elif pct < -1.5:
            return "🔴 SELL", "red", round(pct, 2)
        else:
            return "🟡 HOLD", "orange", round(pct, 2)

    rec_1d, color_1d, growth_1d = make_rec(pred_1d, current_price)
    rec_7d, color_7d, growth_7d = make_rec(pred_7d, current_price)
    rec_30d, color_30d, growth_30d = make_rec(pred_30d, current_price)

    latest_row = df.iloc[-1]
    rsi_val = round(float(latest_row["RSI"]), 2)
    macd_val = round(float(latest_row["MACD"]), 2)
    macd_sig = round(float(latest_row["MACD_Signal"]), 2)
    sma20_val = round(float(latest_row["SMA_20"]), 2)
    sma50_val = round(float(latest_row["SMA_50"]), 2)
    ema20_val = round(float(latest_row["EMA_20"]), 2)

    rsi_status = "Oversold (<30)" if rsi_val < 30 else ("Overbought (>70)" if rsi_val > 70 else "Neutral (30-70)")
    macd_status = "Bullish Crossover" if macd_val > macd_sig else "Bearish Momentum"
    trend_status = "Bullish" if current_price > sma20_val else "Bearish"

    return {
        "predictions": {
            "1d": {"price": pred_1d, "growth": growth_1d, "recommendation": rec_1d, "color": color_1d},
            "7d": {"price": pred_7d, "growth": growth_7d, "recommendation": rec_7d, "color": color_7d},
            "30d": {"price": pred_30d, "growth": growth_30d, "recommendation": rec_30d, "color": color_30d}
        },
        "indicators": {
            "rsi": {"value": rsi_val, "status": rsi_status},
            "macd": {"value": macd_val, "signal": macd_sig, "status": macd_status},
            "sma20": sma20_val,
            "sma50": sma50_val,
            "ema20": ema20_val,
            "trend": trend_status
        },
        "forecast_curve": forecast_curve
    }


# -------------------------------------------------------------
# 3. News Sentiment Analysis Engine
# -------------------------------------------------------------
BULLISH_KEYWORDS = {
    "surge", "surges", "jump", "jumps", "gain", "gains", "rally", "rallies",
    "profit", "profits", "beat", "beats", "growth", "bullish", "upgrade", "upgrades",
    "record", "high", "highs", "dividend", "expand", "expansion", "success", "strong",
    "rise", "rises", "rising", "positive", "outperform", "buy", "boost", "boosts",
    "soar", "soars", "win", "wins", "revenue", "innovate", "innovation", "partnership"
}

BEARISH_KEYWORDS = {
    "drop", "drops", "fall", "falls", "plunge", "plunges", "loss", "losses",
    "miss", "misses", "bearish", "downgrade", "downgrades", "decline", "declines",
    "crash", "crashes", "risk", "risks", "warning", "weak", "slump", "slumps",
    "down", "lawsuit", "investigation", "sink", "sinks", "concern", "concerns",
    "debt", "layoff", "layoffs", "inflation", "cut", "cuts", "probe", "sell"
}


def analyze_news_sentiment(symbol):
    news_items = []
    bullish_count = 0
    bearish_count = 0
    neutral_count = 0

    try:
        ticker = yf.Ticker(symbol)
        raw_news = ticker.news or []

        for item in raw_news[:6]:
            if not isinstance(item, dict):
                continue
            
            content = item.get("content", {})
            if not isinstance(content, dict):
                content = item

            title = content.get("title") or item.get("title") or ""
            summary = content.get("summary") or item.get("summary") or ""
            
            provider = content.get("provider", {}) if isinstance(content.get("provider"), dict) else {}
            publisher = provider.get("displayName") or item.get("publisher") or "Market News"
            
            click_url = content.get("clickThroughUrl", {}) if isinstance(content.get("clickThroughUrl"), dict) else {}
            canon_url = content.get("canonicalUrl", {}) if isinstance(content.get("canonicalUrl"), dict) else {}
            link = click_url.get("url") or canon_url.get("url") or item.get("link") or "#"

            if not title:
                continue

            text_to_score = (str(title) + " " + str(summary)).lower()
            words = set(re.findall(r"\w+", text_to_score))
            bull_hits = len(words.intersection(BULLISH_KEYWORDS))
            bear_hits = len(words.intersection(BEARISH_KEYWORDS))

            if bull_hits > bear_hits:
                sentiment = "Bullish"
                bullish_count += 1
            elif bear_hits > bull_hits:
                sentiment = "Bearish"
                bearish_count += 1
            else:
                sentiment = "Neutral"
                neutral_count += 1

            publish_time = content.get("pubDate") or item.get("providerPublishTime")
            published_str = "Recent"
            if isinstance(publish_time, (int, float)):
                try:
                    dt = datetime.datetime.fromtimestamp(publish_time, datetime.timezone.utc)
                    published_str = dt.strftime("%b %d, %Y")
                except Exception:
                    pass
            elif isinstance(publish_time, str) and len(publish_time) >= 10:
                published_str = publish_time[:10]

            news_items.append({
                "title": title,
                "publisher": publisher,
                "link": link,
                "sentiment": sentiment,
                "published": published_str
            })

    except Exception as e:
        print(f"News fetch error for {symbol}: {e}")

    total = bullish_count + bearish_count + neutral_count
    score = int(((bullish_count - bearish_count) / total) * 100) if total > 0 else 0

    if score > 15:
        overall_label = "Bullish"
        sentiment_summary = f"Positive news momentum ({bullish_count} bullish vs {bearish_count} bearish articles)."
    elif score < -15:
        overall_label = "Bearish"
        sentiment_summary = f"Negative headline pressure ({bearish_count} bearish vs {bullish_count} bullish articles)."
    else:
        overall_label = "Neutral"
        sentiment_summary = "Balanced market sentiment across recent publications."

    return {
        "score": score,
        "label": overall_label,
        "summary": sentiment_summary,
        "news": news_items
    }


# -------------------------------------------------------------
# 4. API Endpoints
# -------------------------------------------------------------
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "StockVision AI Serverless API",
        "model": "Random Forest Regressor (Multi-Timeframe 1D, 7D, 30D)",
        "features": ["Technical Indicators", "News Sentiment Engine", "Chart.js Forecast Curve"]
    }), 200


@app.route("/predict", methods=["POST", "OPTIONS"])
@app.route("/api/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(force=True, silent=True) or {}
        symbol = data.get("symbol", "").strip().upper()

        if not symbol:
            return jsonify({"error": "Stock symbol is required."}), 400

        df = None
        symbols_to_try = [symbol]
        if "." in symbol:
            symbols_to_try.append(symbol.split(".")[0])

        for sym in symbols_to_try:
            try:
                df_temp = yf.download(sym, period="1y", multi_level_index=False, progress=False)
                if df_temp is not None and not df_temp.empty and "Close" in df_temp.columns:
                    df = df_temp
                    symbol = sym
                    break
            except Exception:
                continue

        if df is None or df.empty or "Close" not in df.columns:
            return jsonify({
                "error": f"No market price data found on Yahoo Finance for ticker '{symbol}'. Please try major tickers like AAPL, MSFT, TSLA, NVDA, GOOGL."
            }), 404

        df = df[["Close"]].dropna()

        if len(df) < 15:
            return jsonify({
                "error": f"Insufficient historical trading data ({len(df)} days) for ticker '{symbol}'."
            }), 400

        current_price = round(float(df["Close"].iloc[-1]), 2)
        history = [round(float(p), 2) for p in df["Close"].tolist()]

        ml_results = train_and_forecast(df, forecast_days=30)
        sentiment_results = analyze_news_sentiment(symbol)

        return jsonify({
            "symbol": symbol,
            "currentPrice": current_price,
            "predictedPrice": ml_results["predictions"]["1d"]["price"],
            "growth": ml_results["predictions"]["1d"]["growth"],
            "recommendation": ml_results["predictions"]["1d"]["recommendation"],
            "predictions": ml_results["predictions"],
            "indicators": ml_results["indicators"],
            "sentiment": sentiment_results,
            "history": history,
            "forecast": ml_results["forecast_curve"]
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to calculate prediction: {str(e)}"}), 500


@app.route("/", methods=["GET"])
def root_index():
    if os.path.isdir(static_dir) and os.path.exists(os.path.join(static_dir, "index.html")):
        return send_from_directory(static_dir, "index.html")
    return jsonify({"message": "StockVision AI API is live. Use /predict to get stock forecasts."}), 200


@app.route("/<path:path>", methods=["GET"])
def serve_static(path):
    if os.path.isdir(static_dir) and os.path.exists(os.path.join(static_dir, path)):
        return send_from_directory(static_dir, path)
    return jsonify({"error": f"Path '{path}' not found."}), 404
