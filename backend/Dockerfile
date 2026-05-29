FROM python:3.14-slim

WORKDIR /app

# Install system deps for PyMuPDF and Tesseract OCR (FR + EN)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data dirs
RUN mkdir -p data uploads

EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
