// Registro por consola. Uso:
//   node cli.js https://TU-APP.onrender.com   -> envía a la app en línea
//   node cli.js                               -> guarda en local
const readline = require('readline');
const API = process.argv[2] || process.env.API_URL;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

async function guardar(venta) {
  if (API) {
    const r = await fetch(API.replace(/\/$/, '') + '/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(venta),
    });
    if (!r.ok) throw new Error('El servidor respondió ' + r.status);
  } else {
    require('./db').add(venta);
  }
}

(async () => {
  console.log('=== Registro de venta ===' + (API ? ' → ' + API : ' (local)'));
  do {
    const hoy = new Date().toISOString().slice(0, 10);
    const fecha = (await ask(`Fecha (AAAA-MM-DD) [${hoy}]: `)) || hoy;
    const producto = await ask('Producto: ');
    const categoria = await ask('Categoría: ');
    const cantidad = Number(await ask('Cantidad: '));
    const precio = Number(await ask('Precio unitario: '));
    if (!producto || !categoria || !(cantidad > 0) || !(precio > 0) || isNaN(Date.parse(fecha))) {
      console.log('❌ Datos inválidos, intenta de nuevo.');
      continue;
    }
    try {
      await guardar({ fecha, producto, categoria, cantidad, precio });
      console.log('✅ Venta registrada.');
    } catch (e) {
      console.log('❌ Error al guardar:', e.message);
    }
  } while ((await ask('¿Registrar otra? (s/n): ')).toLowerCase() === 's');
  rl.close();
})();
