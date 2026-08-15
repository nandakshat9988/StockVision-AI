from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from sklearn.linear_model import LinearRegression

app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET", "POST", "OPTIONS"])
@app.route("/predict", methods=["GET", "POST", "OPTIONS"])
@app.route("/api/predict", methods=["GET", "POST", "OPTIONS"])
def handler():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    if request.method == "GET":
        return jsonify({
            "status": "healthy",
            "message": "Send a POST request with JSON {'symbol': 'AAPL'} to get predictions."
        }), 200

    try:
        data = request.get_json(force=True, silent=True) or {}
        symbol = data.get("symbol", "").strip().upper()

        if not symbol:
            return jsonify({"error": "Stock symbol is required."}), 400

        # Attempt to clean ticker (strip foreign exchange suffixes if they fail)
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

        if len(df) < 5:
            return jsonify({
                "error": f"Insufficient historical trading data ({len(df)} days) for ticker '{symbol}'."
            }), 400

        # Day number index for linear regression
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
            "symbol": symbol,
            "currentPrice": round(current_price, 2),
            "predictedPrice": round(prediction, 2),
            "history": history
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to calculate prediction: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
