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

if (tg) {
    tg.expand();
}