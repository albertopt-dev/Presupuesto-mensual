// Script de migración Firestore: añade ownerId a todos los documentos bajo budgets
// 1. Instala dependencias: npm install firebase-admin
// 2. Rellena las variables de configuración y el UID
// 3. Ejecuta: node migrate-budgets.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Descarga tu clave desde Firebase Console

// PON AQUÍ EL UID DE alber@gmail.com
const OWNER_UID = 'uTxez6wCnqOrPOkRhM6My5RvK3H3';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateBudgets() {
  const budgetsSnap = await db.collection('budgets').get();
  for (const budgetDoc of budgetsSnap.docs) {
    // Actualiza el documento principal
    await budgetDoc.ref.set({ ownerId: OWNER_UID }, { merge: true });
    // Actualiza subcolecciones (si las hay)
    const subcollections = await budgetDoc.ref.listCollections();
    for (const subcol of subcollections) {
      const subSnap = await subcol.get();
      for (const subDoc of subSnap.docs) {
        await subDoc.ref.set({ ownerId: OWNER_UID }, { merge: true });
      }
    }
  }
  console.log('Migración completada.');
}

migrateBudgets().then(() => process.exit(0));
