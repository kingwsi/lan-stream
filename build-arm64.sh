#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define variables
OUTPUT_BINARY="lan-stream-arm64"
ARCHIVE_NAME="lan-stream-arm64-deploy.tar.gz"

# --- Build Step ---
echo "Building Go application for Linux (arm64)..."
GOOS=linux GOARCH=arm64 go build -o "$OUTPUT_BINARY" main.go
echo "Build complete: $OUTPUT_BINARY"

# --- Packaging Step ---
echo "
Packaging application..."
tar -czvf "$ARCHIVE_NAME" "$OUTPUT_BINARY" static config.json
echo "Packaging complete: $ARCHIVE_NAME"

rm $OUTPUT_BINARY

echo "
Build and packaging process finished successfully."
