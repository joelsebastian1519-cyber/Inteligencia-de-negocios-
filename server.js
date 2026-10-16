const express = require('express'), db = require('./db');
const app = express();
app.use(express.json());
app.use(express.static('public'));

const total = (v) => v.cantidad * v.precio;
const sum = (a) => a.reduce((x, y) => x + y, 0);
// Unifica mayúsculas, minúsculas y tildes (tecnologia = Tecnología)
const norm = (s) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function cargar() {
  const vistos = {};
  return db.load().map((x) => {
    const r = { ...x };
    for (const campo of ['categoria', 'producto']) {
      const t = String(r[campo]).trim();
      const k = campo + norm(t);
      vistos[k] = vistos[k] || t.charAt(0).toUpperCase() + t.slice(1);
      r[campo] = vistos[k];
    }
    return r;
  });
}
const group = (arr, key) => arr.reduce((o, v) => ((o[key(v)] = (o[key(v)] || 0) + total(v)), o), {});

// Regresión lineal simple: y = a + b·x
function regresion(ys) {
  const n = ys.length, xs = ys.map((_, i) => i);
  const mx = sum(xs) / n, my = sum(ys) / n;
  const b = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / (sum(xs.map((x) => (x - mx) ** 2)) || 1);
  return { a: my - b * mx, b };
}

app.get('/api/ventas', (req, res) => res.json(cargar()));

// Valida y limpia una venta; devuelve null si es inválida
function limpiar(x) {
  const o = { fecha: String(x.fecha || '').trim() || new Date().toISOString().slice(0, 10),
    producto: String(x.producto || '').trim(), categoria: String(x.categoria || '').trim(),
    cantidad: Number(x.cantidad), precio: Number(x.precio) };
  if (!o.producto || !o.categoria || !(o.cantidad > 0) || !(o.precio > 0) || isNaN(Date.parse(o.fecha))) return null;
  return o;
}
// Acepta una venta o un arreglo de ventas (carga masiva desde CSV)
app.post('/api/ventas', (req, res) => {
  const lista = Array.isArray(req.body) ? req.body : [req.body];
  const validas = lista.map(limpiar).filter(Boolean);
  if (!validas.length) return res.status(400).json({ error: 'Datos inválidos' });
  db.addMany(validas);
  res.json({ ok: true, guardadas: validas.length, rechazadas: lista.length - validas.length });
});
app.delete('/api/ventas/:i', (req, res) => {
  db.remove(Number(req.params.i)) ? res.json({ ok: true }) : res.status(404).json({ error: 'No existe' });
});

app.get('/api/analisis', (req, res) => {
  const v = cargar();
  const mensual = group(v, (x) => x.fecha.slice(0, 7));
  const meses = Object.keys(mensual).sort();
  const vals = meses.map((m) => mensual[m]);
  const { a, b } = regresion(vals);
  const pronostico = [1, 2, 3].map((k) => {
    const [y, m] = meses[meses.length - 1].split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + k, 1));
    return { mes: d.toISOString().slice(0, 7), valor: Math.max(0, Math.round(a + b * (vals.length - 1 + k))) };
  });
  // Detección de anomalías: ventas con z-score > 2
  const t = v.map(total), mu = sum(t) / t.length, sd = Math.sqrt(sum(t.map((x) => (x - mu) ** 2)) / t.length) || 1;
  const anomalias = v.filter((x) => Math.abs((total(x) - mu) / sd) > 2).slice(-5);
  const prod = group(v, (x) => x.producto), cat = group(v, (x) => x.categoria);
  const top = Object.entries(prod).sort((x, y) => y[1] - x[1]);
  const topCat = Object.entries(cat).sort((x, y) => y[1] - x[1]);
  const n = vals.length, crec = n > 1 ? ((vals[n - 1] - vals[n - 2]) / vals[n - 2]) * 100 : 0;
  const fmt = (x) => '$' + Math.round(x).toLocaleString('es-CO');
  const insights = [
    `La tendencia general es ${b > 0 ? 'de crecimiento' : 'a la baja'} (${fmt(Math.abs(b))} por mes en promedio).`,
    `El último mes ${crec >= 0 ? 'creció' : 'cayó'} ${Math.abs(crec).toFixed(1)}% frente al anterior.`,
    `"${top[0][0]}" lidera con el ${((top[0][1] / sum(t)) * 100).toFixed(1)}% de los ingresos; la categoría fuerte es ${topCat[0][0]}.`,
    `Proyección para ${pronostico[0].mes}: ${fmt(pronostico[0].valor)}.`,
    anomalias.length ? `Se detectaron ${anomalias.length} ventas atípicas que conviene revisar.` : 'No se detectaron ventas atípicas.',
    b < 0 ? 'Recomendación: reforzar promociones o revisar precios de los productos con menor rotación.' : 'Recomendación: asegurar inventario del producto líder para sostener el crecimiento.',
  ];
  res.json({ meses, vals, pronostico, porProducto: prod, porCategoria: cat, anomalias, insights,
    kpi: { ingresos: sum(t), transacciones: v.length, ticket: mu, unidades: sum(v.map((x) => x.cantidad)) } });
});

app.listen(process.env.PORT || 3000, () => console.log('Dashboard en http://localhost:' + (process.env.PORT || 3000)));
