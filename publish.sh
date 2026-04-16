#!/bin/bash

# Saola Client - Build and Publish Script

echo "🚀 Building Saola Client..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"

    echo "📦 Publishing to npm..."
    # Uncomment the next line when ready to publish
    # npm publish

    echo "🎉 Saola Client published successfully!"
else
    echo "❌ Build failed!"
    exit 1
fi