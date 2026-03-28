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

const loadLeaderboard = async () => {
    const leaderboardList = document.getElementById('leaderboardList');

    try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();

        if (!data.leaderboard || data.leaderboard.length === 0) {
            leaderboardList.innerHTML = '<div class="loading">No tokens called yet</div>';
            return;
        }

        leaderboardList.innerHTML = data.leaderboard.slice(0, 10).map((token, index) => {
            const isTop = index === 0;
            const emoji = isTop ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const multiplierColor = token.multiplier >= 2 ? 'multiplier-high' : token.multiplier >= 1 ? 'multiplier-mid' : 'multiplier-low';
            
            return `
                <div class="leaderboard-item ${isTop ? 'top-gold' : ''}">
                    <div class="lb-rank">${emoji}</div>
                    <div class="lb-info">
                        <div class="lb-address">${token.address.slice(0, 6)}...${token.address.slice(-4)}</div>
                        <div class="lb-multiplier">
                            <span class="${multiplierColor}">${token.multiplier.toFixed(2)}x</span>
                            🚀
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
        leaderboardList.innerHTML = '<div class="loading">Unable to load leaderboard</div>';
    }
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

        hallOfFameList.innerHTML = data.hallOfFame.slice(0, 10).map((token, index) => {
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

const updateStatus = async () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const subType = document.getElementById('subType');
    const expiryDate = document.getElementById('expiryDate');
    const gemsCount = document.getElementById('gemsCount');

    try {
        const userId = tg ? tg.initDataUnsafe?.user?.id : 12345678;
        const response = await fetch(`/api/status/${userId}`);
        const data = await response.json();

        if (data.hasAccess) {
            statusDot.classList.add('active');
            statusText.textContent = 'Active ✅';
            subType.textContent = data.status.toUpperCase();
            expiryDate.textContent = data.expiry ? new Date(data.expiry).toLocaleDateString() : 'N/A';
        } else {
            statusDot.classList.remove('active');
            statusText.textContent = 'Inactive ❌';
            subType.textContent = data.reason;
            expiryDate.textContent = '-';
        }

        gemsCount.textContent = data.gemsFound || 0;
    } catch (err) {
        statusText.textContent = 'Offline';
        subType.textContent = 'Demo Mode';
        expiryDate.textContent = '-';
        gemsCount.textContent = '0';
    }
};

const loadGems = async () => {
    const gemsList = document.getElementById('gemsList');

    try {
        const response = await fetch('/api/gems');
        const gems = await response.json();

        if (gems.length === 0) {
            gemsList.innerHTML = '<div class="loading">No gems found yet. Scanning...</div>';
            return;
        }

        gemsList.innerHTML = gems.slice(0, 5).map(gem => `
            <div class="gem-card">
                <div class="gem-header">
                    <span class="gem-token">$${gem.symbol || 'TOKEN'}</span>
                    <span class="gem-network">${gem.chain || 'Unknown'}</span>
                    <span class="score-badge">${gem.signalScore?.toFixed(1) || '0'}</span>
                </div>
                <div class="gem-stats">
                    <div class="gem-stat">
                        <div class="gem-stat-label">MC</div>
                        <div class="gem-stat-value">${formatNumber(gem.marketCap)}</div>
                    </div>
                    <div class="gem-stat">
                        <div class="gem-stat-label">Liquidity</div>
                        <div class="gem-stat-value">${formatNumber(gem.liquidity)}</div>
                    </div>
                    <div class="gem-stat">
                        <div class="gem-stat-label">Volume 1h</div>
                        <div class="gem-stat-value">${formatNumber(gem.volume)}</div>
                    </div>
                </div>
                <div class="gem-ca">${gem.address || 'N/A'}</div>
            </div>
        `).join('');
    } catch (err) {
        gemsList.innerHTML = '<div class="loading">Unable to load gems</div>';
    }
};

document.getElementById('refreshBtn').addEventListener('click', () => {
    updateStatus();
    loadGems();
    loadLeaderboard();
    loadHallOfFame();
    if (tg) tg.HapticFeedback.impactOccurred('light');
});

document.getElementById('upgradeBtn').addEventListener('click', () => {
    if (tg) {
        tg.openLink('https://example.com/pay');
    } else {
        alert('Visit https://example.com/pay to upgrade');
    }
    if (tg) tg.HapticFeedback.impactOccurred('medium');
});

updateStatus();
loadGems();
loadLeaderboard();
loadHallOfFame();

if (tg) {
    tg.expand();
}