<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Animato Studio

**AI-Powered Animation Content Generator** - Create viral-ready animated content with intelligent script generation, voice synthesis, and visual prompts.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy)

---

## ✨ Features

- 🎨 **Multi-Style Animation Support** - Flat 2D, Semi-realistic, Minimalist, Pixel Art, and more
- 🤖 **AI Content Generation** - Powered by Google Gemini 3 (Flash & Pro)
- 🎙️ **Voice Synthesis** - Multiple voice options with preview
- 🔄 **Smart API Key Rotation** - Multi-key support with automatic failover
- 📊 **Health Tracking** - Monitor API key usage and health status
- 🌐 **Multi-Language** - Indonesian & English support

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** ([Download](https://nodejs.org/))
- **Google AI Studio API Key** ([Get yours free](https://aistudio.google.com/apikey))

### Run Locally

1. **Clone & Install**
   ```bash
   git clone <your-repo-url>
   cd animato-studio
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   App will open at: **http://localhost:3000**

3. **Add Your API Key**
   - Click **"⚠️ Tambah API Key"** in the navbar
   - Enter your Google AI Studio API key
   - Start creating content!

> **Note:** API keys are stored in your browser's localStorage (100% client-side, no server needed)

---

## 📦 Deploy to Netlify

### Option 1: GitHub Integration (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com) and sign in
   - Click **"Add new site"** → **"Import an existing project"**
   - Choose **GitHub** and select your repository
   - Build settings are auto-detected from `netlify.toml`
   - Click **"Deploy site"**

3. **Done!** 🎉
   - Your site will be live in ~2 minutes
   - Auto-deploys on every push to `main`
   - Custom domain available in settings

### Option 2: Netlify CLI

1. **Install CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login**
   ```bash
   netlify login
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```
   For preview deploy:
   ```bash
   npm run deploy:preview
   ```

### Option 3: Drag & Drop

1. **Build locally**
   ```bash
   npm run build
   ```

2. **Deploy**
   - Visit [app.netlify.com/drop](https://app.netlify.com/drop)
   - Drag the `dist` folder
   - Done!

---

## 🔧 Build Configuration

The project is pre-configured for Netlify deployment:

| File | Purpose |
|------|---------|
| `netlify.toml` | Build settings & redirects |
| `.nvmrc` | Node version (20) |
| `public/_redirects` | SPA routing support |

**Build Command:** `npm run build`  
**Publish Directory:** `dist`  
**Node Version:** 20

---

## 🎯 Usage Guide

### 1. Content Creation Flow

1. **Select Topic** - Choose from 11+ content categories
2. **Configure** - Set language, style, tone, and platform
3. **Generate Ideas** - AI creates 6 viral content concepts
4. **Script Generation** - Select an idea to get full script
5. **Voice Over** - Generate AI narration with voice preview
6. **Visual Prompts** - Get timestamped prompts for each segment
7. **Export** - Download audio narration and visual prompts

### 2. API Key Management

**Adding Keys:**
- Click Settings (⚙️ icon)
- Enter API key (format: `AIza...`, 39 characters)
- Add up to 10 keys for rotation

**Smart Rotation:**
- Automatic failover on quota limits (429 errors)
- Health tracking per key (calls, failures, last used)
- Keys with 3+ failures are auto-skipped
- Real-time Toast notifications on rotation

**Monitoring:**
- View health badges (Healthy ✓, Warning ⚠, Failed ✗)
- Reset failed keys with refresh button
- Track usage statistics per key

---

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Build for production
npm run preview      # Preview production build
npm run deploy       # Build & deploy to Netlify (prod)
npm run deploy:preview  # Build & deploy preview
```

### Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **AI SDK:** @google/genai
- **Styling:** Tailwind CSS (utility-first)

---

## 🔒 Privacy & Security

- ✅ **No Backend** - Fully client-side application
- ✅ **Local Storage** - API keys stored in browser only
- ✅ **No Tracking** - No analytics or third-party scripts
- ✅ **Open Source** - Full code transparency

---

## 🐛 Troubleshooting

### Build Fails
**Error:** "Cannot find module 'react'"  
**Fix:** Run `npm install` first

### Blank Page After Deploy
**Fix:** Ensure `public/_redirects` exists (should be auto-created)

### API Key Not Working
- Verify key format: starts with `AIza`, 39 characters
- Check quota at [AI Studio Console](https://aistudio.google.com/)
- Try adding a second key for failover

### Toast Notifications Not Showing
**Fix:** This is a known issue - ensure browser JavaScript is enabled

---

## 📝 License

MIT License - Free to use and modify

---

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

## 🔗 Links

- **Original App:** [AI Studio](https://ai.studio/apps/drive/1t6ajMAWJ14vNBcewtOm38vO1diScs646)
- **Documentation:** [View Implementation Plan](./implementation_plan.md)
- **Support:** Open an issue on GitHub

---

**Made with ❤️ using Google Gemini AI**
 
