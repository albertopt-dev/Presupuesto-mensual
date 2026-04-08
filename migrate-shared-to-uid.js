// Migración: copia budgets/shared → budgets/{uid}
// 1. Asegúrate de tener serviceAccountKey.json en esta misma carpeta
// 2. node migrate-shared-to-uid.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const SOURCE_ID = 'uTxezdwCnqOrPOkRhM6My5RvK3H3'; // donde copiamos antes (incorrecto)
const TARGET_ID = 'uTxez6wCnqOrPOkRhM6My5RvK3H3'; // UID real de alber@gmail.com

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrate() {
  const sourceRef = db.collection('budgets').doc(SOURCE_ID);
  const targetRef = db.collection('budgets').doc(TARGET_ID);

  // 1. Copiar documento raíz si tiene campos
  const sourceSnap = await sourceRef.get();
  if (sourceSnap.exists) {
    const sourceData = sourceSnap.data();
    await targetRef.set({ ...sourceData, ownerId: TARGET_ID }, { merge: true });
    console.log('✅ Documento raíz copiado.');
  } else {
    console.log('ℹ️  budgets/shared no tiene campos propios, buscando subcolecciones...');
    await targetRef.set({ ownerId: TARGET_ID }, { merge: true });
  }

  // 2. Copiar subcolecciones recursivamente (incluye documentos virtuales)
  await copySubcollections(sourceRef, targetRef);
}

async function copySubcollections(sourceRef, targetRef) {
  const subcollections = await sourceRef.listCollections();
  for (const subcol of subcollections) {
    console.log(`  Copiando subcolección: ${sourceRef.path}/${subcol.id}`);
    // listDocuments incluye documentos virtuales (sin campos pero con subcolecciones)
    const docRefs = await subcol.listDocuments();
    let count = 0;
    for (const docRef of docRefs) {
      const snap = await docRef.get();
      const targetDocRef = targetRef.collection(subcol.id).doc(docRef.id);
      if (snap.exists) {
        await targetDocRef.set({ ...snap.data(), ownerId: TARGET_ID }, { merge: true });
      } else {
        // documento virtual: solo creamos el path para mantener la estructura
        await targetDocRef.set({ ownerId: TARGET_ID }, { merge: true });
      }
      count++;
      // Recursión para sub-subcolecciones (ej: months/{mes}/transactions)
      await copySubcollections(docRef, targetDocRef);
    }
    console.log(`  ✅ ${count} documentos procesados en ${subcol.id}`);
  }

  console.log('\n✅ Migración completada. Verifica que todo carga bien en la app.');
  console.log('Cuando estés seguro, puedes borrar manualmente budgets/shared desde la consola de Firebase.');
}

migrate().catch(console.error).finally(() => process.exit(0));
