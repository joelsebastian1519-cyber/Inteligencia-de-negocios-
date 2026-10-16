const express = require('express'), db = require('./db');
const app = express();
app.use(express.json());
app.use(express.static('public'));

const total = (v) => v.cantidad * v.precio;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const group = (arr, key) => arr.reduce((o, v) => ((o[key(v)] = (o[key(v)] || 0) + total(v)), o), {});

// Regresión lineal simple: y = a + b·x
function regresion(ys) {
  const n = ys.length, xs = ys.map((_, i) => i);
  const mx = sum(xs) / n, my = sum(ys) / n;
  const b = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / (sum(xs.map((x) => (x - mx) ** 2)) || 1);
  return { a: my - b * mx, b };
}

app.get('/api/ventas', (req, res) => res.json(db.load()));
app.post('/api/ventas', (req, res) => {
  const { fecha, producto, categoria, cantidad, precio } = req.body;
  if (!producto || !categoria || !(cantidad > 0) || !(precio > 0)) return res.status(400).json({ error: 'Datos inválidos' });
  db.add({ fecha: fecha || new Date().toISOString().slice(0, 10), producto, categoria, cantidad, precio });
  res.json({ ok: true });
});

app.get('/api/analisis', (req, res) => {
  const v = db.load();
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
