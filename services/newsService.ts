import { NewsItem } from "../types";

const SOURCES = ["Bloomberg", "Reuters", "CoinDesk", "Financial Times", "CNBC"];
const POSITIVE_KEYWORDS = ["soars", "jumps", "bull run", "adoption", "approves", "record high", "optimism", "growth", "sec approves", "inflation cools"];
const NEGATIVE_KEYWORDS = ["crashes", "plummets", "ban", "lawsuit", "regulation", "inflation rises", "recession", "dump", "bears", "hack"];

const TEMPLATES = [
    "Bitcoin {action} as market awaits Fed decision",
    "SEC {positive_verb} new crypto regulations",
    "Major bank {positive_verb} blockchain adoption",
    "Tech stocks {action} amid inflation fears",
    "Whale wallet moves $500M to exchange, signaling {sentiment}",
    "Global markets rally as uncertainty {fades}",
    "New CPI data shows inflation is {status}"
];

export const generateMarketNews = (): NewsItem[] => {
    const news: NewsItem[] = [];
    const count = 3 + Math.floor(Math.random() * 3); // 3 to 5 items

    for (let i = 0; i < count; i++) {
        const isPositive = Math.random() > 0.5;
        const sentiment = isPositive ? 'POSITIVE' : Math.random() > 0.5 ? 'NEGATIVE' : 'NEUTRAL';
        
        let headline = "";
        
        if (sentiment === 'POSITIVE') {
            headline = `Market ${POSITIVE_KEYWORDS[Math.floor(Math.random() * POSITIVE_KEYWORDS.length)]} following unexpected economic data`;
        } else if (sentiment === 'NEGATIVE') {
            headline = `Crypto ${NEGATIVE_KEYWORDS[Math.floor(Math.random() * NEGATIVE_KEYWORDS.length)]} after regulatory announcement`;
        } else {
            headline = "Market consolidates as traders await next major catalyst";
        }

        news.push({
            id: Math.random().toString(36).substr(2, 9),
            headline: headline,
            source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            sentiment
        });
    }
    return news;
};

export const calculateAggregateSentiment = (news: NewsItem[]): number => {
    if (news.length === 0) return 0;
    
    let score = 0;
    news.forEach(item => {
        if (item.sentiment === 'POSITIVE') score += 1;
        if (item.sentiment === 'NEGATIVE') score -= 1;
    });

    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, score / 3)); 
};