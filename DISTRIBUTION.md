# Oscribble Distribution Guide

## Build Status ✅

Successfully configured for macOS distribution!

**Latest build:**
- `Oscribble-1.0.0-arm64.dmg` (109MB)
- Location: `out/make/`

## What's Been Set Up

### 1. Icon and Branding
- ✅ Created `oscribble.icns` from `oscribble.png`
- ✅ Configured app icon in `forge.config.ts`
- ✅ Updated product name to "Oscribble"

### 2. Build Configuration
- ✅ Installed `@electron-forge/maker-dmg`
- ✅ Configured DMG maker with ULFO format
- ✅ Updated package.json metadata
- ✅ Added icon to packager config

### 3. Documentation
- ✅ Created comprehensive README.md
- ✅ Added MIT LICENSE
- ✅ Updated .gitignore

### 4. Test Build
- ✅ Successfully built DMG distributable
- ✅ Verified icon appears correctly

## Distribution Workflow

### For Local Testing

```bash
# Build the app
npm run make

# Output will be in:
# out/make/Oscribble-1.0.0-arm64.dmg
```

### For GitHub Release

1. **Commit and Push**
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

2. **Create GitHub Release**
   - Go to GitHub → Releases → Draft a new release
   - Choose tag `v1.0.0`
   - Upload `out/make/Oscribble-1.0.0-arm64.dmg`
   - Add release notes

3. **Distribution Link**
   ```
   https://github.com/oscargavin/oscribble/releases/download/v1.0.0/Oscribble-1.0.0-arm64.dmg
   ```

## User Installation (Without Code Signing)

Since the app isn't code-signed, users will see a security warning on first launch:

**Instructions for users:**

1. Download `Oscribble-1.0.0-arm64.dmg`
2. Open the DMG
3. Drag Oscribble to Applications
4. **Important**: Right-click Oscribble → Open (NOT double-click!)
5. Click "Open" in the security dialog
6. Enter Anthropic API key when prompted

**First launch only** requires right-click → Open. After that, normal double-click works.

## Code Signing (Optional - $99/year)

To avoid the security warning, you need:

1. **Apple Developer Account** ($99/year)
2. **Developer ID Certificate**
3. **Notarization**

Add to `forge.config.ts`:

```typescript
packagerConfig: {
  asar: true,
  icon: './oscribble.icns',
  name: 'Oscribble',
  executableName: 'Oscribble',
  osxSign: {
    identity: 'Developer ID Application: Your Name (TEAMID)',
  },
  osxNotarize: {
    appleId: 'your@email.com',
    appleIdPassword: '@keychain:AC_PASSWORD',
    teamId: 'TEAMID',
  },
},
```

## Linux/Windows Builds

The forge config includes DEB/RPM/Squirrel makers, but they require:
- Linux builds: Run on Linux or use CI/CD
- Windows builds: Run on Windows or use CI/CD

**Remove if macOS-only:**

```typescript
// In forge.config.ts, remove:
new MakerSquirrel({}),  // Windows
new MakerRpm({}),       // Linux
new MakerDeb({}),       // Linux
```

## CI/CD (GitHub Actions)

For automated builds on every release:

```yaml
# .github/workflows/build.yml
name: Build Releases

on:
  push:
    tags:
      - 'v*'

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run make
      - uses: actions/upload-artifact@v3
        with:
          name: dmg
          path: out/make/*.dmg
```

## Next Steps

1. **Test the DMG**: Open `out/make/Oscribble-1.0.0-arm64.dmg` and verify it works
2. **Create GitHub Repo**: Push code to GitHub
3. **Create Release**: Upload DMG to GitHub Releases
4. **Share**: Send release link to users

## File Checklist

Distribution-ready files:
- ✅ `README.md` - Usage docs
- ✅ `LICENSE` - MIT license
- ✅ `CLAUDE.md` - Development docs
- ✅ `oscribble.png` - Logo
- ✅ `oscribble.icns` - App icon
- ✅ `.gitignore` - Ignores build artifacts
- ✅ `forge.config.ts` - Build configuration
- ✅ `package.json` - Metadata

## Troubleshooting

**Build fails with icon error:**
- Verify `oscribble.icns` exists in root
- Check file permissions: `ls -l oscribble.icns`

**DMG too large (>200MB):**
- Normal for Electron apps
- Includes Chromium runtime (~100MB base)

**Users can't open app:**
- Remind them: Right-click → Open (first time only)
- Check macOS version (requires 11+)

---

**Ready to distribute!** 🚀

Build with `npm run make`, upload DMG to GitHub Releases.
