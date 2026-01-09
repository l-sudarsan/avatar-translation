# Production Dockerfile for Speech Translation with Avatar
# Optimized for Azure App Service or Azure Container Instances

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for Azure Speech SDK
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libssl-dev \
    ca-certificates \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements-production.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY vad_iterator.py .
COPY speaker.html .
COPY listener.html .
COPY static/css/styles.css static/css/
COPY static/js/speaker.js static/js/
COPY static/js/listener.js static/js/

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port (Azure App Service uses PORT env variable, default 8000)
EXPOSE 8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/getStatus', timeout=5)" || exit 1

# Environment variables (override in Azure Portal or docker-compose)
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Use Gunicorn with eventlet worker for WebSocket support
# Single worker is required for Socket.IO session consistency
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:8000", "--timeout", "120", "--log-level", "info", "app:app"]
