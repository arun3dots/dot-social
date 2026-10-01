@echo off
REM One scheduler tick. Register in Task Scheduler:
REM   schtasks /create /tn "SocialEngineScheduler" /tr "D:\POC\Social-media\tools\scheduler_tick.cmd" /sc minute /mo 5
REM Set SCHEDULER_SECRET here (and in .env) so the tick can authenticate headlessly.
cd /d D:\POC\Social-media
set SCHEDULER_URL=http://localhost:3000/api/scheduler/run
node tools\scheduler_worker.js --once
