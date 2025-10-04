const sqlite3 = require("sqlite3").verbose()

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log("Conectado a la base de datos unificada.")
})

// Crear tabla de membresías si no existe
db.run(`CREATE TABLE IF NOT EXISTS membresias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  precio_usd REAL NOT NULL,
  duracion_dias INTEGER NOT NULL,
  descripcion TEXT
)`)

// Crear tabla de configuraciones si no existe
db.run(`CREATE TABLE IF NOT EXISTS configuraciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  fecha_actualizacion TEXT NOT NULL
)`)

// Crear tabla de empleados
db.run(`CREATE TABLE IF NOT EXISTS empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  cedula TEXT UNIQUE NOT NULL,
  telefono TEXT NOT NULL,
  direccion TEXT NOT NULL,
  email TEXT,
  cargo TEXT NOT NULL,
  tipo_jornada TEXT NOT NULL,
  sueldo_base REAL NOT NULL,
  fecha_ingreso TEXT NOT NULL,
  estatus TEXT DEFAULT 'activo',
  fecha_egreso TEXT,
  motivo_egreso TEXT,
  cuenta_bancaria TEXT,
  banco TEXT,
  fecha_registro TEXT NOT NULL
)`)

// Crear tabla de nómina
db.run(`CREATE TABLE IF NOT EXISTS nomina (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empleado_id INTEGER NOT NULL,
  periodo TEXT NOT NULL,
  año INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  dias_trabajados INTEGER NOT NULL,
  sueldo_base REAL NOT NULL,
  dias_feriados REAL DEFAULT 0,
  monto_dias_feriados REAL DEFAULT 0,
  bonos REAL DEFAULT 0,
  comisiones REAL DEFAULT 0,
  total_devengado REAL NOT NULL,
  seguro_social REAL NOT NULL,
  ley_politica_habitacional REAL NOT NULL,
  paro_forzoso REAL NOT NULL,
  total_deducciones REAL NOT NULL,
  sueldo_neto REAL NOT NULL,
  prestaciones_sociales REAL NOT NULL,
  utilidades REAL DEFAULT 0,
  vacaciones REAL NOT NULL,
  fecha_pago TEXT,
  metodo_pago TEXT,
  referencia_pago TEXT,
  observaciones_pago TEXT,
  estatus TEXT DEFAULT 'pendiente',
  observaciones TEXT,
  fecha_creacion TEXT NOT NULL,
  FOREIGN KEY (empleado_id) REFERENCES empleados(id)
)`)

// Crear tabla de prestaciones sociales
db.run(`CREATE TABLE IF NOT EXISTS prestaciones_sociales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empleado_id INTEGER NOT NULL,
  año INTEGER NOT NULL,
  sueldo_promedio REAL NOT NULL,
  dias_antiguedad INTEGER NOT NULL,
  monto_prestaciones REAL NOT NULL,
  intereses_prestaciones REAL NOT NULL,
  total_acumulado REAL NOT NULL,
  fecha_calculo TEXT NOT NULL,
  FOREIGN KEY (empleado_id) REFERENCES empleados(id)
)`)

// Crear tabla de asistencia (opcional para futuras mejoras)
db.run(`CREATE TABLE IF NOT EXISTS asistencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empleado_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  hora_entrada TEXT,
  hora_salida TEXT,
  horas_trabajadas REAL,
  observaciones TEXT,
  FOREIGN KEY (empleado_id) REFERENCES empleados(id)
)`)

// Crear tablas de inventario con códigos de lote
db.run(`CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  categoria TEXT NOT NULL,
  marca TEXT NOT NULL,
  precio_compra REAL NOT NULL,
  precio_venta REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL,
  proveedor TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_registro TEXT NOT NULL
)`)

db.run(`CREATE TABLE IF NOT EXISTS lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  codigo_lote TEXT UNIQUE NOT NULL,
  cantidad_inicial INTEGER NOT NULL,
  cantidad_disponible INTEGER NOT NULL,
  precio_compra_unitario REAL NOT NULL,
  proveedor TEXT NOT NULL,
  numero_factura TEXT,
  fecha_compra TEXT NOT NULL,
  fecha_vencimiento TEXT,
  observaciones TEXT,
  usuario_registro TEXT,
  activo INTEGER DEFAULT 1,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
)`)

db.run(`CREATE TABLE IF NOT EXISTS movimientos_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  lote_id INTEGER,
  tipo_movimiento TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario REAL,
  motivo TEXT,
  observaciones TEXT,
  fecha_movimiento TEXT NOT NULL,
  stock_anterior INTEGER NOT NULL,
  stock_nuevo INTEGER NOT NULL,
  usuario TEXT,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (lote_id) REFERENCES lotes(id)
)`)

// Crear índices para optimizar búsquedas
db.run(`CREATE INDEX IF NOT EXISTS idx_lotes_codigo ON lotes(codigo_lote)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes(producto_id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_stock(producto_id)`)

// Insertar configuración por defecto de tasa si no existe
db.run(`INSERT OR IGNORE INTO configuraciones (clave, valor, fecha_actualizacion) 
        VALUES ('tasa_dia', '36.50', datetime('now'))`)

// Insertar configuraciones para nómina
db.run(`INSERT OR IGNORE INTO configuraciones (clave, valor, fecha_actualizacion) 
        VALUES ('salario_minimo', '130.00', datetime('now'))`)

db.run(`INSERT OR IGNORE INTO configuraciones (clave, valor, fecha_actualizacion) 
        VALUES ('porcentaje_seguro_social', '4.0', datetime('now'))`)

db.run(`INSERT OR IGNORE INTO configuraciones (clave, valor, fecha_actualizacion) 
        VALUES ('porcentaje_lph', '1.0', datetime('now'))`)

db.run(`INSERT OR IGNORE INTO configuraciones (clave, valor, fecha_actualizacion) 
        VALUES ('porcentaje_paro_forzoso', '0.5', datetime('now'))`)

// Insertar membresías por defecto si no existen
db.run(`INSERT OR IGNORE INTO membresias (nombre, precio_usd, duracion_dias, descripcion) VALUES 
  ('mensual', 40.00, 30, 'Plan Mensual'),
  ('diario', 4.00, 1, 'Plan Diario'),
  ('semanal', 12.00, 7, 'Plan Semanal'),
  ('especial', 30.00, 30, 'Plan Especial'),
  ('parejas', 65.00, 30, 'Plan Parejas'),
  ('familiar', 90.00, 30, 'Plan Familiar'),
  ('estudiantil', 70.00, 30, 'Plan Estudiantil')`)

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn")

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      const confirmar = confirm("¿Estás seguro de que deseas cerrar sesión?")

      if (confirmar) {
        // Limpiar la sesión del usuario
        sessionStorage.clear()
        localStorage.clear()

        // Redirigir a la página de login
        window.location.href = "login.html"
      }
    })
  } else {
    console.error("Botón de logout no encontrado.")
  }
})
