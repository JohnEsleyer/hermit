FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/workspace/work \
    /app/workspace/in \
    /app/workspace/out \
    /app/workspace/apps

ENV PYTHONUNBUFFERED=1
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

CMD ["sleep", "infinity"]
