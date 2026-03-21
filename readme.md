# gke-cluster-communication-demo

Demo of HTTP communication between two simulated GKE clusters using Node.js, NestJS (Cluster B — internal service) and Express (Cluster A — API Gateway).

---

## ¿Qué hace este proyecto?

Simula la arquitectura de dos clústeres de Kubernetes comunicándose entre sí vía HTTP, tal como lo hacen empresas que trabajan con microservicios en Google Kubernetes Engine.

```
[Cliente / curl / browser]
          ↓  HTTP :3000
    CLUSTER A (Express)
    API Gateway — entrada pública
          ↓  HTTP :3001
    CLUSTER B (NestJS)
    Products Service — servicio interno
          ↓
    products.db.json
    "Base de datos" estática
```

**Cluster A** corre en `us-east1` y actúa como API Gateway: recibe peticiones externas, las redirige al Cluster B y enriquece la respuesta con metadata del gateway.

**Cluster B** corre en `us-central1` y expone el microservicio interno de productos. En un entorno real estaría detrás de un Service de tipo `ClusterIP`, invisible desde Internet.

---

## Estructura del proyecto

```
gke-cluster-communication-demo/
├── cluster-a/                  # API Gateway (Express)
│   ├── src/
│   │   └── gateway.js
│   └── package.json
│
├── cluster-b/                  # Products Service (NestJS)
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── products/
│   │       ├── products.controller.ts
│   │       ├── products.service.ts
│   │       ├── products.module.ts
│   │       └── products.db.json
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

---

## Requisitos

- Node.js >= 18
- npm >= 9

---

## Correr en local

### 1. Cluster B — Products Service (NestJS) — Puerto 3001

```bash
cd cluster-b
npm install
npm run start:dev
```

### 2. Cluster A — API Gateway (Express) — Puerto 3000

En una segunda terminal:

```bash
cd cluster-a
npm install
npm start
```

---

## Endpoints

Todos los endpoints públicos pasan por el **Cluster A** (puerto 3000). Los del Cluster B (puerto 3001) son de acceso directo para pruebas locales — en producción estarían bloqueados.

### Cluster A — API Gateway

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/products` | Todos los productos |
| GET | `/api/products/:id` | Producto por ID |
| GET | `/api/products?category=electronics` | Productos filtrados por categoría |
| GET | `/health` | Health check del gateway |

### Cluster B — Acceso directo (solo local)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/products` | Todos los productos |
| GET | `/products/:id` | Producto por ID |
| GET | `/products?category=peripherals` | Filtrado por categoría |

---

## Respuestas de ejemplo

### `GET http://localhost:3000/api/products/1`

```json
{
  "gateway": {
    "cluster": "cluster-a",
    "region": "us-east1",
    "requestId": "a3f2c1d4-8b7e-4f6a-9c2d-1e0b3a4f5d6e",
    "handledAt": "2026-03-21T14:30:00.000Z"
  },
  "upstream": {
    "source": "cluster-b",
    "node": "local",
    "region": "us-central1",
    "data": {
      "id": "1",
      "name": "Laptop Pro X1",
      "price": 1299.99,
      "stock": 42,
      "category": "electronics",
      "brand": "TechCorp",
      "sku": "TC-LPX1-001"
    },
    "timestamp": "2026-03-21T14:30:00.012Z"
  }
}
```

### `GET http://localhost:3000/api/products?category=peripherals`

```json
{
  "gateway": {
    "cluster": "cluster-a",
    "region": "us-east1",
    "requestId": "b7c3d2e1-9f8a-4b5c-8d1e-2f0a3b4c5d6f",
    "handledAt": "2026-03-21T14:31:00.000Z"
  },
  "upstream": {
    "source": "cluster-b",
    "node": "local",
    "region": "us-central1",
    "category": "peripherals",
    "totalItems": 2,
    "data": [
      {
        "id": "2",
        "name": "Wireless Mouse M200",
        "price": 29.99,
        "stock": 150,
        "category": "peripherals",
        "brand": "ClickMaster",
        "sku": "CM-WM200-002"
      },
      {
        "id": "3",
        "name": "Mechanical Keyboard K80",
        "price": 89.99,
        "stock": 75,
        "category": "peripherals",
        "brand": "TypeFast",
        "sku": "TF-MK80-003"
      }
    ],
    "timestamp": "2026-03-21T14:31:00.008Z"
  }
}
```

### `GET http://localhost:3000/api/products/99` — Producto no encontrado

```json
{
  "error": "Product not found",
  "id": "99"
}
```

### `GET http://localhost:3000/health`

```json
{
  "status": "ok",
  "cluster": "cluster-a",
  "upstreamTarget": "http://localhost:3001",
  "timestamp": "2026-03-21T14:32:00.000Z"
}
```

---

## Deploy en Google Cloud Platform (GKE)

### Prerrequisitos

- Cuenta activa en Google Cloud
- `gcloud` CLI instalado o acceso a Cloud Shell
- Docker instalado (para construir las imágenes)

---

### Paso 1: Configurar región y zona

```bash
gcloud config set compute/region us-central1
gcloud config set compute/zone us-central1-c
```

---

### Paso 2: Crear los clústeres

Crear el **Cluster B** (servicio interno):

```bash
gcloud container clusters create cluster-b \
  --machine-type=e2-medium \
  --zone=us-central1-c \
  --num-nodes=2
```

Crear el **Cluster A** (API Gateway):

```bash
gcloud container clusters create cluster-a \
  --machine-type=e2-medium \
  --zone=us-east1-b \
  --num-nodes=2
```

> Cada creación puede tardar varios minutos.

---

### Paso 3: Construir y subir las imágenes a Google Container Registry

```bash
# Cluster B
cd cluster-b
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/cluster-b-products:latest .

# Cluster A
cd ../cluster-a
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/cluster-a-gateway:latest .
```

Reemplazá `YOUR_PROJECT_ID` con tu proyecto de GCP.

---

### Paso 4: Desplegar el Cluster B

Obtener credenciales del Cluster B:

```bash
gcloud container clusters get-credentials cluster-b --zone=us-central1-c
```

Crear el Deployment y el Service:

```bash
kubectl create deployment products-service \
  --image=gcr.io/YOUR_PROJECT_ID/cluster-b-products:latest

kubectl expose deployment products-service \
  --type=LoadBalancer \
  --port=3001 \
  --target-port=3001
```

Obtener la External IP del Cluster B (esperá hasta que aparezca):

```bash
kubectl get service products-service
```

Guardá esa IP — la vas a necesitar en el siguiente paso como `CLUSTER_B_IP`.

---

### Paso 5: Desplegar el Cluster A

Obtener credenciales del Cluster A:

```bash
gcloud container clusters get-credentials cluster-a --zone=us-east1-b
```

Crear el Deployment pasando la URL del Cluster B como variable de entorno:

```bash
kubectl create deployment api-gateway \
  --image=gcr.io/YOUR_PROJECT_ID/cluster-a-gateway:latest

kubectl set env deployment/api-gateway \
  CLUSTER_B_URL=http://CLUSTER_B_IP:3001

kubectl expose deployment api-gateway \
  --type=LoadBalancer \
  --port=80 \
  --target-port=3000
```

Obtener la External IP del Cluster A:

```bash
kubectl get service api-gateway
```

---

### Paso 6: Probar el deploy

Con la IP externa del Cluster A:

```bash
curl http://CLUSTER_A_IP/api/products
curl http://CLUSTER_A_IP/api/products/1
curl http://CLUSTER_A_IP/health
```

---

### Paso 7: Limpiar recursos (evitar costos)

```bash
gcloud container clusters delete cluster-a --zone=us-east1-b
gcloud container clusters delete cluster-b --zone=us-central1-c
```

---

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del Cluster A | `3000` |
| `CLUSTER_B_URL` | URL del servicio del Cluster B | `http://localhost:3001` |

---

## Conceptos clave

- **Cluster**: conjunto de nodos que ejecutan Kubernetes
- **Node**: máquina (VM) dentro del cluster
- **Deployment**: define cómo se ejecuta y escala una aplicación
- **Pod**: unidad mínima de ejecución en Kubernetes
- **Service**: expone una aplicación dentro o fuera del cluster
- **LoadBalancer**: asigna una IP pública externa al Service
- **ConfigMap / env**: mecanismo para inyectar configuración en los Pods sin hardcodear valores en el código