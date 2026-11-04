# How to Build This Game as a Standalone Windows Executable (.exe)

You have two powerful options to turn this game into a Windows `.exe`:
1. **Method 1: Direct Web-to-EXE Package (Fastest)** — Package the existing React + Three.js application into a standalone desktop `.exe` with native pointer lock, hardware acceleration, and fullscreen support.
2. **Method 2: Godot 4.7 Native Engine Export** — Export the included native Godot port (`/godot_port`) into a high-performance native C++/Vulkan Windows binary.

---

## Method 1: Build a Windows .exe with Electron (Recommended for Instant Setup)

This wraps your built game inside a dedicated Chromium window with WebGL hardware acceleration, no browser borders, and automatic pointer lock handling.

### Step 1: Install `electron` and `electron-builder`
In your project directory, run:
```bash
npm install -D electron electron-builder
```

### Step 2: Add Desktop Build Scripts to `package.json`
Add the following fields to your `package.json`:

```json
"main": "electron/main.cjs",
"scripts": {
  "electron:dev": "electron .",
  "dist:win": "vite build && electron-builder --win --x64"
},
"build": {
  "appId": "com.radiantprotocol.fps",
  "productName": "Radiant Protocol 3D",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],
  "win": {
    "target": ["nsis", "portable"],
    "icon": "public/favicon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

### Step 3: Run the Build Command
To produce the `.exe`:
```bash
npm run dist:win
```

### What You Get:
Your standalone executable will be located in the newly created `release/` folder:
- `release/Radiant Protocol 3D Setup.exe` (Full Windows Installer)
- `release/Radiant Protocol 3D.exe` (Portable zero-install `.exe`)

---

## Method 2: Ultra-Lightweight .exe with Tauri (Alternative to Electron)

If you prefer a tiny download size (~15 MB instead of Electron's ~80 MB) with lower RAM usage:

1. Install the Tauri CLI:
   ```bash
   npm install -D @tauri-apps/cli
   ```
2. Initialize Tauri:
   ```bash
   npx tauri init
   ```
   - When asked for the development dev URL: `http://localhost:3000`
   - When asked for the frontend dist path: `../dist`
3. Build the Windows `.exe`:
   ```bash
   npm run build
   npx tauri build
   ```
The generated `.exe` will be saved to `src-tauri/target/release/`.

---

## Method 3: Native Godot 4.7 Engine Export (.exe)

This project already contains complete Godot 4.7 port assets in the `/godot_port` directory:
- `/godot_port/project.godot` (128Hz physics tickrate, input maps, shadow filtering)
- `/godot_port/scripts/player_controller.gd` (Unified recoil, lateral strafe penalty, conical raycasts)
- `/godot_port/scripts/rig_system.gd` (Rig loadouts, energy validation, active/passive abilities)
- `/godot_port/schemas/weapons_data.json` (Catalog of all 10 weapons)
- `/godot_port/schemas/rig_modules.json` (Active & passive module definitions)

### Steps to Export via Godot:
1. Download **Godot 4.7** (Standard 64-bit) from [godotengine.org](https://godotengine.org/).
2. Open Godot, click **Import**, and select the `/godot_port/project.godot` file.
3. In the Godot top menu, go to **Project > Export...**.
4. Click **Add...** and select **Windows Desktop**.
5. Click **Download Export Templates** if prompted (one-time automatic download inside Godot).
6. Click **Export Project**, choose your destination folder, and name the file `RadiantProtocol.exe`.

---

## Summary of Options
| Feature | Electron (Method 1) | Tauri (Method 2) | Godot 4.7 (Method 3) |
| :--- | :--- | :--- | :--- |
| **Setup Time** | 2 minutes (`npm run dist:win`) | 5 minutes | 5 minutes |
| **Output Size** | ~85 MB | ~15 MB | ~45 MB |
| **Performance** | High (WebGL2 + Chrome V8) | High (WebView2) | Maximum (Vulkan Native C++) |
| **Requires Godot Installed** | No (just Node.js) | No (requires Rust/WebView2) | Yes |
