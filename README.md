# 💰 Presupuesto Mensual

App web para llevar el control del presupuesto doméstico. Desarrollada como proyecto personal con Next.js, Firebase y Tailwind CSS.

---

## ¿Qué hace esta app?

Permite registrar ingresos y gastos mes a mes, ver cuánto queda disponible para gastar, y hacer seguimiento del ahorro. Todo en tiempo real y sincronizado entre dispositivos.

---

## Funcionalidades principales

- **Registro de movimientos** — Añade gastos e ingresos por categoría (comida, ocio, transporte, casa...) e identifica quién lo hizo (Alba o Alberto)
- **Resumen financiero automático** — Calcula al instante cuánto entra, cuánto sale y cuánto queda disponible
- **Seguimiento del ahorro** — Define un objetivo mensual y registra el ahorro acumulado
- **Gráficas interactivas** — Visualiza la distribución de gastos con gráficas de tarta y barras
- **Múltiples meses** — Navega entre meses y consolida el ahorro al cierre de cada uno
- **PWA instalable** — Funciona como app en móvil y escritorio, incluso sin conexión

---

## Cómo arrancar el proyecto en local

**1. Clona el repositorio**
```bash
git clone https://github.com/albertopt-dev/Presupuesto-mensual.git
cd Presupuesto-mensual/presupuesto-pwa
```

**2. Instala las dependencias**
```bash
npm install
```

**3. Crea el archivo de variables de entorno**

Crea un archivo `.env.local` en la raíz con tus credenciales de Firebase:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**4. Arranca el servidor de desarrollo**
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Despliegue

La app está desplegada en **Vercel**. Cada push a `main` despliega automáticamente.

---

## Estructura del proyecto

```
presupuesto-pwa/
├── src/
│   ├── app/          # Página principal y estilos globales
│   ├── components/   # Componentes reutilizables (AuthForm, AuthGate, PersonPicker)
│   └── lib/          # Configuración de Firebase
├── public/           # Iconos y assets estáticos
├── firestore.rules   # Reglas de seguridad de Firestore
└── next.config.mjs   # Configuración de Next.js y PWA
```

---

## Notas

- Proyecto personal, no orientado a producción pública
- Los datos de cada usuario están aislados por UID (no se comparten entre cuentas)
