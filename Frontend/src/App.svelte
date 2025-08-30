<!-- frontend/src/App.svelte -->
<script>
    import { onMount } from 'svelte';
    
    // Variables reactivas
    let prestamos = [];
    let estadisticas = {};
    let loading = false;
    let error = '';
    let vistaActual = 'dashboard'; // dashboard, prestamos, nuevo
    
    // Formulario para nuevo préstamo
    let nuevoPrestamo = {
      cliente: '',
      monto: '',
      articulo: '',
      interes: 15
    };
  
    // Cargar datos al iniciar
    onMount(async () => {
      await cargarDatos();
    });
  
    async function cargarDatos() {
      loading = true;
      error = '';
      
      try {
        // Cargar préstamos
        const responseP = await fetch('http://localhost:3001/api/prestamos');
        if (!responseP.ok) throw new Error('Error al cargar préstamos');
        prestamos = await responseP.json();
        
        // Cargar estadísticas
        const responseE = await fetch('http://localhost:3001/api/estadisticas');
        if (!responseE.ok) throw new Error('Error al cargar estadísticas');
        estadisticas = await responseE.json();
        
      } catch (err) {
        error = 'Error de conexión: ' + err.message;
        console.error('Error:', err);
      } finally {
        loading = false;
      }
    }
  
    async function crearPrestamo() {
      if (!nuevoPrestamo.cliente || !nuevoPrestamo.monto || !nuevoPrestamo.articulo) {
        error = 'Todos los campos son requeridos';
        return;
      }
  
      loading = true;
      error = '';
  
      try {
        const response = await fetch('http://localhost:3001/api/prestamos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(nuevoPrestamo),
        });
  
        if (!response.ok) throw new Error('Error al crear préstamo');
  
        // Limpiar formulario
        nuevoPrestamo = { cliente: '', monto: '', articulo: '', interes: 15 };
        
        // Recargar datos y volver al dashboard
        await cargarDatos();
        vistaActual = 'prestamos';
        
      } catch (err) {
        error = 'Error al crear préstamo: ' + err.message;
      } finally {
        loading = false;
      }
    }
  
    async function cambiarEstado(id, nuevoEstado) {
      try {
        const response = await fetch(`http://localhost:3001/api/prestamos/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ estado: nuevoEstado }),
        });
  
        if (!response.ok) throw new Error('Error al actualizar préstamo');
        
        await cargarDatos();
      } catch (err) {
        error = 'Error al actualizar: ' + err.message;
      }
    }
  
    function getColorEstado(estado) {
      switch (estado) {
        case 'Activo': return '#28a745';
        case 'Pagado': return '#007bff';
        case 'En Mora': return '#dc3545';
        default: return '#6c757d';
      }
    }
  </script>
  
  <main>
    <header>
      <h1>Sistema de Préstamos Pignoraticios</h1>
      <nav>
        <button 
          class:active={vistaActual === 'dashboard'} 
          on:click={() => vistaActual = 'dashboard'}
        >
          Dashboard
        </button>
        <button 
          class:active={vistaActual === 'prestamos'} 
          on:click={() => vistaActual = 'prestamos'}
        >
          Préstamos
        </button>
        <button 
          class:active={vistaActual === 'nuevo'} 
          on:click={() => vistaActual = 'nuevo'}
        >
          Nuevo Préstamo
        </button>
        <button on:click={cargarDatos} disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </nav>
    </header>
  
    {#if error}
      <div class="error">
        {error}
        <button on:click={() => error = ''}>×</button>
      </div>
    {/if}
  
    <!-- Dashboard -->
    {#if vistaActual === 'dashboard'}
      <section class="dashboard">
        <h2>Estadísticas Generales</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Total Préstamos</h3>
            <p class="stat-number">{estadisticas.total || 0}</p>
          </div>
          <div class="stat-card">
            <h3>Activos</h3>
            <p class="stat-number" style="color: #28a745">{estadisticas.activos || 0}</p>
          </div>
          <div class="stat-card">
            <h3>Pagados</h3>
            <p class="stat-number" style="color: #007bff">{estadisticas.pagados || 0}</p>
          </div>
          <div class="stat-card">
            <h3>En Mora</h3>
            <p class="stat-number" style="color: #dc3545">{estadisticas.enMora || 0}</p>
          </div>
          <div class="stat-card wide">
            <h3>Monto Total</h3>
            <p class="stat-number">${estadisticas.montoTotal || 0}</p>
          </div>
        </div>
      </section>
    {/if}
  
    <!-- Lista de Préstamos -->
    {#if vistaActual === 'prestamos'}
      <section class="prestamos">
        <h2>Gestión de Préstamos</h2>
        {#if prestamos.length > 0}
          <div class="prestamos-grid">
            {#each prestamos as prestamo}
              <div class="prestamo-card">
                <div class="prestamo-header">
                  <h3>{prestamo.cliente}</h3>
                  <span 
                    class="estado-badge" 
                    style="background-color: {getColorEstado(prestamo.estado)}"
                  >
                    {prestamo.estado}
                  </span>
                </div>
                <div class="prestamo-details">
                  <p><strong>Artículo:</strong> {prestamo.articulo}</p>
                  <p><strong>Monto:</strong> ${prestamo.monto}</p>
                  <p><strong>Interés:</strong> {prestamo.interes}%</p>
                  <p><strong>Fecha:</strong> {prestamo.fechaSolicitud}</p>
                </div>
                <div class="prestamo-actions">
                  {#if prestamo.estado === 'Activo'}
                    <button 
                      class="btn-success" 
                      on:click={() => cambiarEstado(prestamo.id, 'Pagado')}
                    >
                      Marcar Pagado
                    </button>
                    <button 
                      class="btn-danger" 
                      on:click={() => cambiarEstado(prestamo.id, 'En Mora')}
                    >
                      Marcar Mora
                    </button>
                  {/if}
                  {#if prestamo.estado === 'En Mora'}
                    <button 
                      class="btn-success" 
                      on:click={() => cambiarEstado(prestamo.id, 'Pagado')}
                    >
                      Marcar Pagado
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p>No hay préstamos registrados</p>
        {/if}
      </section>
    {/if}
  
    <!-- Nuevo Préstamo -->
    {#if vistaActual === 'nuevo'}
      <section class="nuevo-prestamo">
        <h2>Crear Nuevo Préstamo</h2>
        <form on:submit|preventDefault={crearPrestamo}>
          <div class="form-group">
            <label for="cliente">Nombre del Cliente:</label>
            <input 
              type="text" 
              id="cliente" 
              bind:value={nuevoPrestamo.cliente} 
              required
            >
          </div>
          
          <div class="form-group">
            <label for="articulo">Artículo a Empeñar:</label>
            <input 
              type="text" 
              id="articulo" 
              bind:value={nuevoPrestamo.articulo} 
              required
            >
          </div>
          
          <div class="form-group">
            <label for="monto">Monto del Préstamo:</label>
            <input 
              type="number" 
              id="monto" 
              bind:value={nuevoPrestamo.monto} 
              min="1" 
              step="0.01" 
              required
            >
          </div>
          
          <div class="form-group">
            <label for="interes">Tasa de Interés (%):</label>
            <input 
              type="number" 
              id="interes" 
              bind:value={nuevoPrestamo.interes} 
              min="1" 
              max="50" 
              step="0.1"
            >
          </div>
          
          <button type="submit" class="btn-primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Préstamo'}
          </button>
        </form>
      </section>
    {/if}
  </main>
  
  <style>
    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  
    header {
      margin-bottom: 30px;
      border-bottom: 2px solid #e9ecef;
      padding-bottom: 20px;
    }
  
    h1 {
      color: #343a40;
      margin-bottom: 15px;
    }
  
    nav {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
  
    nav button {
      padding: 10px 15px;
      border: 2px solid #007bff;
      background: white;
      color: #007bff;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.3s;
    }
  
    nav button:hover,
    nav button.active {
      background: #007bff;
      color: white;
    }
  
    nav button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  
    .error {
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  
    .error button {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #721c24;
    }
  
    /* Dashboard */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
  
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
  
    .stat-card.wide {
      grid-column: span 2;
    }
  
    .stat-card h3 {
      margin: 0 0 10px 0;
      color: #6c757d;
      font-size: 14px;
      text-transform: uppercase;
    }
  
    .stat-number {
      font-size: 28px;
      font-weight: bold;
      margin: 0;
      color: #343a40;
    }
  
    /* Préstamos */
    .prestamos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
  
    .prestamo-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
      border-left: 4px solid #007bff;
    }
  
    .prestamo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
  
    .prestamo-header h3 {
      margin: 0;
      color: #343a40;
    }
  
    .estado-badge {
      padding: 4px 12px;
      border-radius: 15px;
      color: white;
      font-size: 12px;
      font-weight: bold;
    }
  
    .prestamo-details p {
      margin: 8px 0;
      color: #6c757d;
    }
  
    .prestamo-actions {
      margin-top: 15px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
  
    /* Nuevo Préstamo */
    .nuevo-prestamo form {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 500px;
    }
  
    .form-group {
      margin-bottom: 20px;
    }
  
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
      color: #343a40;
    }
  
    .form-group input {
      width: 100%;
      padding: 10px;
      border: 2px solid #e9ecef;
      border-radius: 5px;
      font-size: 16px;
    }
  
    .form-group input:focus {
      outline: none;
      border-color: #007bff;
    }
  
    /* Botones */
    .btn-primary {
      background: #007bff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
    }
  
    .btn-primary:hover {
      background: #0056b3;
    }
  
    .btn-primary:disabled {
      background: #6c757d;
      cursor: not-allowed;
    }
  
    .btn-success {
      background: #28a745;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
  
    .btn-success:hover {
      background: #218838;
    }
  
    .btn-danger {
      background: #dc3545;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
  
    .btn-danger:hover {
      background: #c82333;
    }
  
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .stat-card.wide {
        grid-column: span 1;
      }
      
      .prestamos-grid {
        grid-template-columns: 1fr;
      }
      
      nav {
        flex-direction: column;
      }
      
      .prestamo-actions {
        flex-direction: column;
      }
    }
  </style>