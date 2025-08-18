# 🤖 Crossmint E-Commerce Telegram Bot

AI-powered Telegram shopping assistant with Crossmint wallet integration for seamless e-commerce experiences.

## 🚀 Features

- **AI Chat**: GPT-4o powered conversations
- **Product Search**: Amazon product search with instant results
- **Crossmint Wallets**: Client-side wallet creation with passkey signers
- **Delegation**: Enable fast shopping with automatic transaction signing
- **Secure Payments**: USDC payments on Base Sepolia testnet
- **Web Interface**: Next.js app for wallet management and delegation

## ⚡ Quick Start

### 🚀 Super Quick Start (Recommended)
```bash
# 1. Clone and install
git clone <your-repo-url>
cd telegram-agent
npm install && cd web-interface && npm install && cd ..

# 2. Setup environment files
npm run setup

# 3. Get your API keys (see detailed instructions below)
# 4. Update .env and web-interface/.env.local with your keys

# 5. One command to start everything!
npm run dev:full
```

This automatically:
- ✅ Starts ngrok tunnels
- ✅ Updates all environment files with ngrok URLs
- ✅ Starts both development servers

### 📝 Manual Quick Start
```bash
# 1-4. Same as above

# 5. Start ngrok tunnels
ngrok start --all --config ngrok.yml

# 6. Auto-update environment files with ngrok URLs
npm run update-urls

# 7. Start the application
npm run dev:all
```

## 📋 Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **ngrok** account (for local development)
- **Telegram Bot Token** (from @BotFather)
- **OpenAI API Key**
- **Crossmint API Keys** (staging environment)
- **SearchAPI.io Key** (for Amazon product search)

## 🔑 Crossmint API Scopes

When creating your Crossmint API keys, ensure you enable the following scopes:

### Server-side API Key Scopes:
- `wallets.read` - To fetch wallet information
- `wallets:transactions.create` - To create transactions for purchasing products
- `wallets:transactions.read` - To check transaction status
- `wallets:transactions.sign` - To sign transactions when delegation is enabled
- `orders.create` - To create orders for headless checkout
- `orders.read` - To check order status
- `orders.update` - To update orders if needed

### Client-side API Key Scopes:
- `wallets.read` - To view wallet information in web interface
- `wallets.create` - To create client-side wallets via passkey signers
- `orders.create` - To create checkout orders from client-side

You can configure API keys and scopes in your Crossmint dashboard under Project Settings > API Keys.

## 💨 Quick Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd telegram-agent
npm install
cd web-interface && npm install && cd ..
```

### 2. Quick Setup (Recommended)

```bash
npm run setup
```

This will:
- Copy `.env.example` to `.env`
- Copy `web-interface/.env.example` to `web-interface/.env.local`
- Show setup completion message

**OR** follow the manual setup below:

### 3. Get Required API Keys

#### Telegram Bot Token
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create new bot: `/newbot`
3. Follow prompts and save your bot token in `.env` in root directory

#### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. Save the key (starts with `sk-`) in `.env` in root directory

#### Crossmint API Keys
1. Sign up at [Crossmint Console](https://staging.crossmint.com)
2. Create new project
3. Get both **Server API Key** and **Client API Key**
4. Use **staging** environment for development

#### SearchAPI.io Key
1. Sign up at [SearchAPI.io](https://searchapi.io)
2. Get your API key from dashboard

### 4. Configure Environment Variables

#### Bot Configuration
```bash
cp .env.example .env
```

#### Web Interface Configuration
```bash
cd web-interface
cp .env.example .env.local
```

## 🌐 ngrok Setup (Required for Local Development)

Telegram API sometimes may give a hard time working with http URLs, so we need ngrok to tunnel localhost.

### 1. Install ngrok

```bash
# Option A: npm (recommended)
npm install -g ngrok

# Option B: Download from https://ngrok.com/download
```

### 2. Create ngrok Account

1. Sign up at [ngrok.com](https://ngrok.com)
2. Get your authtoken from dashboard
3. Configure ngrok:

```bash
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

### 3. Start ngrok Tunnels
We've included a `ngrok.yml` configuration file in root.

1. Add your auth token to `ngrok.yml` file
2. Start both tunnels:

```bash
# Start ngrok with our configuration
ngrok start --all --config ngrok.yml
```

This will create two tunnels:
- **Bot Server**: `https://abc123.ngrok.io` → `localhost:3000`
- **Web Interface**: `https://def456.ngrok.io` → `localhost:3001`

### 4. Update Environment Variables

Copy the ngrok URLs and update your environment files:

**Main `.env`:**
```bash
WEB_APP_URL=https://def456.ngrok.io  # Web interface ngrok URL
```

**Web Interface `.env.local`:**
```bash
NEXT_PUBLIC_BOT_API_URL=https://abc123.ngrok.io  # Bot server ngrok URL
BOT_WEBHOOK_URL=https://abc123.ngrok.io/api/webhook/wallet-created
NEXTAUTH_URL=https://def456.ngrok.io  # Web interface ngrok URL
```

## 🚀 Start the Application

### Option A: Start Both Services Together

```bash
npm run dev:all
```

This starts:
- 🤖 **Bot Server** on `localhost:3000`
- 🌐 **Web Interface** on `localhost:3001`

### Option B: Start Services Separately

**Terminal 1 - Bot Server:**
```bash
npm run dev:bot
```

**Terminal 2 - Web Interface:**
```bash
npm run dev:web
```

**Terminal 3 - ngrok (keep running):**
```bash
ngrok start --all --config ngrok.yml
```

## 🧪 Test the Setup

### 1. Test Bot Connection
1. Find your bot on Telegram (search for your bot's username)
2. Send `/start` command
3. You should get a welcome message

### 2. Test Product Search
```
/search wireless headphones
```
You should see Amazon products with "Buy with Crossmint" buttons.

### 3. Test Wallet Creation
1. Click any "Buy with Crossmint" button
2. Should redirect to web interface for wallet creation
3. Complete wallet setup with email/passkey


## 🔧 Available Scripts

### Bot Scripts
```bash
npm run setup            # Quick setup - copy environment files
npm run update-urls      # Auto-update ngrok URLs in environment files
npm run dev:full         # 🚀 Start everything (ngrok + URL updates + servers)
npm run dev:bot          # Start bot in development mode
npm run dev:web          # Start web interface in development mode
npm run dev:all          # Start both bot and web interface
npm run build            # Build both bot and web interface
npm run start            # Start production build
npm run lint             # TypeScript type checking
npm run clean            # Clean build artifacts
```

### Web Interface Scripts
```bash
cd web-interface
npm run dev              # Start Next.js development server
npm run build            # Build for production
npm run start            # Start production server
```

## 🎯 Key Features Walkthrough

### 1. AI Chat
- Send any message to the bot
- Powered by GPT-4o via Vercel AI SDK
- Maintains conversation context

### 2. Product Search
```
/search [product name]
```
- Searches Amazon products via SearchAPI.io
- Shows product cards with images and prices
- "Buy with Crossmint" buttons for each product

### 3. Wallet Management
```
/login    # Create/connect Crossmint wallet
/balance  # Check wallet balance
/topup    # Add funds to wallet
/logout   # Sign out and clear session
```

### 5. Memory & Preferences
```
/memory   # See conversation history
/forget   # Clear conversation history
```

## 🔒 Security Notes

- **Environment Variables**: Never commit `.env` files
- **HTTPS Required**: Telegram requires HTTPS for inline keyboards
- **API Keys**: Keep all API keys secure and rotate regularly
- **Staging Environment**: Use Crossmint staging for development

## 🐛 Troubleshooting

### Bot Not Responding
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot server is running on port 3000
- Check ngrok tunnel is active

### "Invalid web app URL" Error
- Ensure `WEB_APP_URL` uses HTTPS (ngrok URL)
- Verify web interface is running on port 3001
- Check ngrok tunnel for web interface

### Wallet Creation Fails
- Verify `CROSSMINT_CLIENT_API_KEY` is correct
- Check web interface environment variables
- Ensure `NEXTAUTH_URL` matches web interface ngrok URL

### Product Search Not Working
- Verify `SEARCHAPI_KEY` is valid
- Check SearchAPI.io quota/limits
- Ensure internet connection is stable

### ngrok Issues
- Verify authtoken is configured: `ngrok config check`
- Check if ports 3000/3001 are available
- Try restarting ngrok: `ngrok start --all --config ngrok.yml`

## 📚 Documentation

- [Crossmint Documentation](https://docs.crossmint.com)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Next.js Documentation](https://nextjs.org/docs)

## 👷 Support

Join our [telegram chat](https://t.me/+FmKl2FsaRKIzZjlk) if you have any questions.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to revolutionize shopping with AI! 🛒🤖**