#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for domain in suvarnatantu.com www.suvarnatantu.com; do
  surge . "$domain"
done
