import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";

function App() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("mesero"); 
  const [adminTab, setAdminTab] = useState("monitor"); 
  const [closedOrders, setClosedOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  // Bodega y Control de Mesas
  const [warehouse, setWarehouse] = useState([]);
  const [newW, setNewW] = useState({ name: "", quantity: "", unit_cost: "", min_stock: "" });
  const [totalTablesInput, setTotalTablesInput] = useState("");

  // Estados UI y Auditoría
  const [editingProduct, setEditingProduct] = useState(null);
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [notification, setNotification] = useState({ show: false, msg: "", type: "success" });
  const [showConfirm, setShowConfirm] = useState({ show: false, action: null, msg: "" });
  const [newP, setNewP] = useState({ name: "", price: "", stock: "" });
  const [searchTerm, setSearchTerm] = useState(""); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  useEffect(() => {
    if (session) {
      const email = session.user.email.toLowerCase();
      if (email.includes("admin")) setView("admin");
      else if (email.includes("cocina")) setView("cocina");
      else setView("mesero");
      getData();
      const channel = supabase.channel("realtime-all").on("postgres_changes", { event: "*", schema: "public", table: "*" }, () => getData()).subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [session]);

  useEffect(() => {
    if (selectedTable && selectedTable.status === "occupied") {
      const order = orders.find(o => o.table_id === selectedTable.id && o.status !== 'closed' && o.status !== 'archived');
      setActiveOrder(order);
    } else {
      setActiveOrder(null);
    }
  }, [selectedTable, orders]);

  async function getData() {
    const { data: p } = await supabase.from("products").select("*").order('name', { ascending: true });
    const { data: t } = await supabase.from("tables").select("*").order('number', { ascending: true });
    const { data: o } = await supabase.from("orders").select(`*, tables(number), order_items(id, product_id, quantity, price, is_new, products(name))`).in('status', ['open', 'ready', 'delivered', 'archived']);
    const { data: co } = await supabase.from("orders").select(`*, tables(number), order_items(quantity, price, products(name))`).eq('status', 'closed');
    const { data: w } = await supabase.from("warehouse").select("*").order('name', { ascending: true });
    
    setProducts(p || []);
    setTables(t || []);
    setOrders(o || []);
    setClosedOrders(co || []);
    setWarehouse(w || []);
    if(t) setTotalTablesInput(t.length.toString());
  }

  function notify(msg, type = "success") {
    setNotification({ show: true, msg, type });
    setTimeout(() => setNotification({ show: false, msg: "", type: "success" }), 3000);
  }

  async function updateTableCount() {
    const newCount = parseInt(totalTablesInput);
    if (isNaN(newCount) || newCount < 0) return notify("Número no válido", "error");
    
    const currentCount = tables.length;
    if (newCount > currentCount) {
      const toAdd = [];
      for (let i = currentCount + 1; i <= newCount; i++) {
        toAdd.push({ number: i, status: "free" });
      }
      await supabase.from("tables").insert(toAdd);
    } else if (newCount < currentCount) {
      const toDelete = tables.slice(newCount);
      const occupied = toDelete.some(t => t.status === "occupied");
      if (occupied) return notify("No puedes eliminar mesas ocupadas", "error");
      await supabase.from("tables").delete().in("id", toDelete.map(t => t.id));
    }
    getData();
    notify("Mesas actualizadas");
  }

  async function runCashCut() {
    if (closedOrders.length === 0) {
      notify("No hay ventas para realizar el corte", "error");
      setShowConfirm({ show: false });
      return;
    }
    const { error } = await supabase.from("orders").update({ status: 'archived' }).eq('status', 'closed');
    if (!error) { notify("Corte de caja guardado exitosamente"); getData(); }
    setShowConfirm({ show: false });
  }

  async function addWarehouseItem() {
    if (!newW.name || !newW.quantity) return notify("Faltan datos", "error");
    await supabase.from("warehouse").insert([{ name: newW.name, quantity: parseInt(newW.quantity), unit_cost: parseFloat(newW.unit_cost || 0), min_stock: parseInt(newW.min_stock || 0) }]);
    setNewW({ name: "", quantity: "", unit_cost: "", min_stock: "" });
    getData();
  }

  async function addProduct() {
    if (!newP.name || !newP.price) return notify("Faltan datos", "error");
    await supabase.from("products").insert([{ name: newP.name, price: parseFloat(newP.price), stock: parseInt(newP.stock || 0), is_active: true }]);
    setNewP({ name: "", price: "", stock: "" });
    getData();
  }

  async function toggleProductStatus(product) {
    await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id);
    getData();
  }

  async function handleUpdateProduct() {
    await supabase.from("products").update({ price: parseFloat(editPrice), stock: parseInt(editStock) }).eq("id", editingProduct.id);
    setEditingProduct(null);
    getData();
  }

  function addToCart(product) {
    const item = cart.find(i => i.id === product.id);
    if (item && item.quantity + 1 > product.stock) return notify("Sin stock", "error");
    if (item) setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    else setCart([...cart, { ...product, quantity: 1 }]);
  }

  function removeFromCart(productId) {
    setCart(cart.filter(item => item.id !== productId));
  }

  async function saveOrder() {
    if (cart.length === 0) return notify("El carrito está vacío", "error");
    
    let orderId = activeOrder?.id;
    const cartTotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const userEmail = session?.user?.email || "usuario@restaurante.com";

    try {
      if (!orderId) {
        const { data: ord, error: errOrd } = await supabase
          .from("orders")
          .insert([{ 
            total: cartTotal, 
            table_id: selectedTable.id, 
            status: "open", 
            waiter_email: userEmail 
          }])
          .select()
          .single();
        
        if (errOrd) throw errOrd;
        orderId = ord.id;
        await supabase.from("tables").update({ status: "occupied" }).eq("id", selectedTable.id);
      } else {
        const { error: errUpd } = await supabase
          .from("orders")
          .update({ 
            total: (activeOrder.total || 0) + cartTotal, 
            status: "open", 
            waiter_email: userEmail 
          })
          .eq("id", orderId);
        if (errUpd) throw errUpd;
      }

      for (const item of cart) {
        await supabase.from("order_items").insert([{ 
          order_id: orderId, 
          product_id: item.id, 
          quantity: item.quantity, 
          price: item.price, 
          is_new: true 
        }]);
        if (item.stock !== undefined) {
          await supabase.from("products").update({ stock: item.stock - item.quantity }).eq("id", item.id);
        }
      }

      setCart([]); 
      getData(); 
      notify("✅ Pedido enviado a cocina");
    } catch (error) {
      console.error(error);
      notify("Error al guardar: " + error.message, "error");
    }
  }

  async function markDelivered(id) {
    await supabase.from("order_items").update({ is_new: false }).eq("order_id", id);
    await supabase.from("orders").update({ status: "delivered" }).eq("id", id);
    getData();
    notify("Productos entregados");
  }

  async function closeOrder() {
    if (activeOrder.status === 'open' || activeOrder.status === 'ready') {
      return notify("No se puede cobrar: Aún hay productos en cocina o por entregar", "error");
    }
    await supabase.from("orders").update({ status: "closed" }).eq("id", activeOrder.id);
    await supabase.from("tables").update({ status: "free" }).eq("id", selectedTable.id);
    setSelectedTable(null); getData(); notify("Cuenta cobrada"); setShowConfirm({ show: false });
  }

  // --- FUNCIÓN PARA AGRUPAR ITEMS (SOLUCIÓN PUNTO 1) ---
  function getGroupedItems(items) {
    const grouped = {};
    items.forEach(oi => {
      const key = `${oi.product_id}-${oi.is_new}`;
      if (!grouped[key]) {
        grouped[key] = { ...oi, quantity: 0 };
      }
      grouped[key].quantity += oi.quantity;
    });
    return Object.values(grouped);
  }

  if (!session) return <Login />;
  const isAdmin = session.user.email.toLowerCase().includes("admin");

  return (
    <div style={{ padding: "15px", fontFamily: "'Inter', sans-serif", backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      
      <style>{`
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .blink-ready { animation: blink 1s infinite; background-color: #fbbf24 !important; color: black !important; }
        .tab-btn { padding: 10px 15px; border: none; background: none; cursor: pointer; font-weight: bold; color: #64748b; border-bottom: 3px solid transparent; transition: 0.3s; }
        .tab-btn.active { color: #3b82f6; border-bottom: 3px solid #3b82f6; }
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .main-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        @media (max-width: 600px) { .table-btn-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>

      {/* Notificaciones y Confirmaciones */}
      {notification.show && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', padding: '15px 25px', borderRadius: '10px', background: notification.type === 'success' ? '#22c55e' : '#ef4444', color: 'white', zIndex: 9999, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {notification.msg}
        </div>
      )}

      {showConfirm.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '320px', textAlign: 'center' }}>
            <p style={{ fontWeight: 'bold' }}>{showConfirm.msg}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowConfirm({ show: false })} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>Cancelar</button>
              <button onClick={showConfirm.action} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", color: "white", padding: "12px 20px", borderRadius: "12px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{view === "admin" ? "🚀 Admin Panel" : view === "cocina" ? "👨‍🍳 Cocina" : "🍽️ Servicio"}</h2>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold" }}>Salir</button>
      </nav>

      {/* VISTA ADMIN (Sin cambios) */}
      {view === "admin" && (
        <>
          <div className="grid-cards">
            <div style={cardStyle("#22c55e")}><span style={{fontSize: '0.8rem', color: '#64748b'}}>Ventas Hoy</span><div style={{fontSize: '1.4rem', fontWeight: 'bold'}}>${closedOrders.reduce((s,o)=>s+o.total,0)}</div></div>
            <div style={cardStyle("#3b82f6")}><span style={{fontSize: '0.8rem', color: '#64748b'}}>Mesas Ocupadas</span><div style={{fontSize: '1.4rem', fontWeight: 'bold'}}>{tables.filter(t=>t.status==="occupied").length}/{tables.length}</div></div>
            <div style={cardStyle("#ef4444")}><span style={{fontSize: '0.8rem', color: '#64748b'}}>En Cocina</span><div style={{fontSize: '1.4rem', fontWeight: 'bold'}}>{orders.filter(o=>o.status==="open").length}</div></div>
          </div>

          <div style={{ display: 'flex', background: 'white', borderRadius: '10px', padding: '5px', marginBottom: '20px', overflowX: 'auto' }}>
            <button className={`tab-btn ${adminTab === 'monitor' ? 'active' : ''}`} onClick={() => setAdminTab('monitor')}>Monitor</button>
            <button className={`tab-btn ${adminTab === 'productos' ? 'active' : ''}`} onClick={() => setAdminTab('productos')}>Menú/Precios</button>
            <button className={`tab-btn ${adminTab === 'bodega' ? 'active' : ''}`} onClick={() => setAdminTab('bodega')}>Bodega</button>
            <button className={`tab-btn ${adminTab === 'historial' ? 'active' : ''}`} onClick={() => setAdminTab('historial')}>Historial/Corte</button>
            <button className={`tab-btn ${adminTab === 'auditoria' ? 'active' : ''}`} onClick={() => setAdminTab('auditoria')}>Auditoría Global</button>
          </div>

          {adminTab === 'monitor' && (
            <div className="main-grid">
              <div style={sectionStyle}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                   <h3>Monitor de Mesas</h3>
                   <div style={{textAlign: 'right'}}>
                      <small style={{display: 'block', color: '#64748b'}}>Control de Mesas</small>
                      <input type="number" value={totalTablesInput} onChange={(e)=>setTotalTablesInput(e.target.value)} style={{...inputStyle, width: '60px', padding: '5px'}} />
                      <button onClick={updateTableCount} style={{marginLeft: '5px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '12px'}}>Guardar</button>
                   </div>
                </div>
                {tables.filter(t=>t.status==='occupied').map(t => {
                  const o = orders.find(ord=>ord.table_id===t.id && ord.status !== 'archived' && ord.status !== 'closed');
                  return (
                    <div key={t.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "10px 0", display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong style={{display: 'block'}}>Mesa {t.number}</strong>
                        <span style={{fontSize: '0.75rem', color: '#64748b'}}>{o?.order_items.map(oi => `${oi.quantity} ${oi.products?.name}`).join(', ')}</span>
                      </div>
                      <span style={{fontWeight: 'bold', color: '#22c55e'}}>${o?.total || 0}</span>
                    </div>
                  );
                })}
              </div>
              <div style={sectionStyle}>
                <h3 style={{color: '#ef4444'}}>Alertas Stock Bajo</h3>
                {products.filter(p => p.stock < 10).map(p => (
                  <div key={p.id} style={{fontSize: '0.9rem', padding: '8px', background: '#fef2f2', marginBottom: '5px', borderRadius: '6px', borderLeft: '4px solid #ef4444'}}>
                    {p.name}: <b>{p.stock} unidades</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'productos' && (
            <div style={sectionStyle}>
              <h3>Gestión de Menú</h3>
              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '10px'}}>
                <input type="text" placeholder="Nombre" value={newP.name} onChange={e => setNewP({...newP, name: e.target.value})} style={inputStyle} />
                <input type="number" placeholder="Precio" value={newP.price} onChange={e => setNewP({...newP, price: e.target.value})} style={{...inputStyle, width: '100px'}} />
                <input type="number" placeholder="Stock" value={newP.stock} onChange={e => setNewP({...newP, stock: e.target.value})} style={{...inputStyle, width: '100px'}} />
                <button onClick={addProduct} style={{background: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold'}}>+ Añadir Producto</button>
              </div>
              <div style={{overflowX: 'auto'}}>
                <table style={{ width: "100%", borderCollapse: 'collapse' }}>
                  <thead style={{background: '#f8fafc', textAlign: 'left'}}>
                    <tr><th style={thStyle}>Producto</th><th style={thStyle}>Precio</th><th style={thStyle}>Stock</th><th style={thStyle}>Estado</th><th style={thStyle}>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                        <td style={tdStyle}>{p.name}</td>
                        <td style={tdStyle}>${p.price}</td>
                        <td style={tdStyle}>{p.stock}</td>
                        <td style={tdStyle}>{p.is_active ? "✅ Activo" : "❌ Oculto"}</td>
                        <td style={tdStyle}>
                          <button onClick={() => toggleProductStatus(p)} style={{marginRight: '5px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc'}}>{p.is_active ? "Ocultar" : "Mostrar"}</button>
                          <button onClick={() => { setEditingProduct(p); setEditPrice(p.price); setEditStock(p.stock); }} style={{padding: '5px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px'}}>Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'bodega' && (
            <div style={sectionStyle}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h3>Control de Bodega (Insumos)</h3>
                <div style={{background: '#1e293b', color: 'white', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold'}}>
                  Total Bodega: ${warehouse.reduce((s, i) => s + (i.quantity * i.unit_cost), 0)}
                </div>
              </div>
              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '10px'}}>
                <input type="text" placeholder="Insumo" value={newW.name} onChange={e => setNewW({...newW, name: e.target.value})} style={inputStyle} />
                <input type="number" placeholder="Cantidad" value={newW.quantity} onChange={e => setNewW({...newW, quantity: e.target.value})} style={{...inputStyle, width: '100px'}} />
                <input type="number" placeholder="Costo Unit." value={newW.unit_cost} onChange={e => setNewW({...newW, unit_cost: e.target.value})} style={{...inputStyle, width: '100px'}} />
                <button onClick={addWarehouseItem} style={{background: '#22c55e', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold'}}>Guardar Insumo</button>
              </div>
              <table style={{ width: "100%", borderCollapse: 'collapse' }}>
                <thead style={{background: '#f8fafc', textAlign: 'left'}}>
                  <tr><th style={thStyle}>Insumo</th><th style={thStyle}>Stock</th><th style={thStyle}>Costo</th><th style={thStyle}>Valor</th><th style={thStyle}>Estado</th></tr>
                </thead>
                <tbody>
                  {warehouse.map(item => (
                    <tr key={item.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                      <td style={tdStyle}>{item.name}</td>
                      <td style={tdStyle}>{item.quantity}</td>
                      <td style={tdStyle}>${item.unit_cost}</td>
                      <td style={tdStyle}>${item.quantity * item.unit_cost}</td>
                      <td style={tdStyle}>{item.quantity <= item.min_stock ? <span style={{color: 'red'}}>⚠️ Bajo</span> : "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'historial' && (
            <div style={sectionStyle}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h3>Historial de Ventas (Turno Actual)</h3>
                <button onClick={() => setShowConfirm({ show: true, msg: "¿Cerrar caja y archivar ventas?", action: runCashCut })} style={{background: '#000', color: 'white', padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold'}}>CORTE DE CAJA</button>
              </div>
              <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                {closedOrders.length === 0 ? <p>No hay cobros registrados en este turno.</p> : closedOrders.map(o => (
                  <div key={o.id} style={{padding: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <span style={{fontWeight: 'bold'}}>Mesa {o.tables?.number}</span>
                      <div style={{fontSize: '0.8rem', color: '#64748b'}}>{o.order_items.map(oi => `${oi.quantity}x ${oi.products?.name}`).join(', ')}</div>
                    </div>
                    <span style={{fontWeight: 'bold', fontSize: '1.1rem'}}>${o.total}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop: '20px', padding: '15px', background: '#22c55e', color: 'white', borderRadius: '10px', textAlign: 'right'}}>
                <span style={{fontSize: '0.9rem'}}>TOTAL TURNO ACTUAL:</span>
                <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>${closedOrders.reduce((s,o)=>s+o.total,0)}</div>
              </div>
            </div>
          )}

          {adminTab === 'auditoria' && (
            <div style={sectionStyle}>
              <h3>Auditoría (Ventas Archivadas)</h3>
              <div style={{marginBottom: '20px'}}>
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{...inputStyle, width: '100%'}} />
              </div>
              <div style={{overflowX: 'auto'}}>
                <table style={{ width: "100%", borderCollapse: 'collapse' }}>
                  <thead style={{background: '#f8fafc', textAlign: 'left'}}>
                    <tr><th style={thStyle}>Fecha</th><th style={thStyle}>Mesa</th><th style={thStyle}>Usuario</th><th style={thStyle}>Productos</th><th style={thStyle}>Total</th></tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.status === 'archived' && (searchTerm === "" || o.created_at.includes(searchTerm) || o.waiter_email?.toLowerCase().includes(searchTerm.toLowerCase()) || o.order_items.some(oi => oi.products?.name.toLowerCase().includes(searchTerm.toLowerCase())))).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(o => (
                      <tr key={o.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                        <td style={tdStyle}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td style={tdStyle}>Mesa {o.tables?.number}</td>
                        <td style={tdStyle}><small style={{color: '#3b82f6'}}>{o.waiter_email || 'N/A'}</small></td>
                        <td style={tdStyle}><div style={{fontSize: '0.8rem', color: '#64748b'}}>{o.order_items.map(oi => `${oi.quantity}x ${oi.products?.name}`).join(', ')}</div></td>
                        <td style={{...tdStyle, fontWeight: 'bold'}}>${o.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* VISTA MESERO (SOLUCIÓN PUNTOS 1 Y 2) */}
      {view === "mesero" && (
        <div className="main-grid">
          <div style={sectionStyle}>
            <h3>Seleccionar Mesa</h3>
            <div className="table-btn-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: '20px' }}>
              {tables.map(t => {
                const isReady = orders.some(ord => ord.table_id === t.id && ord.status === 'ready');
                return (
                  <button key={t.id} onClick={() => {setSelectedTable(t); setCart([]);}} className={isReady ? "blink-ready" : ""} style={{ padding: "15px 5px", background: selectedTable?.id === t.id ? "#22c55e" : t.status === "occupied" ? "#ef4444" : "#cbd5e1", color: "white", border: "none", borderRadius: "8px", fontWeight: 'bold', cursor: 'pointer' }}>
                    Mesa {t.number} {isReady ? "🔔" : ""}
                  </button>
                );
              })}
            </div>
            {selectedTable && (
              <>
                <h4>Menú Disponible</h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
                  {products.filter(p => p.is_active && p.stock > 0).map(p => (
                    <div key={p.id} style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{p.name} (${p.price})</span>
                      <button onClick={() => addToCart(p)} style={{background: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', padding: '5px 12px', fontWeight: 'bold'}}>+</button>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div style={{ background: "#f8fafc", padding: "15px", borderRadius: "10px" }}>
                    <h4 style={{marginTop: 0}}>Carrito</h4>
                    {cart.map(item => (
                      <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem', alignItems: 'center'}}>
                        <span>{item.quantity}x {item.name}</span>
                        <button onClick={() => removeFromCart(item.id)} style={{background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', padding: '5px'}}>X</button>
                      </div>
                    ))}
                    <button onClick={saveOrder} style={{ width: "100%", background: "#3b82f6", color: "white", border: "none", padding: "12px", marginTop: "10px", borderRadius: "8px", fontWeight: "bold" }}>ENVIAR A COCINA</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={sectionStyle}>
            <h3 style={{marginTop: 0}}>Mesa {selectedTable?.number || "--"}</h3>
            {activeOrder && (
              <div>
                {/* SOLUCIÓN PUNTO 2: DETALLE DE QUÉ LLEVAR A LA MESA */}
                {activeOrder.status === 'ready' && (
                  <div style={{ background: "#fff3cd", border: "2px solid #fbbf24", padding: "15px", borderRadius: "10px", marginBottom: "15px" }}>
                    <p style={{ margin: "0 0 5px 0", fontWeight: "bold", color: "#856404" }}>🔔 ¡LISTO PARA SERVIR!</p>
                    <div style={{marginBottom: '10px', fontSize: '0.9rem'}}>
                      <strong>Debes llevar:</strong><br/>
                      {getGroupedItems(activeOrder.order_items.filter(oi => oi.is_new)).map((oi, idx) => (
                        <div key={idx}>• {oi.quantity}x {oi.products?.name}</div>
                      ))}
                    </div>
                    <button onClick={() => markDelivered(activeOrder.id)} style={{ width: "100%", background: "#fbbf24", border: "none", padding: "10px", borderRadius: "5px", fontWeight: 'bold' }}>MARCAR COMO ENTREGADO</button>
                  </div>
                )}

                {/* SOLUCIÓN PUNTO 1: AGRUPAR ITEMS EN LA VISUALIZACIÓN */}
                <div style={{ marginBottom: "20px" }}>
                  {getGroupedItems(activeOrder.order_items).map((oi, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: 'bold'}}>{oi.quantity}x {oi.products?.name}</div>
                        <small style={{color: oi.is_new ? '#3b82f6' : '#64748b'}}>{oi.is_new ? "(En Cocina)" : "(Servido)"}</small>
                      </div>
                      <span style={{fontWeight: 'bold'}}>${oi.price * oi.quantity}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e', textAlign: 'right', marginBottom: '15px' }}>Total: ${activeOrder.total}</div>
                
                <button 
                  onClick={() => {
                    if (activeOrder.status === 'open' || activeOrder.status === 'ready') {
                      notify("Pedido aún en cocina o por entregar. ¡No se puede cobrar!", "error");
                    } else {
                      setShowConfirm({ show: true, msg: "¿Cobrar Mesa " + selectedTable.number + "?", action: closeOrder });
                    }
                  }} 
                  style={{ 
                    width: "100%", 
                    background: (activeOrder.status === 'open' || activeOrder.status === 'ready') ? "#94a3b8" : "#22c55e", 
                    color: "white", border: "none", padding: "15px", borderRadius: "10px", fontWeight: 'bold', fontSize: '1.1rem' 
                  }}
                >
                  {(activeOrder.status === 'open' || activeOrder.status === 'ready') ? "PEDIDO EN CURSO..." : "COBRAR CUENTA"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COCINA */}
      {view === "cocina" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
          {orders.filter(o => o.status === "open").map(o => (
            <div key={o.id} style={{...sectionStyle, borderTop: '6px solid #3b82f6'}}>
              <h2 style={{marginTop: 0}}>Mesa {o.tables?.number}</h2>
              {getGroupedItems(o.order_items.filter(oi => oi.is_new)).map((oi, i) => (
                <div key={i} style={{fontSize: '1.2rem', padding: '5px 0', borderBottom: '1px dashed #eee'}}><b>{oi.quantity}x</b> {oi.products?.name}</div>
              ))}
              <button onClick={async () => { await supabase.from("orders").update({ status: "ready" }).eq("id", o.id); getData(); notify("Orden terminada"); }} style={{ width: "100%", background: "#22c55e", color: "white", border: "none", padding: "15px", borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '10px' }}>ORDEN LISTA</button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL EDITAR */}
      {editingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '15px', width: '300px' }}>
            <h3 style={{marginTop: 0}}>Editar {editingProduct.name}</h3>
            <label style={{fontSize: '0.8rem'}}>Precio:</label><input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{...inputStyle, width: '100%', marginBottom: '10px'}} />
            <label style={{fontSize: '0.8rem'}}>Stock:</label><input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} style={{...inputStyle, width: '100%', marginBottom: '20px'}} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>Cerrar</button>
              <button onClick={handleUpdateProduct} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <button onClick={() => setView(view === "admin" ? "mesero" : "admin")} style={{ position: "fixed", bottom: "25px", right: "25px", width: '65px', height: '65px', borderRadius: "50%", background: "#1e293b", color: "white", border: "none", fontSize: "28px", cursor: "pointer", boxShadow: '0 6px 15px rgba(0,0,0,0.4)', zIndex: 100 }}>
          {view === "admin" ? "🪑" : "📊"}
        </button>
      )}
    </div>
  );
}

const cardStyle = (color) => ({ background: "#fff", padding: "15px", borderRadius: "12px", borderLeft: `6px solid ${color}`, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" });
const sectionStyle = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", marginBottom: "20px" };
const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', flex: 1 };
const thStyle = { padding: '12px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.85rem' };
const tdStyle = { padding: '12px', fontSize: '0.9rem' };

export default App;