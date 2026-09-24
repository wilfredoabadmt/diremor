export function getPortalHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DIREMOR S.R.L. | Plataforma SAC Cloud</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 26, 43, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.25);
      --accent: #10b981;
      --accent-glow: rgba(16, 185, 129, 0.2);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: 'Outfit', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
      background-image: 
        radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 40%);
    }
    .container {
      max-width: 860px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 500;
      color: #34d399;
      margin-bottom: 1.25rem;
      backdrop-filter: blur(8px);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background-color: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin-bottom: 0.75rem;
      background: linear-gradient(135deg, #ffffff 30%, #93c5fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 1.08rem;
      max-width: 580px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
      margin-bottom: 2rem;
    }
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.5rem;
    }
    .status-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .status-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .status-val {
      font-size: 0.98rem;
      font-weight: 600;
      color: var(--text-main);
      font-family: 'JetBrains Mono', monospace;
    }
    .modules-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .module-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      transition: all 0.2s ease;
    }
    .module-item:hover {
      border-color: rgba(59, 130, 246, 0.4);
      background: rgba(59, 130, 246, 0.05);
      transform: translateY(-2px);
    }
    .module-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.65rem;
      background: rgba(59, 130, 246, 0.15);
      color: #93c5fd;
    }
    .module-name {
      font-weight: 600;
      font-size: 0.98rem;
      margin-bottom: 0.35rem;
    }
    .module-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 1.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.4rem;
      border-radius: 10px;
      font-size: 0.92rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 4px 14px var(--primary-glow);
    }
    .btn-primary:hover {
      background: #2563eb;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
      border: 1px solid var(--border);
    }
    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .footer {
      text-align: center;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">
        <span class="pulse-dot"></span>
        Servicios Cloud Activos en Coolify PaaS
      </div>
      <h1>DIREMOR S.R.L.</h1>
      <p class="subtitle">Sistema de Gestión Administrativo Comercial e Inventarios en Línea (SAC)</p>
    </div>

    <div class="card">
      <div class="status-bar">
        <div class="status-item">
          <span class="status-label">Servicio API</span>
          <span class="status-val" style="color: #60a5fa;">diremor-sac-api</span>
        </div>
        <div class="status-item">
          <span class="status-label">Base de Datos</span>
          <span class="status-val" id="db-status">PostgreSQL 16 (Conectado)</span>
        </div>
        <div class="status-item">
          <span class="status-label">Latencia SQL</span>
          <span class="status-val" id="latency-val" style="color: #34d399;">1 ms</span>
        </div>
        <div class="status-item">
          <span class="status-label">Entorno</span>
          <span class="status-val">Producción</span>
        </div>
      </div>

      <div class="modules-title">
        <span>🚀 Módulos del Sistema Operativos (SDD)</span>
      </div>

      <div class="grid">
        <div class="module-item">
          <span class="module-badge">001-CORE</span>
          <div class="module-name">Seguridad & Multi-Sucursal</div>
          <div class="module-desc">Autenticación JWT, RBAC multi-rol, control de Casa Matriz y agencias.</div>
        </div>

        <div class="module-item">
          <span class="module-badge">002-INVENTARIO</span>
          <div class="module-name">Kardex Físico-Valorado</div>
          <div class="module-desc">Saldos ponderados en tiempo real, trazabilidad de series y bloqueo de sobregiro.</div>
        </div>

        <div class="module-item">
          <span class="module-badge">003-FINANZAS</span>
          <div class="module-name">Clientes & Control de Mora</div>
          <div class="module-desc">Evaluación crediticia automática, mora preventiva y mostrador genérico.</div>
        </div>

        <div class="module-item">
          <span class="module-badge">004-POS</span>
          <div class="module-name">Ventas & Despacho</div>
          <div class="module-desc">Descargo atómico en Kardex vía triggers PostgreSQL y anulación controlada.</div>
        </div>

        <div class="module-item">
          <span class="module-badge" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7;">005-FISCAL</span>
          <div class="module-name">Facturación en Línea (SIN)</div>
          <div class="module-desc">RND 102100000011, CUF algorítmico, CUFD, códigos QR tributarios y anulación.</div>
        </div>

        <div class="module-item">
          <span class="module-badge" style="background: rgba(245, 158, 11, 0.15); color: #fcd34d;">006-CAJAS</span>
          <div class="module-name">Control de Cajas & Turnos</div>
          <div class="module-desc">Arqueos ciegos de corte, control de sobrantes/faltantes y movimientos de gaveta.</div>
        </div>
      </div>

      <div class="actions">
        <a href="/api/health" class="btn btn-primary" target="_blank">
          Probar Healthcheck JSON
        </a>
        <a href="/api" class="btn btn-outline" target="_blank">
          Ver Catálogo API
        </a>
      </div>
    </div>

    <div class="footer">
      &copy; 2026 DIREMOR S.R.L. | Desplegado sobre Coolify PaaS (Docker + Traefik + PostgreSQL 16)
    </div>
  </div>

  <script>
    async function updateHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          document.getElementById('latency-val').innerText = data.latencyMs + ' ms';
          document.getElementById('db-status').innerText = 'PostgreSQL 16 (' + data.database + ')';
        }
      } catch (e) {
        console.error('Error al actualizar healthcheck:', e);
      }
    }
    updateHealth();
  </script>
</body>
</html>`;
}
