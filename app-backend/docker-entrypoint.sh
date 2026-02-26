#!/bin/sh
# package.json 체크섬 기반 npm install 자동 실행
# named volume이 비어 있거나 package.json이 변경되면 npm install 실행

HASH_FILE="node_modules/.package-hash"
CURRENT_HASH=$(md5sum package.json | cut -d' ' -f1)

if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "[entrypoint] node_modules is empty (named volume), running npm install..."
    npm install
elif [ ! -f "$HASH_FILE" ] || [ "$(cat $HASH_FILE)" != "$CURRENT_HASH" ]; then
    echo "[entrypoint] package.json changed, running npm install..."
    npm install
else
    echo "[entrypoint] node_modules up-to-date, skipping npm install"
fi

echo "$CURRENT_HASH" > "$HASH_FILE"
exec "$@"
