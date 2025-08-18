#!/bin/bash

echo "🚀 Starting full development environment..."

# Check if ngrok is running
if ! curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo ""
    echo "⚠️  ngrok not detected on port 4040"
    echo ""
    echo "Starting ngrok tunnels..."
    
    # Start ngrok in background
    ngrok start --all --config ngrok.yml > /dev/null 2>&1 &
    
    # Wait for ngrok to be ready
    echo "⏳ Waiting for ngrok to start..."
    for i in {1..30}; do
        if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
            echo "✅ ngrok is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ ngrok failed to start within 30 seconds"
            echo "Please start ngrok manually: ngrok start --all --config ngrok.yml"
            exit 1
        fi
        sleep 1
    done
else
    echo "✅ ngrok is already running"
fi

# Update environment files with ngrok URLs
echo ""
echo "🔄 Updating environment files with ngrok URLs..."
npm run update-urls

if [ $? -ne 0 ]; then
    echo "❌ Failed to update URLs"
    exit 1
fi

# Start development servers
echo ""
echo "🎬 Starting development servers..."
npm run dev:all