import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";

function App() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("mesero"); // Vista principal: admin, mesero, cocina
  const [adminTab, setAdminTab] = useState("monitor"); // Sub-pestañas para admin
  const [closedOrders, setClosedOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  // Bodega
  const [warehouse, setWarehouse] = useState([]);
  const [newW, setNewW] = useState({ name: "", quantity: "", unit_cost: "", min_stock: "" });
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  // Estados UI
  const [editingProduct, setEditingProduct] = useState(null);
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [notification, setNotification] = useState({ show: false, msg: "", type: "success" });
  const [showConfirm, setShowConfirm] = useState({ show: false, action: null, msg: "" });
  const [newP, setNewP] = useState({ name: "", price: "", stock: "" });

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
  }

  function notify(msg, type = "success") {
    setNotification({ show: true, msg, type });
    setTimeout(() => setNotification({ show: false, msg: "", type: "success" }), 3000);
  }

  async function runCashCut() {
    const { error } = await supabase.from("orders").update({ status: 'archived' }).eq('status', 'closed');
    if (!error) { notify("Corte de caja guardado exitosamente"); getData(); }
    setShowConfirm({ show: false });
  }

  // --- LOGICA DE NEGOCIO (SIN CAMBIOS) ---
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

  async function saveOrder() {
    let orderId = activeOrder?.id;
    const cartTotal = cart.reduce((s,i)=>s+(i.price*i.quantity),0);
    if (!orderId) {
      const { data: ord } = await supabase.from("orders").insert([{ total: cartTotal, table_id: selectedTable.id, status: "open" }]).select().single();
      orderId = ord.id;
      await supabase.from("tables").update({ status: "occupied" }).eq("id", selectedTable.id);
    } else {
      await supabase.from("orders").update({ total: activeOrder.total + cartTotal, status: "open" }).eq("id", orderId);
    }
    for (const item of cart) {
      await supabase.from("order_items").insert([{ order_id: orderId, product_id: item.id, quantity: item.quantity, price: item.price, is_new: true }]);
      await supabase.from("products").update({ stock: item.stock - item.quantity }).eq("id", item.id);
    }
    setCart([]); getData(); notify("Pedido enviado");
  }

  async function markDelivered(id) {
    await supabase.from("order_items").update({ is_new: false }).eq("order_id", id);
    await supabase.from("orders").update({ status: "delivered" }).eq("id", id);
    getData();
  }

  async function closeOrder() {
    await supabase.from("orders").update({ status: "closed" }).eq("id", activeOrder.id);
    await supabase.from("tables").update({ status: "free" }).eq("id", selectedTable.id);
    setSelectedTable(null); getData(); notify("Cuenta cobrada"); setShowConfirm({ show: false });
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

      {/* Notificaciones */}
      {notification.show && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', padding: '15px 25px', borderRadius: '10px', background: notification.type === 'success' ? '#22c55e' : '#ef4444', color: 'white', zIndex: 9999, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {notification.msg}
        </div>
      )}

      {/* Confirmaciones */}
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

      {/* Navegación Principal */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", color: "white", padding: "12px 20px", borderRadius: "12px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{view === "admin" ? "🚀 Admin Panel" : view === "cocina" ? "👨‍🍳 Cocina" : "🍽️ Servicio"}</h2>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold" }}>Salir</button>
      </nav>

      {/* --- VISTA ADMIN CON PESTAÑAS --- */}
      {view === "admin" && (
        <>
          {/* Tarjetas Rápidas */}
          <div className="grid-cards">
            <div style={cardStyle("#22c55e")}>
              <span style={{fontSize: '0.8rem', color: '#64748b'}}>Ventas Hoy</span>
              <div style={{fontSize: '1.4rem', fontWeight: 'bold'}}>${closedOrders.reduce((s,o)=>s+o.total,0)}</div>
            </div>
            <div style={cardStyle("#3b82f6")}>
              <span style={{fontSize: '0.8rem', color: '#64748b'}}>Mesas Ocupadas</span>
              <div style={{fontSize: '1.4rem', fontWeight: 'bold'}}>{tables.filter(t=>t.status==="occupied").length}/{tables.length}</div>
            </div>
            <div style={cardStyle("#ef4444")}>
              <span style={{fontSize: '0.8rem', color: '#64748b'}}>En Cocina</span>
              <div style={{fontSize: '1.4rem', fontWeight: 'bold'}}>{orders.filter(o=>o.status==="open").length}</div>
            </div>
          </div>

          {/* Menú de Pestañas Admin */}
          <div style={{ display: 'flex', background: 'white', borderRadius: '10px', padding: '5px', marginBottom: '20px', overflowX: 'auto' }}>
            <button className={`tab-btn ${adminTab === 'monitor' ? 'active' : ''}`} onClick={() => setAdminTab('monitor')}>Monitor</button>
            <button className={`tab-btn ${adminTab === 'productos' ? 'active' : ''}`} onClick={() => setAdminTab('productos')}>Menú/Precios</button>
            <button className={`tab-btn ${adminTab === 'bodega' ? 'active' : ''}`} onClick={() => setAdminTab('bodega')}>Bodega</button>
            <button className={`tab-btn ${adminTab === 'historial' ? 'active' : ''}`} onClick={() => setAdminTab('historial')}>Historial/Corte</button>
          </div>

          {/* Contenido de Pestañas */}
          {adminTab === 'monitor' && (
            <div className="main-grid">
              <div style={sectionStyle}>
                <h3>Monitor de Mesas</h3>
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
              <h3>Control de Bodega (Insumos)</h3>
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
                <h3>Historial de Ventas (Día Actual)</h3>
                <button onClick={() => setShowConfirm({ show: true, msg: "¿Cerrar caja y archivar ventas?", action: runCashCut })} style={{background: '#000', color: 'white', padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold'}}>CORTE DE CAJA</button>
              </div>
              <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                {closedOrders.length === 0 ? <p>No hay cobros registrados hoy.</p> : closedOrders.map(o => (
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
                <span style={{fontSize: '0.9rem'}}>TOTAL ACUMULADO:</span>
                <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>${closedOrders.reduce((s,o)=>s+o.total,0)}</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- VISTA MESERO (RESTRUCTURADA PARA RESPONSIVE) --- */}
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
                    <h4 style={{marginTop: 0}}>🛒 Nuevo Pedido</h4>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '5px' }}>
                        <span>{item.quantity}x {item.name}</span>
                        <button onClick={() => setCart(cart.filter(i=>i.id!==item.id))} style={{color: 'red', border: 'none', background: 'none'}}>x</button>
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
            {!activeOrder && <p style={{color: '#94a3b8'}}>Mesa libre o sin consumos activos.</p>}
            {activeOrder && (
              <div>
                {activeOrder.status === 'ready' && (
                  <div style={{ background: "#fff3cd", border: "2px solid #fbbf24", padding: "15px", borderRadius: "10px", marginBottom: "15px" }}>
                    <p style={{ margin: "0 0 5px 0", fontWeight: "bold" }}>🔔 ¡PLATOS LISTOS!</p>
                    <button onClick={() => markDelivered(activeOrder.id)} style={{ width: "100%", background: "#fbbf24", border: "none", padding: "10px", borderRadius: "5px", fontWeight: 'bold' }}>MARCAR COMO ENTREGADO</button>
                  </div>
                )}
                <div style={{ marginBottom: "20px" }}>
                  {activeOrder.order_items.map((oi, i) => (
                    <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid #f1f5f9", display: 'flex', justifyContent: 'space-between' }}>
                      <span>{oi.quantity}x {oi.products?.name}</span>
                      <span>${oi.price * oi.quantity}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e', textAlign: 'right', marginBottom: '15px' }}>Total: ${activeOrder.total}</div>
                <button onClick={() => setShowConfirm({ show: true, msg: "¿Cobrar Mesa " + selectedTable.number + "?", action: closeOrder })} style={{ width: "100%", background: "#22c55e", color: "white", border: "none", padding: "15px", borderRadius: "10px", fontWeight: 'bold', fontSize: '1.1rem' }}>COBRAR CUENTA</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- VISTA COCINA --- */}
      {view === "cocina" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
          {orders.filter(o => o.status === "open").map(o => (
            <div key={o.id} style={{...sectionStyle, borderTop: '6px solid #3b82f6'}}>
              <h2 style={{marginTop: 0}}>Mesa {o.tables?.number}</h2>
              <div style={{marginBottom: '15px'}}>
                {o.order_items.filter(oi => oi.is_new).map((oi, i) => (
                  <div key={i} style={{fontSize: '1.2rem', padding: '5px 0', borderBottom: '1px dashed #eee'}}>
                    <b>{oi.quantity}x</b> {oi.products?.name}
                  </div>
                ))}
              </div>
              <button onClick={async () => { await supabase.from("orders").update({ status: "ready" }).eq("id", o.id); getData(); notify("Orden terminada"); }} style={{ width: "100%", background: "#22c55e", color: "white", border: "none", padding: "15px", borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>ORDEN LISTA</button>
            </div>
          ))}
          {orders.filter(o => o.status === "open").length === 0 && (
            <div style={{textAlign: 'center', gridColumn: '1/-1', padding: '50px', color: '#94a3b8'}}>
              <h1>📭 Sin pedidos pendientes</h1>
            </div>
          )}
        </div>
      )}

      {/* Modal Edición Producto */}
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

      {/* Botón Flotante para Admin (Cambio de Vista) */}
      {isAdmin && (
        <button onClick={() => setView(view === "admin" ? "mesero" : "admin")} style={{ position: "fixed", bottom: "25px", right: "25px", width: '65px', height: '65px', borderRadius: "50%", background: "#1e293b", color: "white", border: "none", fontSize: "28px", cursor: "pointer", boxShadow: '0 6px 15px rgba(0,0,0,0.4)', zIndex: 100 }}>
          {view === "admin" ? "🪑" : "📊"}
        </button>
      )}
    </div>
  );
}

// Estilos Reutilizables
const cardStyle = (color) => ({ background: "#fff", padding: "15px", borderRadius: "12px", borderLeft: `6px solid ${color}`, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" });
const sectionStyle = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", marginBottom: "20px" };
const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', flex: 1 };
const thStyle = { padding: '12px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.85rem' };
const tdStyle = { padding: '12px', fontSize: '0.9rem' };

export default App;