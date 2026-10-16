// Registro de datos por consola: npm run registrar
const readline = require('readline'), db = require('./db');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));
(async () => {
  console.log('=== Registro de venta ===');
  do {
    const hoy = new Date().toISOString().slice(0, 10);
    const fecha = (await ask(`Fecha (AAAA-MM-DD) [${hoy}]: `)) || hoy;
    const producto = await ask('Producto: ');
    const categoria = await ask('Categoría: ');
    const cantidad = Number(await ask('Cantidad: '));
    const precio = Number(await ask('Precio unitario: '));
    if (!producto || !categoria || !(cantidad > 0) || !(precio > 0) || isNaN(Date.parse(fecha))) { console.log('❌ Datos inválidos, intenta de nuevo.'); continue; }
    db.add({ fecha, producto, categoria, cantidad, precio });
    console.log('✅ Venta registrada.');
  } while ((await ask('¿Registrar otra? (s/n): ')).toLowerCase() === 's');
  rl.close();
})();
