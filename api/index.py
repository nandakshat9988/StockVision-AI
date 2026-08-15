from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from sklearn.linear_model import LinearRegression

app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
@app.route("/api", methods=["GET"])
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "StockVision AI Serverless API",
        "endpoints": {
            "predict": "POST /predict or /api/predict"
        }
    }), 200


@app.route("/predict", methods=["POST", "OPTIONS"])
@app.route("/api/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(force=True, silent=True) or {}
        symbol = data.get("symbol", "").strip()

        if not symbol:
            return jsonify({"error": "Stock symbol is required"}), 400

        # Download last 1 year data
        df = yf.download(symbol, period="1y", multi_level_index=False, progress=False)

        if df is None or df.empty or "Close" not in df.columns:
            return jsonify({"error": f"Invalid stock symbol or no data available for '{symbol}'"}), 400

        df = df[["Close"]].dropna()

        if len(df) < 5:
            return jsonify({"error": f"Insufficient historical data for '{symbol}'"}), 400

        # Day number index for regression
        df["Day"] = range(len(df))

        X = df[["Day"]]
        y = df["Close"]

        model = LinearRegression()
        model.fit(X, y)

        next_day = pd.DataFrame([[len(df)]], columns=["Day"])
        prediction = float(model.predict(next_day)[0])
        history = [round(float(p), 2) for p in df["Close"].tolist()]
        current_price = float(df["Close"].iloc[-1])

        return jsonify({
            "symbol": symbol.upper(),
            "currentPrice": round(current_price, 2),
            "predictedPrice": round(prediction, 2),
            "history": history
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to generate prediction: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
