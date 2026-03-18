# Oracle Cloud Always Free Deployment Guide

## $0 Cost Architecture

| Component | Oracle Cloud Resource | Cost |
|-----------|----------------------|------|
| Compute | VM.Standard.A1.Flex (4 OCPUs, 24GB RAM) | Free |
| Block Storage | 200GB GB | Free |
| Networking | VCN + Public IP | Free |
| Object Storage | 10GB | Free |

---

## Step 1: Create Oracle Cloud Account

1. Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. Sign up with email (requires credit card for verification, no charges)
3. Choose "Always Free" tier

---

## Step 2: Create ARM Compute Instance

1. **Navigate**: Oracle Console → Compute → Instances
2. **Create Instance**:
   - Name: `onyx-bot`
   - Compartment: `root` (default)
   - Image: `Oracle Linux 8` or `Ubuntu 22.04`
   - Shape: `VM.Standard.A1.Flex`
   - OCPUs: `4`
   - Memory: `24GB`
   - Boot Volume: `200GB` (default)
3. **Add SSH Key**: Generate or paste your public key
4. **Note**: Public IP address after creation

---

## Step 3: Configure Security List (Firewall)

1. **Navigate**: Networking → Virtual Cloud Networks → your VCN
2. **Security Lists** → Default Security List
3. **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - Destination Port: `22` (SSH)
   - Destination Port: `80` (HTTP)
   - Destination Port: `443` (HTTPS)
   - Destination Port: `3000` (Node app)

---

## Step 4: Connect to Instance

```bash
ssh -i ~/.ssh/your_key opc@<YOUR_PUBLIC_IP>
```

---

## Step 5: Install Dependencies

```bash
# Update and install required packages
sudo dnf update -y
sudo dnf install -y docker git

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker opc
```

---

## Step 6: Deploy with Docker

```bash
# Clone your repository
cd /home/opc
git clone https://github.com/your-username/onyx.git
cd onyx

# Create environment file
cat > .env << EOF
TELEGRAM_BOT_TOKEN=your_token_here
GROQ_API_KEY=your_groq_key_here
PORT=3000
WEB_APP_URL=http://<YOUR_PUBLIC_IP>:3000/terminal
EOF

# Build and run
sudo docker build -t onyx-bot .
sudo docker run -d --name onyx-bot --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  onyx-bot
```

---

## Step 7: Verify Deployment

```bash
# Check container is running
sudo docker ps

# Check logs
sudo docker logs onyx-bot

# Test endpoints
curl http://localhost:3000/api/gems
```

---

## Step 8: Setup Domain (Optional)

1. **Buy Domain**: Namecheap, Cloudflare, or use free .tk
2. **Create A Record**: Point to your Oracle Public IP
3. **Install Nginx** (optional for SSL):
  ```bash
  sudo dnf install -y nginx
  sudo systemctl enable nginx
  ```

---

## Step 9: Setup Auto-Restart (Systemd)

```bash
sudo nano /etc/systemd/system/onyx.service
```

```
[Unit]
Description=Onyx DeFi Bot
After=network.target

[Service]
Type=simple
User=opc
WorkingDirectory=/home/opc/onyx
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable onyx
sudo systemctl start onyx
```

---

## Step 10: Monitoring

```bash
# Check status
sudo systemctl status onyx

# View logs
journalctl -u onyx -f
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot not responding | Check `sudo docker logs onyx-bot` |
| Port not accessible | Verify Security List ingress rules |
| Database locked | Check file permissions on database.sqlite |

---

## Cost Summary

- **Monthly Cost**: $0.00
- **Always Free Limits**: 4 OCPUs, 24GB RAM, 200GB storage
- **Warning**: Stay under limits to avoid charges

---

## Backup Strategy

```bash
# Backup database daily
sudo crontab -e
# Add: 0 2 * * * cp /home/opc/onyx/database.sqlite /backup/$(date +\%Y\%m\%d).db
```