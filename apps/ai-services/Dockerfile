# apps/ai-services/Dockerfile · FastAPI, non-root.
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN useradd -m app
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .
COPY src ./src
USER app
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
