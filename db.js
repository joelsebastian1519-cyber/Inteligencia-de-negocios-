const fs = require('fs'), path = require('path');
const F = path.join(__dirname, 'data.json');
function seed() {
  const p = [['Laptop','Tecnología',2400000],['Mouse','Tecnología',60000],['Silla','Oficina',450000],['Escritorio','Oficina',800000],['Cuaderno','Papelería',12000]];
  const r = [];
  for (let m = 0; m < 9; m++) for (let i = 0; i < 12; i++) {
    const x = p[Math.floor(Math.random() * p.length)];
    const d = new Date(Date.UTC(2026, m, 1 + Math.floor(Math.random() * 27)));
    r.push({ fecha: d.toISOString().slice(0, 10), producto: x[0], categoria: x[1], cantidad: 1 + Math.floor(Math.random() * (3 + m / 2)), precio: x[2] });
  }
  return r;
}
const load = () => { if (!fs.existsSync(F)) fs.writeFileSync(F, JSON.stringify(seed(), null, 1)); return JSON.parse(fs.readFileSync(F)); };
const add = (v) => { const d = load(); d.push(v); fs.writeFileSync(F, JSON.stringify(d, null, 1)); };
module.exports = { load, add };
