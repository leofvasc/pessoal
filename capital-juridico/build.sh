#!/bin/sh
# Gera os pacotes .zip que são enviados pelo painel do WordPress.
set -e
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/capital-juridico-core.zip dist/capital-juridico-tema.zip
(cd wp-content/plugins && zip -qr ../../dist/capital-juridico-core.zip capital-juridico-core -x '*.DS_Store')
(cd wp-content/themes && zip -qr ../../dist/capital-juridico-tema.zip capital-juridico -x '*.DS_Store')
ls -l dist
