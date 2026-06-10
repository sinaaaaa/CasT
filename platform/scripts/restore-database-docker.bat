@echo off
setlocal
set CONTAINER=sparc-assessment-db
set BACKUP=%~1
if "%BACKUP%"=="" set BACKUP=backups\sparc-full-20260606-152657.sql

if not exist "%BACKUP%" (
  echo Backup not found: %BACKUP%
  exit /b 1
)

echo WARNING: This replaces ALL data in sparc_assessment with the backup file.
echo Backup: %BACKUP%
echo.
pause

echo Dropping and recreating database...
docker exec %CONTAINER% psql -U sparc -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sparc_assessment' AND pid <> pg_backend_pid();" >nul 2>&1
docker exec %CONTAINER% psql -U sparc -d postgres -c "DROP DATABASE IF EXISTS sparc_assessment WITH (FORCE);"
docker exec %CONTAINER% psql -U sparc -d postgres -c "CREATE DATABASE sparc_assessment OWNER sparc;"

echo Restoring...
docker exec -i %CONTAINER% psql -U sparc -d sparc_assessment < "%BACKUP%"
if errorlevel 1 (
  echo Restore reported errors. Check output above.
  exit /b 1
)

echo Done. Run: npm run db:push
echo (applies any schema changes added after the backup was taken)
