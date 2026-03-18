#!/bin/bash
# Backup script for Onyx database

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

if [ -f "database.sqlite" ]; then
    cp database.sqlite "$BACKUP_DIR/database_$DATE.sqlite"
    echo "Backup created: database_$DATE.sqlite"
    
    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/database_*.sqlite | tail -n +8 | xargs -r rm
    echo "Old backups cleaned up"
else
    echo "No database file found to backup"
fi