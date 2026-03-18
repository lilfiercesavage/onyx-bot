#!/bin/bash
# Start script for Onyx DeFi Bot

set -e

echo "Starting Onyx DeFi Intelligence Layer..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Copy .env.example to .env and configure it."
    exit 1
fi

# Check required variables
source .env

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "Error: TELEGRAM_BOT_TOKEN not set in .env"
    exit 1
fi

# Start the bot
echo "Launching bot..."
node index.js