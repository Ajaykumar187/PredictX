from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def score_text(text: str) -> dict:
    if not text:
        return {"compound": 0.0, "label": "Neutral"}
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]
    if compound >= 0.05:
        label = "Positive"
    elif compound <= -0.05:
        label = "Negative"
    else:
        label = "Neutral"
    return {"compound": compound, "label": label}


def score_news_items(news_items):
    results = []
    for item in news_items:
        title = item.get("title", "") or item.get("content", {}).get("title", "")
        summary = item.get("summary", "") or ""
        text = f"{title}. {summary}"
        s = score_text(text)
        results.append({**item, "sentiment": s["label"], "compound": s["compound"], "title": title})
    return results


def aggregate_sentiment(scored_items):
    if not scored_items:
        return {"avg_compound": 0.0, "positive": 0, "negative": 0, "neutral": 0}
    avg = sum(i["compound"] for i in scored_items) / len(scored_items)
    pos = sum(1 for i in scored_items if i["sentiment"] == "Positive")
    neg = sum(1 for i in scored_items if i["sentiment"] == "Negative")
    neu = len(scored_items) - pos - neg
    return {"avg_compound": round(avg, 3), "positive": pos, "negative": neg, "neutral": neu}


def fear_greed_index(rsi_value, volatility_pct, momentum_pct, news_compound_avg):
    rsi_component = rsi_value # already 0-100
    vol_component = max(0, 100 - min(volatility_pct, 100))
    momentum_component = max(0, min(100, 50 + momentum_pct * 5))
    news_component = max(0, min(100, 50 + news_compound_avg * 50))

    composite = (rsi_component * 0.35 + vol_component * 0.25 +
                 momentum_component * 0.25 + news_component * 0.15)
    composite = round(max(0, min(100, composite)), 1)

    if composite < 25:
        label = "Extreme Fear"
    elif composite < 45:
        label = "Fear"
    elif composite < 55:
        label = "Neutral"
    elif composite < 75:
        label = "Greed"
    else:
        label = "Extreme Greed"
    return composite, label
