#!/usr/bin/env bash
# Prints the product identity block from CMakeLists.txt as KEY=value lines, e.g.
#   PRODUCT_NAME=Plugin Starter
#   PRODUCT_VERSION=0.1.0
# CI appends this to $GITHUB_ENV so every step uses the same names as the build.
#
# Usage: scripts/product-info.sh [path/to/CMakeLists.txt]
set -euo pipefail

cmake_file="${1:-$(dirname "$0")/../CMakeLists.txt}"

sed -nE 's/^set\((PRODUCT_[A-Z_]+) "([^"]*)"\).*/\1=\2/p' "$cmake_file"
