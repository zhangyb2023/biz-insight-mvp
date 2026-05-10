#!/bin/bash
# cleanup-logs.sh - 清理过期的 PM2 日志

LOG_DIR="/home/openclaw-ubuntu-zyb/.pm2/logs"
MAX_AGE_DAYS=7

echo "[$(date)] Starting log cleanup..."

if [ ! -d "$LOG_DIR" ]; then
    echo "Log directory not found: $LOG_DIR"
    exit 1
fi

# 找出并删除 7 天前的日志文件
count=$(find "$LOG_DIR" -name "*.log" -type f -mtime +$MAX_AGE_DAYS | wc -l)
if [ "$count" -gt 0 ]; then
    find "$LOG_DIR" -name "*.log" -type f -mtime +$MAX_AGE_DAYS -delete
    echo "Deleted $count old log files"
else
    echo "No old log files to delete"
fi

# 检查磁盘使用
total_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
echo "Total log directory size: $total_size"

# 如果日志目录超过 500MB，删除最旧的日志
dir_size=$(du -s "$LOG_DIR" 2>/dev/null | cut -f1)
if [ "$dir_size" -gt 500000 ]; then
    echo "Log directory exceeds 500MB, removing oldest files..."
    find "$LOG_DIR" -name "*.log" -type f -exec ls -lt {} \; | tail -20 | awk '{print $NF}' | xargs rm -f 2>/dev/null
    echo "Cleanup complete"
fi

echo "[$(date)] Log cleanup finished"