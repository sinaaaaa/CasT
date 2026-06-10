@echo off
setlocal
set CONTAINER=sparc-assessment-db
set OUT=backups\sparc-full-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.sql
set OUT=%OUT: =0%
mkdir backups 2>nul
echo Backing up PostgreSQL from Docker container %CONTAINER% ...
docker exec -t %CONTAINER% pg_dump -U sparc -d sparc_assessment > "%OUT%"
if errorlevel 1 (
  echo Failed. Is Docker running and container %CONTAINER% started?
  echo Start with: docker compose up -d
  exit /b 1
)
echo Saved full database to %OUT%
echo Restore with: docker exec -i %CONTAINER% psql -U sparc -d sparc_assessment ^< "%OUT%"
