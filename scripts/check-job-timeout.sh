#!/bin/bash
# check-job-timeout.sh - 检查并修复卡住的任务
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
result=$(npx tsx -e "import { checkAndFixStaleJobs } from './lib/db/jobTimeout'; const n = checkAndFixStaleJobs(); console.log('Fixed:', n);")
echo "[$(date)] $result"