# Image de base optimisée et stable pour le CPU
FROM python:3.10-slim

# Éviter l'écriture de fichiers .pyc et assurer l'affichage immédiat des logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Répertoire de travail
WORKDIR /app

# Installation des dépendances système nécessaires à PaddleOCR et OpenCV (libglib2, libgomp1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copier et installer les dépendances Python d'abord pour bénéficier du cache Docker
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copier l'intégralité du code de l'application
COPY . .

# Exposer le port par défaut de l'API
EXPOSE 8000

# Commande de démarrage avec Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
