#!/bin/bash

echo "📦 Zipping app for Azure deployment..."

zip -r deploy.zip \
    main.py \
    requirements.txt \
    entrypoint.py \
    healthcheck.py \
    startup.sh \
    web.config \
    test_startup.py \
    static \
    data \
    *.py
