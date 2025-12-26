#!/bin/bash

echo "--- Starting Tab Syncer Services ---"

# 1. Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# 2. Start Database
echo "Starting database..."
docker-compose up -d postgres

# 3. Wait for DB to be ready
echo "Waiting for database to initialize..."
sleep 5

# 4. Run Connection Check
echo "Verifying connection..."
cd server
node src/scripts/check_db.js
