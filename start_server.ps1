Write-Host "Starting SPARC Flask Server..." -ForegroundColor Green
Write-Host ""
Write-Host "Make sure you have Python installed and dependencies are installed." -ForegroundColor Yellow
Write-Host "If you haven't installed dependencies yet, run: pip install -r requirements.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "Server will start on http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

try {
    python app.py
} catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
    Write-Host "Make sure Python is installed and in your PATH" -ForegroundColor Red
}

Read-Host "Press Enter to exit"
