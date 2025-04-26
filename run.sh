export BROWSER=google-chrome-stable

if [ -z "$BROWSER" ]; then
    echo "BROWSER is not set"
    exit 1
fi

node src/index.js
$BROWSER http://localhost:4566