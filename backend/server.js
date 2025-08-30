// backend/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Datos simulados
let prestamos = [
  { 
    id: 1, 
    cliente: 'Juan Pérez', 
    monto: 500, 
    articulo: 'Reloj Rolex', 
    estado: 'Activo',
    fechaSolicitud: '2024-01-15',
    interes: 15
  },
  { 
    id: 2, 
    cliente: 'María García', 
    monto: 300, 
    articulo: 'Anillo de Oro', 
    estado: 'Pagado',
    fechaSolicitud: '2024-01-10',
    interes: 12
  },
  { 
    id: 3, 
    cliente: 'Carlos López', 
    monto: 800, 
    articulo: 'Laptop MacBook', 
    estado: 'En Mora',
    fechaSolicitud: '2024-01-05',
    interes: 18
  }
];

let nextId = 4;

// Rutas API
app.get('/api/hello', (req, res) => {
  res.json({ message: 'API del Sistema de Préstamos Pignoraticios funcionando!' });
});

// Obtener todos los préstamos
app.get('/api/prestamos', (req, res) => {
  res.json(prestamos);
});

// Obtener préstamo por ID
app.get('/api/prestamos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const prestamo = prestamos.find(p => p.id === id);
  
  if (!prestamo) {
    return res.status(404).json({ error: 'Préstamo no encontrado' });
  }
  
  res.json(prestamo);
});

// Crear nuevo préstamo
app.post('/api/prestamos', (req, res) => {
  const { cliente, monto, articulo, interes } = req.body;
  
  if (!cliente || !monto || !articulo) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }
  
  const nuevoPrestamo = {
    id: nextId++,
    cliente,
    monto: parseFloat(monto),
    articulo,
    estado: 'Activo',
    fechaSolicitud: new Date().toISOString().split('T')[0],
    interes: interes || 15
  };
  
  prestamos.push(nuevoPrestamo);
  res.status(201).json(nuevoPrestamo);
});

// Actualizar estado de préstamo
app.put('/api/prestamos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const prestamoIndex = prestamos.findIndex(p => p.id === id);
  
  if (prestamoIndex === -1) {
    return res.status(404).json({ error: 'Préstamo no encontrado' });
  }
  
  prestamos[prestamoIndex] = { ...prestamos[prestamoIndex], ...req.body };
  res.json(prestamos[prestamoIndex]);
});

// Estadísticas básicas
app.get('/api/estadisticas', (req, res) => {
  const total = prestamos.length;
  const activos = prestamos.filter(p => p.estado === 'Activo').length;
  const pagados = prestamos.filter(p => p.estado === 'Pagado').length;
  const enMora = prestamos.filter(p => p.estado === 'En Mora').length;
  const montoTotal = prestamos.reduce((sum, p) => sum + p.monto, 0);
  
  res.json({
    total,
    activos,
    pagados,
    enMora,
    montoTotal
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 API disponible en http://localhost:${PORT}/api`);
});