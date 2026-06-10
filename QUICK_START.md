# Quick Start Guide - SPARC Coding Game

## 🚀 Get Started in 3 Steps

### Step 1: Start the Backend Server
```bash
# Option 1: Using PowerShell (Recommended)
.\start_server.ps1

# Option 2: Using Command Prompt
.\start_server.bat

# Option 3: Manual start
python app.py
```

**Expected Output:**
```
Starting SPARC Flask Server...
Server will start on http://localhost:5000
 * Running on http://0.0.0.0:5000
```

### Step 2: Open Unity Project
1. Open Unity Hub
2. Add the `coding-block-SPARC` folder as a project
3. Open the project in Unity
4. The scripts are already configured to connect to `localhost:5000`

### Step 3: Test the Connection
1. In Unity, go to `File > Build Settings`
2. Select your target platform
3. Click "Build and Run"
4. Enter any student ID (e.g., "1") to test login

## ✅ Verification

The server is working correctly if you see:
- Flask server running on port 5000
- Unity can connect and create student accounts
- Game progress is saved to the database

## 🔧 Troubleshooting

**If Unity can't connect:**
- Make sure Flask server is running (`python app.py`)
- Check that port 5000 is not blocked by firewall
- Verify Unity scripts point to `http://localhost:5000`

**If you get import errors:**
```bash
pip install -r requirements.txt
```

**If port 5000 is in use:**
- Change the port in `app.py` line 1647
- Update Unity scripts to match the new port

## 📁 Important Files

- `app.py` - Flask backend server
- `Assets/Scripts/FlaskCommunication.cs` - Unity connection script
- `Assets/Scripts/LoginManager.cs` - Unity login handling
- `instance/coding_block.db` - SQLite database (created automatically)

## 🎮 Game Features

- Student login system
- Computational thinking assessment
- Progress tracking
- Teacher dashboard
- Unity WebGL integration

## 📞 Support

If you encounter issues:
1. Check the console output for error messages
2. Verify all dependencies are installed
3. Ensure no other applications are using port 5000
4. Check the `SETUP_GUIDE.md` for detailed instructions
