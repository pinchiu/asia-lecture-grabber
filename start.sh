#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "========================================================"
echo "  亞洲大學講座自動報名助手與畢業素養門檻追蹤系統"
echo "  服務位址：http://127.0.0.1:5199"
echo "========================================================"

(sleep 2 && (command -v xdg-open >/dev/null && xdg-open http://127.0.0.1:5199 || command -v open >/dev/null && open http://127.0.0.1:5199)) &
node src/server.mjs
