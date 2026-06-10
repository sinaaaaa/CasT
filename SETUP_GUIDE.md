# SPARC Coding Game - Local Setup Guide

## Prerequisites
- Python 3.7 or higher
- Unity 2022.3 LTS or higher
- Git (optional, for version control)

## Step 1: Backend Setup (Flask Server)

### 1.1 Install Python Dependencies
```bash
cd coding-block-SPARC
pip install -r requirements.txt
```

### 1.2 Start the Flask Server
```bash
python app.py
```

The server will start on `http://localhost:5000`

### 1.3 Verify Server is Running
```bash
python test_connection.py
```

You should see:
- ✓ Server is running
- ✓ Student check endpoint working
- ✓ Game progress endpoint working

## Step 2: Unity Setup

### 2.1 Open Unity Project
1. Open Unity Hub
2. Add the `coding-block-SPARC` folder as a project
3. Open the project in Unity

### 2.2 Verify Script Configurations
The following scripts have been updated to connect to localhost:
- `Assets/Scripts/FlaskCommunication.cs` - Now points to `http://localhost:5000`
- `Assets/Scripts/LoginSceneManager.cs` - Now points to `http://localhost:5000`
- `Assets/Scripts/GameLogViewer.cs` - Already configured for localhost
- `Assets/Scripts/StudentDataManager.cs` - Already configured for localhost

### 2.3 Build and Run
1. In Unity, go to `File > Build Settings`
2. Select your target platform (Windows, Mac, or Linux)
3. Click "Build and Run"

## Step 3: Testing the Connection

### 3.1 Test Student Login
1. Run the Unity game
2. Enter any student ID (e.g., "1")
3. The system should create a new student account automatically

### 3.2 Test Game Progress
1. Play through a level in the game
2. Check the Flask server console for incoming requests
3. Verify data is being saved to the database

## Troubleshooting

### Flask Server Issues
- **Port 5000 already in use**: Change the port in `app.py` line 1647
- **Database errors**: Delete `instance/coding_block.db` and restart the server
- **Import errors**: Make sure all dependencies are installed with `pip install -r requirements.txt`

### Unity Connection Issues
- **Connection refused**: Make sure Flask server is running on port 5000
- **CORS errors**: The server has CORS enabled, but check browser console for details
- **SSL errors**: The local server uses HTTP, not HTTPS

### Common Error Messages
- `"Cannot connect to server"`: Flask server not running
- `"Student not found"`: Normal for new students, they get created automatically
- `"Database locked"`: Close any other applications using the database file

## API Endpoints

The Flask server provides these main endpoints:
- `GET /api/check_student/{id}` - Check if student exists, create if not
- `POST /api/game_progress` - Save game progress
- `GET /api/get_user_logs/{id}` - Get user's game logs
- `POST /api/ct_assessment` - Submit computational thinking assessment

## Database

The application uses SQLite by default (stored in `instance/coding_block.db`). The database is created automatically when you first run the Flask server.

## Development Notes

- The Flask server runs in debug mode by default
- Unity WebGL builds can be served directly by the Flask server
- All API responses are in JSON format
- CORS is enabled for cross-origin requests from Unity

## Next Steps

1. Test the complete workflow: Login → Play Game → Save Progress
2. Check the teacher dashboard at `http://localhost:5000/teacher/dashboard`
3. Verify assessments are being generated correctly
4. Test the Unity WebGL build served by Flask
