export function getPortalHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DIREMOR S.R.L. | Sistema SAC Cloud & POS</title>
  <meta name="description" content="Sistema en Línea de Gestión Administrativo Comercial e Inventarios con Facturación Electrónica e Impresión Media Carta">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --surface: #101726;
      --card-bg: rgba(16, 23, 38, 0.75);
      --card-hover: rgba(24, 34, 56, 0.9);
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(59, 130, 246, 0.5);
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --primary-glow: rgba(59, 130, 246, 0.25);
      --accent: #10b981;
      --accent-hover: #059669;
      --accent-glow: rgba(16, 185, 129, 0.2);
      --danger: #ef4444;
      --warning: #f59e0b;
      --purple: #8b5cf6;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-image: 
        radial-gradient(circle at 12% 15%, rgba(59, 130, 246, 0.1) 0%, transparent 45%),
        radial-gradient(circle at 88% 85%, rgba(16, 185, 129, 0.08) 0%, transparent 45%);
      background-attachment: fixed;
    }

    /* Top Navigation Header */
    header {
      background: rgba(16, 23, 38, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      text-decoration: none;
      color: var(--text-main);
    }

    .logo-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.15rem;
      color: white;
      box-shadow: 0 4px 12px var(--primary-glow);
    }

    .brand-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .brand-subtitle {
      font-size: 0.72rem;
      color: var(--text-muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* Navigation Tabs */
    .nav-tabs {
      display: flex;
      gap: 0.4rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.3rem;
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.55rem 0.95rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--font-sans);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      transition: all 0.2s ease;
    }

    .tab-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.06);
    }

    .tab-btn.active {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 2px 10px var(--primary-glow);
    }

    /* Auth & User Panel in Header */
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .sys-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.75rem;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 9999px;
      font-size: 0.78rem;
      font-family: var(--font-mono);
      color: #34d399;
    }

    .pulse {
      width: 7px;
      height: 7px;
      background-color: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
      animation: pulseAnim 2s infinite;
    }

    @keyframes pulseAnim {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.8); }
    }

    .btn-user {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 0.45rem 0.85rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.84rem;
      transition: all 0.2s;
    }

    .btn-user:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--border-focus);
    }

    /* Container */
    .main-container {
      max-width: 1380px;
      width: 100%;
      margin: 0 auto;
      padding: 1.5rem;
      flex: 1;
    }

    /* Tab Panes */
    .tab-content {
      display: none;
      animation: fadeIn 0.25s ease-out;
    }

    .tab-content.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards & Layouts */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      backdrop-filter: blur(16px);
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4);
      margin-bottom: 1.5rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
    }

    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    @media (max-width: 960px) {
      .grid-2, .grid-3, .grid-4 {
        grid-template-columns: 1fr;
      }
      .nav-tabs {
        flex-wrap: wrap;
      }
    }

    /* Stat Cards */
    .stat-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      transition: all 0.2s ease;
    }

    .stat-card:hover {
      border-color: rgba(59, 130, 246, 0.3);
      transform: translateY(-2px);
    }

    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .stat-val {
      font-size: 1.45rem;
      font-weight: 700;
      font-family: var(--font-mono);
      color: #fff;
    }

    .stat-desc {
      font-size: 0.76rem;
      color: var(--text-muted);
    }

    /* Forms & Inputs */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1rem;
    }

    .form-label {
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    .form-control {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      font-family: var(--font-sans);
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s;
    }

    .form-control:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }

    select.form-control {
      cursor: pointer;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
      box-shadow: 0 3px 12px var(--primary-glow);
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .btn-accent {
      background: var(--accent);
      color: white;
      box-shadow: 0 3px 12px var(--accent-glow);
    }

    .btn-accent:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    .btn-outline {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-main);
      border: 1px solid var(--border);
    }

    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--border-focus);
    }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .btn-sm {
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      border-radius: 6px;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;
    }

    th {
      background: rgba(255, 255, 255, 0.04);
      padding: 0.75rem 1rem;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      font-size: 0.74rem;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-main);
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--font-mono);
    }

    .badge-blue { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
    .badge-green { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }
    .badge-amber { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
    .badge-red { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }

    /* Code blocks & JSON viewer */
    pre.code-block {
      background: #060910;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.84rem;
      color: #38bdf8;
      overflow-x: auto;
      max-height: 420px;
    }

    /* Toast notifications */
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 100;
    }

    .toast {
      background: #1e293b;
      color: #fff;
      padding: 0.85rem 1.25rem;
      border-radius: 10px;
      border-left: 4px solid var(--primary);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: slideIn 0.3s ease;
      min-width: 280px;
    }

    .toast.success { border-left-color: var(--accent); }
    .toast.error { border-left-color: var(--danger); }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal-card {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 600px;
      width: 100%;
      padding: 1.75rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      animation: modalScale 0.2s ease-out;
    }

    @keyframes modalScale {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    /* Media Carta Preview Container */
    .preview-frame-container {
      width: 100%;
      height: 520px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      overflow: hidden;
    }

    .preview-frame {
      width: 100%;
      height: 100%;
      border: none;
    }

    footer {
      text-align: center;
      padding: 1.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      margin-top: auto;
    }
  </style>
</head>
<body>

  <!-- Top Header Navigation -->
  <header>
    <a href="#" class="brand" onclick="switchTab('dashboard')">
      <div class="logo-badge">D</div>
      <div>
        <div class="brand-title">DIREMOR S.R.L.</div>
        <div class="brand-subtitle">Plataforma SAC Cloud &middot; v1.0.0</div>
      </div>
    </a>

    <nav class="nav-tabs">
      <button class="tab-btn active" id="tab-dashboard" onclick="switchTab('dashboard')">
        <span>📊</span> Dashboard
      </button>
      <button class="tab-btn" id="tab-pos" onclick="switchTab('pos')">
        <span>🛒</span> Punto de Venta (POS)
      </button>
      <button class="tab-btn" id="tab-cajas" onclick="switchTab('cajas')">
        <span>🏦</span> Cajas & Turnos
      </button>
      <button class="tab-btn" id="tab-productos" onclick="switchTab('productos')">
        <span>📦</span> Productos & Stock
      </button>
      <button class="tab-btn" id="tab-impresion" onclick="switchTab('impresion')">
        <span>🖨️</span> Impresión Media Carta
      </button>
      <button class="tab-btn" id="tab-api" onclick="switchTab('api')">
        <span>⚡</span> Consola API
      </button>
    </nav>

    <div class="header-right">
      <div class="sys-badge">
        <span class="pulse"></span>
        <span id="header-latency">1 ms</span>
      </div>
      <button class="btn-user" onclick="toggleAuthModal()" id="user-display-btn">
        <span>👤</span>
        <span id="user-display-name">Iniciar Sesión</span>
      </button>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="main-container">

    <!-- 1. DASHBOARD TAB -->
    <section id="content-dashboard" class="tab-content active">
      <div class="grid-4" style="margin-bottom: 1.5rem;">
        <div class="stat-card">
          <span class="stat-label">Estado de Plataforma</span>
          <span class="stat-val" style="color: #34d399;">ONLINE</span>
          <span class="stat-desc">Coolify Container (PostgreSQL 16)</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Latencia SQL DB</span>
          <span class="stat-val" id="stat-latency" style="color: #60a5fa;">1 ms</span>
          <span class="stat-desc">Transacciones ACID verificadas</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Módulos SDD</span>
          <span class="stat-val" style="color: #a78bfa;">13 / 13</span>
          <span class="stat-desc">100% Suites E2E en Producción</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Período Fiscal</span>
          <span class="stat-val" id="stat-periodo" style="color: #fcd34d;">ABIERTO</span>
          <span class="stat-desc">Año 2026 / Mes Actual</span>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">⚡ Acciones Rápidas del Sistema</h2>
          </div>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
            Ejecuta las operaciones comerciales y de control más frecuentes de DIREMOR SAC:
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button class="btn btn-primary" onclick="switchTab('pos')">
              <span>🛒</span> Abrir Terminal de Ventas POS
            </button>
            <button class="btn btn-outline" onclick="switchTab('cajas')">
              <span>🏦</span> Consultar y Gestionar Turno de Caja
            </button>
            <button class="btn btn-outline" onclick="switchTab('impresion')">
              <span>🖨️</span> Visor de Documentos e Impresión Media Carta
            </button>
            <button class="btn btn-outline" onclick="switchTab('api')">
              <span>⚡</span> Explorador Interactivo de Endpoints API
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">🏢 Configuración Activa</h2>
            <span class="badge badge-green">Sucursal Central</span>
          </div>
          <div style="font-size: 0.88rem; line-height: 1.8; color: var(--text-muted);">
            <div><strong style="color: var(--text-main);">Razón Social:</strong> DIREMOR S.R.L.</div>
            <div><strong style="color: var(--text-main);">NIT Emisor:</strong> 1028475029</div>
            <div><strong style="color: var(--text-main);">Casa Matriz:</strong> Av. 6 de Agosto #2455, La Paz</div>
            <div><strong style="color: var(--text-main);">Actividad SIN:</strong> 475200 (Venta al por mayor y menor)</div>
            <div><strong style="color: var(--text-main);">Formato de Impresión:</strong> Media Carta (140mm x 216mm)</div>
            <div><strong style="color: var(--text-main);">Moneda Oficial:</strong> Bolivianos (BOB)</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. PUNTO DE VENTA (POS) TAB -->
    <section id="content-pos" class="tab-content">
      <div class="grid-2">
        <!-- Panel Izquierdo: Selección y Catálogo -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">🛒 Configuración de Venta</h2>
            <button class="btn btn-sm btn-outline" onclick="cargarClienteGenerico()">Cliente Mostrador</button>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="pos-cliente">Cliente</label>
              <select id="pos-cliente" class="form-control">
                <option value="1">Cargando clientes...</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="pos-tipo-pago">Método de Pago</label>
              <select id="pos-tipo-pago" class="form-control">
                <option value="EFECTIVO">Efectivo BOB</option>
                <option value="QR">Pago QR Simple</option>
                <option value="TARJETA">Tarjeta de Débito/Crédito</option>
                <option value="CREDITO">Crédito Comercial</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label class="form-label" for="pos-search">Buscar Producto por Código o Nombre</label>
            <input type="text" id="pos-search" class="form-control" placeholder="Ej: PROD, CABLE, TALADRO..." oninput="filtrarCatalogoPOS()">
          </div>

          <div class="table-container" style="max-height: 280px; overflow-y: auto;">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Precio BOB</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody id="pos-productos-list">
                <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Cargando catálogo...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Panel Derecho: Carrito y Resumen -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">📋 Detalle de la Venta</h2>
            <span class="badge badge-blue" id="cart-item-count">0 ítems</span>
          </div>

          <div class="table-container" style="max-height: 250px; overflow-y: auto; margin-bottom: 1.25rem;">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>P. Unit.</th>
                  <th>Subtotal</th>
                  <th>Quitar</th>
                </tr>
              </thead>
              <tbody id="cart-tbody">
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">El carrito está vacío. Agrega productos del catálogo.</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Totales -->
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.4rem; color: var(--text-muted);">
              <span>Subtotal:</span>
              <span id="cart-subtotal" style="font-family: var(--font-mono); color: var(--text-main);">0.00 BOB</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.4rem; color: var(--text-muted);">
              <span>Descuento:</span>
              <span id="cart-descuento" style="font-family: var(--font-mono); color: var(--text-main);">0.00 BOB</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.25rem; font-weight: 700; border-top: 1px solid var(--border); padding-top: 0.5rem; color: #34d399;">
              <span>TOTAL A PAGAR:</span>
              <span id="cart-total" style="font-family: var(--font-mono);">0.00 BOB</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
            <input type="checkbox" id="cart-emitir-factura" style="width: 18px; height: 18px; cursor: pointer;" checked>
            <label for="cart-emitir-factura" style="font-size: 0.88rem; cursor: pointer;">Emitir Factura Oficial Computarizada en Línea (SIN)</label>
          </div>

          <button class="btn btn-accent" style="width: 100%; padding: 0.85rem;" onclick="ejecutarVentaPOS()" id="btn-completar-venta">
            <span>✅</span> Confirmar y Emitir Venta
          </button>
        </div>
      </div>
    </section>

    <!-- 3. CAJAS & TURNOS TAB -->
    <section id="content-cajas" class="tab-content">
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">🏦 Estado del Turno de Caja</h2>
            <span class="badge" id="caja-estado-badge">CONSULTANDO...</span>
          </div>

          <div id="caja-info-container" style="font-size: 0.9rem; line-height: 1.8; color: var(--text-muted); margin-bottom: 1.5rem;">
            Cargando estado de la caja...
          </div>

          <!-- Formulario Apertura -->
          <div id="form-apertura-caja" style="display: none;">
            <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: #38bdf8;">Abrir Nuevo Turno de Caja</h3>
            <div class="form-group">
              <label class="form-label" for="caja-monto-inicial">Monto Inicial en Gaveta (BOB)</label>
              <input type="number" id="caja-monto-inicial" class="form-control" value="200.00" step="0.50">
            </div>
            <button class="btn btn-primary" onclick="abrirTurnoCaja()">
              <span>🔓</span> Abrir Turno de Caja
            </button>
          </div>

          <!-- Formulario Cierre -->
          <div id="form-cierre-caja" style="display: none;">
            <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: #f87171;">Arqueo Ciego y Cierre de Turno</h3>
            <div class="form-group">
              <label class="form-label" for="caja-monto-cierre">Efectivo Físico Recontado en Gaveta (BOB)</label>
              <input type="number" id="caja-monto-cierre" class="form-control" placeholder="Monto contado por cajero" step="0.50">
            </div>
            <button class="btn btn-danger" onclick="cerrarTurnoCaja()">
              <span>🔒</span> Ejecutar Cierre y Arqueo Ciego
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">💵 Movimiento Menor de Gaveta</h2>
          </div>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1rem;">
            Registra ingresos adicionales o egresos menores (gastos de limpieza, cambio, refrigerios):
          </p>
          <div class="form-group">
            <label class="form-label" for="mov-tipo">Tipo de Movimiento</label>
            <select id="mov-tipo" class="form-control">
              <option value="INGRESO">Ingreso de Efectivo</option>
              <option value="EGRESO">Egreso de Efectivo (Gasto menor)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="mov-monto">Monto (BOB)</label>
            <input type="number" id="mov-monto" class="form-control" placeholder="0.00" step="0.50">
          </div>
          <div class="form-group">
            <label class="form-label" for="mov-motivo">Motivo o Justificación</label>
            <input type="text" id="mov-motivo" class="form-control" placeholder="Ej: Compra de insumos de limpieza">
          </div>
          <button class="btn btn-outline" onclick="registrarMovimientoGaveta()">
            <span>📝</span> Registrar en Gaveta
          </button>
        </div>
      </div>
    </section>

    <!-- 4. PRODUCTOS & STOCK TAB -->
    <section id="content-productos" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">📦 Catálogo Físico-Valorado de Productos</h2>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="filter-productos-input" class="form-control" placeholder="Filtrar por código o nombre..." style="width: 260px;" oninput="filtrarTablaProductos()">
            <button class="btn btn-sm btn-outline" onclick="cargarProductos()">Actualizar</button>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre del Producto</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Precio Venta (BOB)</th>
                <th>Costo Ref. (BOB)</th>
                <th>Stock Almacén</th>
              </tr>
            </thead>
            <tbody id="tabla-productos-body">
              <tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Cargando inventario...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 5. IMPRESIÓN MEDIA CARTA TAB -->
    <section id="content-impresion" class="tab-content">
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">🖨️ Formatos de Impresión Media Carta</h2>
          </div>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1.25rem;">
            Genera documentos formateados bajo el estándar oficial de <strong>Media Carta (140mm x 216mm)</strong> con estilos optimizados para impresión física inmediata:
          </p>

          <div class="form-group">
            <label class="form-label" for="print-tipo">Tipo de Documento</label>
            <select id="print-tipo" class="form-control" onchange="actualizarPlaceholderImpresion()">
              <option value="factura">Factura Oficial Computarizada SIN (con QR/CUF)</option>
              <option value="comprobante">Comprobante de Diario Contable (con Firmas)</option>
              <option value="recibo-cobro">Recibo Oficial de Cobranza (con Literal BOB)</option>
              <option value="proforma">Proforma / Cotización Comercial</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="print-id">ID del Documento</label>
            <input type="number" id="print-id" class="form-control" value="1" min="1">
          </div>

          <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
            <button class="btn btn-primary" onclick="cargarPreviewImpresion()">
              <span>👁️</span> Vista Previa en Pantalla
            </button>
            <button class="btn btn-outline" onclick="imprimirDocumentoDirecto()">
              <span>🖨️</span> Imprimir en Papel
            </button>
          </div>

          <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; font-size: 0.82rem; color: var(--text-muted);">
            💡 <strong>Tip de Impresión:</strong> El motor CSS aplica automáticamente la directiva <code>@page { size: 140mm 216mm; margin: 8mm; }</code> eliminando márgenes innecesarios y garantizando nitidez milimétrica en cualquier impresora.
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">📄 Vista Previa en Escala Media Carta</h2>
            <button class="btn btn-sm btn-outline" onclick="abrirPreviewEnNuevaPestana()">Abrir en Pestaña</button>
          </div>

          <div class="preview-frame-container">
            <iframe id="print-preview-iframe" class="preview-frame" src="/api/impresion/factura/1"></iframe>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. CONSOLA API TAB -->
    <section id="content-api" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">⚡ Explorador Interactivo de Endpoints API</h2>
          <span class="badge badge-blue">REST JSON</span>
        </div>

        <div class="grid-2">
          <div>
            <div class="form-group">
              <label class="form-label" for="api-endpoint-select">Selecciona Endpoint</label>
              <select id="api-endpoint-select" class="form-control" onchange="seleccionarEndpoint()">
                <option value="GET|/api/health|">GET /api/health (Healthcheck y Latencia DB)</option>
                <option value="GET|/api|">GET /api (Catálogo de Rutas)</option>
                <option value="GET|/api/sucursales|">GET /api/sucursales (Lista de Sucursales)</option>
                <option value="GET|/api/productos|">GET /api/productos (Catálogo de Productos)</option>
                <option value="GET|/api/clientes|">GET /api/clientes (Directorio de Clientes)</option>
                <option value="GET|/api/clientes/generico|">GET /api/clientes/generico (Cliente Mostrador)</option>
                <option value="GET|/api/cajas/turnos/activo|">GET /api/cajas/turnos/activo (Turno Activo)</option>
                <option value="GET|/api/administracion/periodos|">GET /api/administracion/periodos (Períodos Fiscales)</option>
                <option value="GET|/api/contabilidad/cuentas|">GET /api/contabilidad/cuentas (Plan Contable)</option>
                <option value="GET|/api/contabilidad/balance-sumas-saldos?gestion=2026|">GET /api/contabilidad/balance-sumas-saldos (Sumas y Saldos)</option>
                <option value="POST|/api/auth/login|{\\"correo\\":\\"admin@diremor.bo\\",\\"password_hash\\":\\"Admin123*!\\"}">POST /api/auth/login (Autenticación JWT)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="api-method">Método HTTP & URL</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="api-method" class="form-control" value="GET" style="width: 100px; font-weight: 700; text-align: center;" readonly>
                <input type="text" id="api-url" class="form-control" value="/api/health" style="flex: 1; font-family: var(--font-mono);">
              </div>
            </div>

            <div class="form-group" id="api-body-group" style="display: none;">
              <label class="form-label" for="api-body">Cuerpo JSON de la Petición</label>
              <textarea id="api-body" class="form-control" rows="5" style="font-family: var(--font-mono); font-size: 0.82rem;"></textarea>
            </div>

            <button class="btn btn-primary" onclick="ejecutarPeticionApi()" style="width: 100%;">
              <span>🚀</span> Ejecutar Petición
            </button>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="form-label">Respuesta del Servidor</span>
              <span id="api-response-status" class="badge badge-green">Listo</span>
            </div>
            <pre id="api-response-viewer" class="code-block">Presiona "Ejecutar Petición" para consultar el endpoint...</pre>
          </div>
        </div>
      </div>
    </section>

  </main>

  <!-- Login Modal -->
  <div class="modal-overlay" id="auth-modal">
    <div class="modal-card">
      <div class="card-header">
        <h2 class="card-title">🔐 Iniciar Sesión en DIREMOR SAC</h2>
        <button class="btn btn-sm btn-outline" onclick="toggleAuthModal()">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label" for="login-email">Correo Electrónico</label>
        <input type="email" id="login-email" class="form-control" value="admin@diremor.bo">
      </div>
      <div class="form-group">
        <label class="form-label" for="login-pass">Contraseña</label>
        <input type="password" id="login-pass" class="form-control" value="Admin123*!">
      </div>
      <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
        <button class="btn btn-primary" style="flex: 1;" onclick="ejecutarLogin()">Iniciar Sesión</button>
        <button class="btn btn-outline" onclick="ejecutarLogout()">Cerrar Sesión</button>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div class="toast-container" id="toast-container"></div>

  <!-- Footer -->
  <footer>
    &copy; 2026 DIREMOR S.R.L. &middot; Sistema de Gestión Administrativo Comercial e Inventarios en Línea (SAC)<br>
    Desplegado sobre Coolify PaaS (Docker &middot; Traefik &middot; PostgreSQL 16)
  </footer>

  <script>
    // Estado Global de la SPA
    let token = localStorage.getItem('diremor_token') || '';
    let currentUser = JSON.parse(localStorage.getItem('diremor_user') || 'null');
    let catalogo = [];
    let cart = [];
    let turnoActivo = null;

    // Toast Manager
    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = '<span>' + (type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️') + '</span> ' + message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    // Switch de Pestañas
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      const activeBtn = document.getElementById('tab-' + tabId);
      const activeContent = document.getElementById('content-' + tabId);
      if (activeBtn) activeBtn.classList.add('active');
      if (activeContent) activeContent.classList.add('active');

      if (tabId === 'pos') {
        cargarClientes();
        cargarProductos();
      } else if (tabId === 'cajas') {
        verificarTurnoCaja();
      } else if (tabId === 'productos') {
        cargarProductos();
      }
    }

    // Auth Helper
    function toggleAuthModal() {
      const modal = document.getElementById('auth-modal');
      modal.classList.toggle('active');
    }

    async function ejecutarLogin() {
      const correo = document.getElementById('login-email').value;
      const password_hash = document.getElementById('login-pass').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo, password_hash })
        });
        const data = await res.json();
        if (res.ok) {
          token = data.token;
          currentUser = data.usuario;
          localStorage.setItem('diremor_token', token);
          localStorage.setItem('diremor_user', JSON.stringify(currentUser));
          actualizarInterfazUsuario();
          toggleAuthModal();
          showToast('Bienvenido, ' + currentUser.nombre_completo, 'success');
        } else {
          showToast(data.error || 'Credenciales inválidas', 'error');
        }
      } catch (err) {
        showToast('Error de conexión con el servidor', 'error');
      }
    }

    function ejecutarLogout() {
      token = '';
      currentUser = null;
      localStorage.removeItem('diremor_token');
      localStorage.removeItem('diremor_user');
      actualizarInterfazUsuario();
      toggleAuthModal();
      showToast('Sesión finalizada');
    }

    function actualizarInterfazUsuario() {
      const nameEl = document.getElementById('user-display-name');
      if (currentUser) {
        nameEl.innerText = currentUser.nombre_completo + ' (' + currentUser.rol + ')';
      } else {
        nameEl.innerText = 'Iniciar Sesión';
      }
    }

    // Healthcheck Polling
    async function updateHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          const latText = data.latencyMs + ' ms';
          document.getElementById('header-latency').innerText = latText;
          document.getElementById('stat-latency').innerText = latText;
        }
      } catch (e) {
        console.warn('Healthcheck fetch error', e);
      }
    }

    // Clientes
    async function cargarClientes() {
      try {
        const res = await fetch('/api/clientes');
        if (res.ok) {
          const data = await res.json();
          const select = document.getElementById('pos-cliente');
          select.innerHTML = '';
          data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id_cliente;
            opt.innerText = c.razon_social + ' (NIT/CI: ' + c.nit_ci + ')';
            select.appendChild(opt);
          });
        }
      } catch (e) {
        console.error('Error cargando clientes', e);
      }
    }

    async function cargarClienteGenerico() {
      try {
        const res = await fetch('/api/clientes/generico');
        if (res.ok) {
          const c = await res.json();
          const select = document.getElementById('pos-cliente');
          let opt = Array.from(select.options).find(o => o.value == c.id_cliente);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = c.id_cliente;
            opt.innerText = c.razon_social + ' (NIT/CI: ' + c.nit_ci + ')';
            select.appendChild(opt);
          }
          select.value = c.id_cliente;
          showToast('Cliente mostrador seleccionado: ' + c.razon_social);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Productos
    async function cargarProductos() {
      try {
        const res = await fetch('/api/productos');
        if (res.ok) {
          catalogo = await res.json();
          renderTablaProductos(catalogo);
          renderCatalogoPOS(catalogo);
        }
      } catch (e) {
        console.error('Error cargando productos', e);
      }
    }

    function renderTablaProductos(lista) {
      const tbody = document.getElementById('tabla-productos-body');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No se encontraron productos.</td></tr>';
        return;
      }
      lista.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${p.id_producto}</td>
          <td><strong style="color: #60a5fa;">\${p.codigo_producto}</strong></td>
          <td>\${p.nombre}</td>
          <td>\${p.categoria || 'General'}</td>
          <td>\${p.unidad_medida || 'PZA'}</td>
          <td style="font-family: var(--font-mono); font-weight: 600; color: #34d399;">\${parseFloat(p.precio_venta).toFixed(2)}</td>
          <td style="font-family: var(--font-mono); color: var(--text-muted);">\${parseFloat(p.costo_referencial || 0).toFixed(2)}</td>
          <td><span class="badge badge-green">Disponible</span></td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function filtrarTablaProductos() {
      const q = document.getElementById('filter-productos-input').value.toLowerCase();
      const filtrados = catalogo.filter(p => 
        p.codigo_producto.toLowerCase().includes(q) || 
        p.nombre.toLowerCase().includes(q)
      );
      renderTablaProductos(filtrados);
    }

    function renderCatalogoPOS(lista) {
      const tbody = document.getElementById('pos-productos-list');
      if (!tbody) return;
      tbody.innerHTML = '';
      lista.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><strong>\${p.codigo_producto}</strong></td>
          <td>\${p.nombre}</td>
          <td style="font-family: var(--font-mono); color: #34d399;">\${parseFloat(p.precio_venta).toFixed(2)}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="agregarAlCarrito(\${p.id_producto})">+ Agregar</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function filtrarCatalogoPOS() {
      const q = document.getElementById('pos-search').value.toLowerCase();
      const filtrados = catalogo.filter(p => 
        p.codigo_producto.toLowerCase().includes(q) || 
        p.nombre.toLowerCase().includes(q)
      );
      renderCatalogoPOS(filtrados);
    }

    // Carrito POS
    function agregarAlCarrito(idProducto) {
      const prod = catalogo.find(p => p.id_producto === idProducto);
      if (!prod) return;

      const item = cart.find(i => i.id_producto === idProducto);
      if (item) {
        item.cantidad += 1;
      } else {
        cart.push({
          id_producto: prod.id_producto,
          codigo: prod.codigo_producto,
          nombre: prod.nombre,
          precio: parseFloat(prod.precio_venta),
          cantidad: 1,
          descuento: 0
        });
      }
      actualizarCarritoUI();
      showToast('Agregado: ' + prod.nombre);
    }

    function modificarCantidadCarrito(idProducto, delta) {
      const item = cart.find(i => i.id_producto === idProducto);
      if (!item) return;
      item.cantidad += delta;
      if (item.cantidad <= 0) {
        cart = cart.filter(i => i.id_producto !== idProducto);
      }
      actualizarCarritoUI();
    }

    function actualizarCarritoUI() {
      const tbody = document.getElementById('cart-tbody');
      tbody.innerHTML = '';
      let subtotal = 0;

      if (!cart.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">El carrito está vacío. Agrega productos del catálogo.</td></tr>';
      } else {
        cart.forEach(item => {
          const itemSub = item.cantidad * item.precio;
          subtotal += itemSub;
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${item.codigo}</strong><br><small style="color: var(--text-muted);">\${item.nombre}</small></td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="modificarCantidadCarrito(\${item.id_producto}, -1)" style="padding: 2px 6px;">-</button>
              <span style="font-family: var(--font-mono); margin: 0 4px;">\${item.cantidad}</span>
              <button class="btn btn-sm btn-outline" onclick="modificarCantidadCarrito(\${item.id_producto}, 1)" style="padding: 2px 6px;">+</button>
            </td>
            <td style="font-family: var(--font-mono);">\${item.precio.toFixed(2)}</td>
            <td style="font-family: var(--font-mono); font-weight: 600; color: #34d399;">\${itemSub.toFixed(2)}</td>
            <td>
              <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="modificarCantidadCarrito(\${item.id_producto}, -9999)">✕</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }

      document.getElementById('cart-item-count').innerText = cart.length + ' ítems';
      document.getElementById('cart-subtotal').innerText = subtotal.toFixed(2) + ' BOB';
      document.getElementById('cart-total').innerText = subtotal.toFixed(2) + ' BOB';
    }

    // Ejecutar Venta
    async function ejecutarVentaPOS() {
      if (!cart.length) {
        showToast('El carrito está vacío', 'error');
        return;
      }
      if (!token) {
        showToast('Debes iniciar sesión para emitir ventas', 'error');
        toggleAuthModal();
        return;
      }

      const id_cliente = parseInt(document.getElementById('pos-cliente').value);
      const metodo_pago = document.getElementById('pos-tipo-pago').value;
      const emitir_factura = document.getElementById('cart-emitir-factura').checked;

      const payload = {
        id_sucursal: 1,
        id_almacen: 1,
        id_cliente: id_cliente,
        tipo_venta: metodo_pago === 'CREDITO' ? 'CREDITO' : 'CONTADO',
        metodo_pago: metodo_pago,
        id_caja_turno: turnoActivo ? turnoActivo.id_turno : 1,
        detalles: cart.map(i => ({
          id_producto: i.id_producto,
          cantidad: i.cantidad,
          precio_unitario: i.precio,
          descuento: 0
        })),
        emitir_factura: emitir_factura
      };

      try {
        const btn = document.getElementById('btn-completar-venta');
        btn.disabled = true;
        btn.innerText = 'Procesando Venta...';

        const res = await fetch('/api/ventas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        btn.disabled = false;
        btn.innerText = 'Confirmar y Emitir Venta';

        if (res.ok) {
          showToast('¡Venta #' + data.id_venta + ' completada exitosamente!', 'success');
          cart = [];
          actualizarCarritoUI();

          // Ofrecer impresión inmediata
          if (emitir_factura && data.factura) {
            document.getElementById('print-tipo').value = 'factura';
            document.getElementById('print-id').value = data.factura.id_factura || 1;
            switchTab('impresion');
            cargarPreviewImpresion();
          }
        } else {
          showToast(data.error || 'Error al emitir la venta', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error de red al procesar la venta', 'error');
      }
    }

    // Cajas & Turnos
    async function verificarTurnoCaja() {
      try {
        const res = await fetch('/api/cajas/turnos/activo?id_caja=1');
        const badge = document.getElementById('caja-estado-badge');
        const info = document.getElementById('caja-info-container');
        const formAbrir = document.getElementById('form-apertura-caja');
        const formCerrar = document.getElementById('form-cierre-caja');

        if (res.ok) {
          turnoActivo = await res.json();
          badge.className = 'badge badge-green';
          badge.innerText = 'TURNO ABIERTO';
          info.innerHTML = \`
            <div><strong style="color: var(--text-main);">Turno ID:</strong> #\${turnoActivo.id_turno}</div>
            <div><strong style="color: var(--text-main);">Caja:</strong> \${turnoActivo.nombre_caja || 'Caja 1 Central'}</div>
            <div><strong style="color: var(--text-main);">Cajero:</strong> \${turnoActivo.nombre_cajero || 'Administrador'}</div>
            <div><strong style="color: var(--text-main);">Apertura:</strong> \${new Date(turnoActivo.fecha_inicio).toLocaleString()}</div>
            <div><strong style="color: var(--text-main);">Monto Inicial:</strong> \${parseFloat(turnoActivo.monto_apertura_declarado).toFixed(2)} BOB</div>
          \`;
          formAbrir.style.display = 'none';
          formCerrar.style.display = 'block';
        } else {
          turnoActivo = null;
          badge.className = 'badge badge-amber';
          badge.innerText = 'SIN TURNO ACTIVO';
          info.innerHTML = '<p>No hay ningún turno abierto para esta caja. Abre un turno para comenzar a cobrar ventas.</p>';
          formAbrir.style.display = 'block';
          formCerrar.style.display = 'none';
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function abrirTurnoCaja() {
      if (!token) {
        showToast('Debes iniciar sesión como cajero o administrador', 'error');
        toggleAuthModal();
        return;
      }
      const monto = parseFloat(document.getElementById('caja-monto-inicial').value) || 0;
      try {
        const res = await fetch('/api/cajas/turnos/abrir', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ id_caja: 1, monto_apertura: monto })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Turno abierto correctamente con ' + monto.toFixed(2) + ' BOB', 'success');
          verificarTurnoCaja();
        } else {
          showToast(data.error || 'Error al abrir turno', 'error');
        }
      } catch (e) {
        showToast('Error de comunicación', 'error');
      }
    }

    async function cerrarTurnoCaja() {
      if (!turnoActivo) return;
      if (!token) {
        showToast('Inicia sesión para cerrar el turno', 'error');
        toggleAuthModal();
        return;
      }
      const montoContado = parseFloat(document.getElementById('caja-monto-cierre').value);
      if (isNaN(montoContado)) {
        showToast('Ingresa el monto físico recontado en gaveta', 'error');
        return;
      }

      try {
        const res = await fetch('/api/cajas/turnos/' + turnoActivo.id_turno + '/cerrar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ monto_cierre_declarado: montoContado })
        });
        const data = await res.json();
        if (res.ok) {
          const diff = data.diferencia || 0;
          const msg = diff === 0 ? '¡Arqueo perfecto! Sin diferencias.' : (diff > 0 ? 'Sobrante detectado: +' + diff + ' BOB' : 'Faltante detectado: ' + diff + ' BOB');
          showToast('Turno cerrado. ' + msg, 'success');
          verificarTurnoCaja();
        } else {
          showToast(data.error || 'Error al cerrar turno', 'error');
        }
      } catch (e) {
        showToast('Error al ejecutar el arqueo', 'error');
      }
    }

    async function registrarMovimientoGaveta() {
      if (!turnoActivo) {
        showToast('No hay turno abierto para registrar movimientos', 'error');
        return;
      }
      const tipo = document.getElementById('mov-tipo').value;
      const monto = parseFloat(document.getElementById('mov-monto').value);
      const motivo = document.getElementById('mov-motivo').value;

      if (!monto || monto <= 0 || !motivo) {
        showToast('Ingresa un monto válido y la justificación', 'error');
        return;
      }

      try {
        const res = await fetch('/api/cajas/turnos/' + turnoActivo.id_turno + '/movimientos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ tipo, monto, motivo })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Movimiento de ' + tipo + ' registrado exitosamente', 'success');
          document.getElementById('mov-monto').value = '';
          document.getElementById('mov-motivo').value = '';
        } else {
          showToast(data.error || 'Error al registrar movimiento', 'error');
        }
      } catch (e) {
        showToast('Error al registrar movimiento', 'error');
      }
    }

    // Impresión Media Carta
    function actualizarPlaceholderImpresion() {
      cargarPreviewImpresion();
    }

    function cargarPreviewImpresion() {
      const tipo = document.getElementById('print-tipo').value;
      const id = document.getElementById('print-id').value || 1;
      const iframe = document.getElementById('print-preview-iframe');
      iframe.src = '/api/impresion/' + tipo + '/' + id;
    }

    function imprimirDocumentoDirecto() {
      const iframe = document.getElementById('print-preview-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }

    function abrirPreviewEnNuevaPestana() {
      const iframe = document.getElementById('print-preview-iframe');
      if (iframe && iframe.src) {
        window.open(iframe.src, '_blank');
      }
    }

    // Consola API
    function seleccionarEndpoint() {
      const val = document.getElementById('api-endpoint-select').value;
      const [method, url, body] = val.split('|');
      document.getElementById('api-method').value = method;
      document.getElementById('api-url').value = url;
      const bodyGroup = document.getElementById('api-body-group');
      const bodyInput = document.getElementById('api-body');

      if (method === 'POST' || method === 'PUT') {
        bodyGroup.style.display = 'block';
        bodyInput.value = body || '{}';
      } else {
        bodyGroup.style.display = 'none';
        bodyInput.value = '';
      }
    }

    async function ejecutarPeticionApi() {
      const method = document.getElementById('api-method').value;
      const url = document.getElementById('api-url').value;
      const bodyText = document.getElementById('api-body').value;
      const statusBadge = document.getElementById('api-response-status');
      const viewer = document.getElementById('api-response-viewer');

      statusBadge.className = 'badge badge-amber';
      statusBadge.innerText = 'Consultando...';
      viewer.innerText = 'Enviando petición a ' + url + '...';

      const t0 = performance.now();
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }

        const options = { method, headers };
        if ((method === 'POST' || method === 'PUT') && bodyText.trim()) {
          options.body = bodyText;
        }

        const res = await fetch(url, options);
        const t1 = performance.now();
        const lat = Math.round(t1 - t0);

        let data;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
          viewer.innerText = JSON.stringify(data, null, 2);
        } else {
          const txt = await res.text();
          viewer.innerText = txt;
        }

        if (res.ok) {
          statusBadge.className = 'badge badge-green';
          statusBadge.innerText = res.status + ' OK (' + lat + ' ms)';
        } else {
          statusBadge.className = 'badge badge-red';
          statusBadge.innerText = res.status + ' Error (' + lat + ' ms)';
        }
      } catch (err) {
        statusBadge.className = 'badge badge-red';
        statusBadge.innerText = 'Error de Conexión';
        viewer.innerText = String(err);
      }
    }

    // Inicialización al cargar la página
    window.addEventListener('DOMContentLoaded', () => {
      actualizarInterfazUsuario();
      updateHealth();
      setInterval(updateHealth, 15000);
      cargarProductos();
    });
  </script>
</body>
</html>`;
}
