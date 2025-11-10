FROM python:3.11-slim
WORKDIR /app

# Install minimal system deps for transformers if needed
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential libsndfile1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src/local_summarizer.py ./src/local_summarizer.py

CMD ["python", "src/local_summarizer.py"]
