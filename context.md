# PROJECT: DeFi Intelligence Layer (B2B SaaS)

## Mission
Build a $0-overhead intelligence bot that identifies, filters, and summarizes high-potential DeFi "Gems" for KOLs, providing automated due diligence and performance tracking. 

## Tech Stack
- Infrastructure: Oracle Cloud "Always Free" (ARM Ampere).
- Database: SQLite (Persistent tracking of "Called" tokens & User Subscriptions).
- APIs: DexScreener (Data), GoPlus Security (Safety), Groq (Llama 3.1 8B AI).
- Delivery: Telegram Bot API + Telegram Mini App (TMA).

## Core Logic & Filtering
1. **The Safety Multiplier ($M_{safe}$):** Binary check via GoPlus. 1 = Clean contract, 0 = Malicious/Honeypot.
2. **"Secret Gem" Triggers:**
   - Market Cap < $250k with high Liquidity/MC ratio (>20%).
   - "Fresh Boost" on DexScreener < 60 mins.
3. **Signal Score Formula:** $Signal\_Score = ((Liquidity \times 0.5) + (Volume_{1hr} \times 0.3) + (Social\_Growth \times 0.2)) \times M_{safe}$

## Monetization & Access Control
- Free access for all users (no trial period), $150/mo B2B subscription available.
- Middleware must automatically block API access if `current_date > expiry_date` in the SQLite user table.