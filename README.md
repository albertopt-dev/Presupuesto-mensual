
# Presupuesto Mensual PWA

**Presupuesto Mensual** es una aplicación web progresiva (PWA) desarrollada con Next.js y React, diseñada para la gestión colaborativa y visual del presupuesto doméstico de dos personas. Permite registrar, analizar y optimizar los gastos e ingresos mensuales, así como el ahorro, de forma sencilla, visual y desde cualquier dispositivo.

## Características principales

- **Gestión de ingresos y gastos**: Añade, clasifica y visualiza todos los movimientos mensuales, diferenciando por persona y categoría (comida, ocio, entretenimiento, gastos fijos, casa, transporte, compras, cuidado personal, etc.).
- **Ahorro mensual y acumulado**: Define objetivos de ahorro mensuales, registra ahorro programado y extra, y consolida el ahorro al final de cada mes. Visualiza el progreso y el total acumulado.
- **Análisis visual avanzado**: Gráficas interactivas (tarta y barras) para analizar la distribución y evolución de los gastos por categoría, persona y concepto. Filtros avanzados para búsquedas rápidas.
- **Resumen financiero en tiempo real**: Calcula automáticamente ingresos, gastos, ahorro y saldo disponible para gastar, mostrando alertas si el ahorro supera los ingresos o si el saldo es negativo.
- **Gestión multiusuario**: Cada usuario puede identificarse (Alba o Alberto) y sus gastos quedan marcados y diferenciados visualmente.
- **Experiencia PWA**: Instalación en escritorio y móvil, funcionamiento offline, recarga y actualización forzada de la app, iconos personalizados y soporte para notificaciones.
- **Autenticación anónima y sincronización en la nube**: Todos los datos se almacenan y sincronizan en Firebase Firestore, permitiendo acceso seguro y en tiempo real desde cualquier dispositivo.
- **Interfaz moderna y accesible**: UI responsive, accesible y optimizada para dispositivos móviles y escritorio, con diseño visual atractivo y personalización por categorías.

## Tecnologías utilizadas

- **Next.js** (React) para la estructura de la app y renderizado SSR/CSR.
- **Firebase** (Firestore y Auth) para almacenamiento en la nube y autenticación anónima.
- **Tailwind CSS** para el diseño visual y la personalización de la interfaz.
- **Recharts** para la visualización de datos y gráficas interactivas.
- **next-pwa** para convertir la app en una PWA completa.

## Flujo de usuario

1. Selecciona tu usuario (Alba o Alberto) para personalizar la experiencia y registrar tus movimientos.
2. Añade ingresos, gastos y ahorros, clasificando cada movimiento por categoría y concepto.
3. Consulta el resumen financiero, el saldo disponible y el progreso de ahorro mensual y acumulado.
4. Analiza tus gastos con gráficas y filtros avanzados para tomar mejores decisiones.
5. Consolida el ahorro al final de cada mes y actualiza el total acumulado.
6. Disfruta de la app en cualquier dispositivo, incluso sin conexión.

## Instalación y despliegue

1. Clona el repositorio y ejecuta las dependencias con tu gestor favorito (npm, yarn, pnpm, bun).
2. Configura las variables de entorno de Firebase en un archivo `.env.local`.
3. Inicia el servidor de desarrollo y accede a la app en [http://localhost:3000](http://localhost:3000).
4. Puedes instalar la app como PWA en tu dispositivo para acceso directo y uso offline.

## Licencia

Proyecto privado para uso personal/doméstico.
