const Telegram = window.Telegram;

let tg = null;
try {
    tg = Telegram.WebApp;
    tg.ready();
} catch (e) {
    console.log('Running outside Telegram');
}

const formatNumber = (num) => {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '$' + (num / 1000).toFixed(1) + 'K';
    return '$' + (num || 0).toFixed(0);
};

const loadHallOfFame = async () => {
    const hallOfFameList = document.getElementById('hallOfFameList');

    try {
        const response = await fetch('/api/hall-of-fame');
        const data = await response.json();

        if (!data.hallOfFame || data.hallOfFame.length === 0) {
            hallOfFameList.innerHTML = '<div class="loading">No 5x+ gems yet. Keep scanning!</div>';
            return;
        }

        hallOfFameList.innerHTML = data.hallOfFame.map((token, index) => {
            const isTop = index === 0;
            const emoji = isTop ? '👑' : index === 1 ? '🏆' : index === 2 ? '💎' : `${index + 1}.`;
            const multiplierColor = token.multiplier >= 10 ? 'multiplier-legendary' : token.multiplier >= 5 ? 'multiplier-high' : 'multiplier-mid';
            
            return `
                <div class="leaderboard-item hall-of-fame-item ${isTop ? 'top-gold' : ''}">
                    <div class="lb-rank">${emoji}</div>
                    <div class="lb-info">
                        <div class="lb-address">${token.address.slice(0, 6)}...${token.address.slice(-4)}</div>
                        <div class="lb-multiplier">
                            <span class="${multiplierColor}">${token.multiplier.toFixed(2)}x</span>
                            🌟
                        </div>
                    </div>
                    <div class="lb-stats">
                        <div class="lb-stat">
                            <div class="lb-stat-label">Initial</div>
                            <div class="lb-stat-value">${formatNumber(token.initialMcap)}</div>
                        </div>
                        <div class="lb-stat">
                            <div class="lb-stat-label">ATH</div>
                            <div class="lb-stat-value">${formatNumber(token.athMcap)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        hallOfFameList.innerHTML = '<div class="loading">Unable to load hall of fame</div>';
    }
};

document.getElementById('refreshBtn').addEventListener('click', () => {
    loadHallOfFame();
    if (tg) tg.HapticFeedback.impactOccurred('light');
});

loadHallOfFame();

if (tg) {
    tg.expand();
}
