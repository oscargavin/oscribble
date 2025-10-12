# GitHub Setup Instructions

Your local repository is ready! Follow these steps to push to GitHub:

## 1. Create GitHub Repository

Go to [github.com/new](https://github.com/new) and create a new repository:

- **Repository name**: `oscribble`
- **Description**: A brutalist task manager that transforms raw notes into AI-analyzed, structured task lists
- **Public** ✅ (for open source)
- **DO NOT** initialize with README, .gitignore, or license (we already have these)

## 2. Push to GitHub

After creating the repository, run these commands:

```bash
# Add GitHub as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/oscribble.git

# Push code and tags
git push -u origin main
git push origin v1.0.0
```

## 3. Create Release with DMG

1. Go to your repo → **Releases** → **Draft a new release**
2. Choose tag: `v1.0.0`
3. Release title: `Oscribble v1.0.0 - Initial Release`
4. Description (copy from below):

```markdown
# Oscribble v1.0.0

A brutalist task manager that transforms raw bullet-point notes into AI-analyzed, structured task lists using Claude AI.

## 🎯 Features

- **Raw-to-Structured Conversion**: Write quick notes, let Claude organize them
- **Context-Aware**: Mention files with `@filepath` to include code context
- **Keyboard-First Navigation**: Arrow keys, space bar, and shortcuts
- **Priority Tracking**: Critical/Performance/Feature categorization
- **Dependency Detection**: Automatically flags blocked tasks
- **Multi-Project Management**: `Cmd+K` quick switcher
- **Brutalist Design**: Monochrome terminal aesthetic with orange accents

## 📦 Installation

### macOS (Apple Silicon)

1. Download `Oscribble-1.0.0-arm64.dmg` below
2. Open the DMG and drag Oscribble to Applications
3. **Right-click** Oscribble → **Open** (first launch only)
4. Enter your [Anthropic API key](https://console.anthropic.com/)

⚠️ **Important**: First launch requires right-click → Open (not double-click) due to lack of code signing.

## 🚀 Getting Started

1. Create a project and select your project directory
2. Write raw tasks in plain text
3. Add `@src/file.ts` mentions for context
4. Click Format or press `Cmd+Enter`
5. Navigate with arrow keys, toggle with space

## 📚 Documentation

- [User Guide](https://github.com/YOUR_USERNAME/oscribble#usage)
- [Keyboard Shortcuts](https://github.com/YOUR_USERNAME/oscribble#keyboard-shortcuts)
- [MCP Integration](https://github.com/YOUR_USERNAME/oscribble/blob/main/docs/mcp-integration.md)
- [Development Guide](https://github.com/YOUR_USERNAME/oscribble/blob/main/CLAUDE.md)

## 🔧 Requirements

- macOS 11+ (Big Sur or newer)
- [Anthropic API key](https://console.anthropic.com/) (free tier available)

## 🛠️ Build from Source

```bash
git clone https://github.com/YOUR_USERNAME/oscribble.git
cd oscribble
npm install
npm start
```

## 📝 License

MIT License - see [LICENSE](https://github.com/YOUR_USERNAME/oscribble/blob/main/LICENSE)

---

**Note**: Oscribble is not affiliated with Anthropic. You need your own API key.
```

5. **Attach DMG**: Drag `out/make/Oscribble-1.0.0-arm64.dmg` to the assets section
6. Click **Publish release**

## 4. Update README Links

After creating the repo, update these placeholders in README.md:

```bash
# Replace YOUR_USERNAME with your actual GitHub username
sed -i '' 's/YOUR_USERNAME/oscargavin/g' README.md
git add README.md
git commit -m "Update README with GitHub username"
git push
```

## 5. Add Topics (Optional but Recommended)

On your GitHub repo page:
1. Click ⚙️ next to "About"
2. Add topics: `electron`, `react`, `typescript`, `task-manager`, `claude-ai`, `brutalist-design`, `macos`

## 6. Enable Discussions (Optional)

Settings → Features → Check "Discussions"

Great for user questions and feature requests!

## Verification Checklist

- ✅ Repository created on GitHub
- ✅ Code pushed to main branch
- ✅ v1.0.0 tag pushed
- ✅ Release created with DMG attached
- ✅ README links updated
- ✅ Topics added
- ✅ License visible on repo page

## Next Steps

**Share your release!**

```
🚀 Oscribble v1.0.0 is here!

A brutalist task manager that transforms raw notes into AI-analyzed tasks using Claude.

Download: https://github.com/YOUR_USERNAME/oscribble/releases/tag/v1.0.0

Features:
✦ Raw-to-structured conversion
✦ Context-aware @mentions
✦ Keyboard-first navigation
✦ Priority tracking & dependencies
✦ Multi-project management

Open source & MIT licensed.
```

## Troubleshooting

**Push rejected**: Your remote URL might be wrong
```bash
git remote -v  # Check current remote
git remote set-url origin https://github.com/YOUR_USERNAME/oscribble.git
```

**Authentication failed**: Use a personal access token instead of password
- GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Generate new token with `repo` scope
- Use token as password when prompted

**Want SSH instead?**
```bash
git remote set-url origin git@github.com:YOUR_USERNAME/oscribble.git
```

---

Need help? Check [GitHub's docs](https://docs.github.com/en/get-started/quickstart/create-a-repo) or reach out!
