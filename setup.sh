#!/bin/bash

echo "🔧 Setting up ZKP Server..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create circuits directory
echo "📁 Creating circuits directory..."
mkdir -p circuits

# Copy circuit files
echo "📋 Copying circuit files..."
if [ -f "../app/public/zk/circuit.wasm" ]; then
    cp ../app/public/zk/circuit.wasm circuits/
    echo "✅ Copied circuit.wasm"
else
    echo "❌ circuit.wasm not found in ../app/public/zk/"
    exit 1
fi

if [ -f "../app/public/zk/circuit_final.zkey" ]; then
    cp ../app/public/zk/circuit_final.zkey circuits/
    echo "✅ Copied circuit_final.zkey"
else
    echo "❌ circuit_final.zkey not found in ../app/public/zk/"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  npm run dev    # Development with auto-reload"
echo "  npm start      # Production"
echo ""
echo "Server will run on http://localhost:4000"
