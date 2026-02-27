import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";

function App() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("mesero");
  const [closedOrders, setClosedOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [newTablesCount, setNewTablesCount] = useState(0);

  // --- NUEVOS ESTADOS PARA BODEGA ---
  const [warehouse, setWarehouse] = useState([]);
  const [newW, setNewW] = useState({ name: "", quantity: "", unit_cost: "", min_stock: "" });
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  // Estados UI
  const [editingProduct, setEditingProduct] = useState(null);
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [notification, setNotification] = useState({ show: false, msg: "", type: "success" });
  const [showConfirm, setShowConfirm] = useState({ show: false, action: null, msg: "" });

  // Estado para Nuevo Producto
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
      const order = orders.find(o => o.table_id === selectedTable.id && (o.status !== 'closed' && o.status !== 'archived'));
      setActiveOrder(order);
    } else {
      setActiveOrder(null);
    }
  }, [selectedTable, orders]);

  async function getData() {
    const { data: p } = await supabase.from("products").select("*").order('name', { ascending: true });
    const { data: t } = await supabase.from("tables").select("*").order('number', { ascending: true });
    const { data: o } = await supabase.from("orders").select(`*, tables(number), order_items(id, product_id, quantity, price, is_new, products(name))`).in('status', ['open', 'ready', 'delivered', 'archived']);
    const { data: co } = await supabase.from("orders").select(`*, order_items(quantity, price, products(name))`).eq('status', 'closed');
    const { data: w } = await supabase.from("warehouse").select("*").order('name', { ascending: true });
    
    setProducts(p || []);
    setTables(t || []);
    setOrders(o || []);
    setClosedOrders(co || []);
    setWarehouse(w || []);
    if (t) setNewTablesCount(t.length);
  }

  function notify(msg, type = "success") {
    setNotification({ show: true, msg, type });
    setTimeout(() => setNotification({ show: false, msg: "", type: "success" }), 3000);
  }

  async function runCashCut() {
    const totalHoy = closedOrders.reduce((s, o) => s + o.total, 0);
    if (totalHoy === 0) return notify("No hay ventas para archivar", "error");
    const { error } = await supabase.from("orders").update({ status: 'archived' }).eq('status', 'closed');
    if (!error) {
      notify("Corte de caja guardado");
      getData();
    }
    setShowConfirm({ show: false });
  }

  async function addWarehouseItem() {
    if (!newW.name || !newW.quantity) return notify("Nombre y Cantidad obligatorios", "error");
    await supabase.from("warehouse").insert([{ 
      name: newW.name, 
      quantity: parseInt(newW.quantity), 
      unit_cost: parseFloat(newW.unit_cost || 0), 
      min_stock: parseInt(newW.min_stock || 0) 
    }]);
    setNewW({ name: "", quantity: "", unit_cost: "", min_stock: "" });
    notify("Insumo agregado a Bodega");
    getData();
  }

  async function updateWarehouseItem() {
    await supabase.from("warehouse").update({
      name: editingWarehouse.name,
      quantity: parseInt(editingWarehouse.quantity),
      unit_cost: parseFloat(editingWarehouse.unit_cost),
      min_stock: parseInt(editingWarehouse.min_stock)
    }).eq("id", editingWarehouse.id);
    setEditingWarehouse(null);
    notify("Bodega actualizada");
    getData();
  }

  async function deleteWarehouseItem(id) {
    await supabase.from("warehouse").delete().eq("id", id);
    notify("Insumo eliminado");
    setShowConfirm({ show: false });
    getData();
  }

  async function addProduct() {
    if (!newP.name || !newP.price) return notify("Nombre y Precio obligatorios", "error");
    await supabase.from("products").insert([{ name: newP.name, price: parseFloat(newP.price), stock: parseInt(newP.stock || 0), is_active: true }]);
    setNewP({ name: "", price: "", stock: "" });
    notify("Producto añadido");
    getData();
  }

  async function toggleProductStatus(product) {
    await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id);
    notify(product.is_active ? "Producto ocultado" : "Producto visible");
    getData();
  }

  async function handleUpdateProduct() {
    await supabase.from("products").update({ price: parseFloat(editPrice), stock: parseInt(editStock) }).eq("id", editingProduct.id);
    setEditingProduct(null);
    notify("Producto actualizado");
    getData();
  }

  function addToCart(product) {
    if (!product.is_active || product.stock <= 0) return notify("Sin stock", "error");
    const item = cart.find(i => i.id === product.id);
    if (item && item.quantity + 1 > product.stock) return notify("Stock insuficiente", "error");
    if (item) setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    else setCart([...cart, { ...product, quantity: 1 }]);
  }

  async function saveOrder() {
    if (!selectedTable || cart.length === 0) return;
    for (const item of cart) {
      const { data: p } = await supabase.from("products").select("stock").eq("id", item.id).single();
      await supabase.from("products").update({ stock: p.stock - item.quantity }).eq("id", item.id);
    }
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
    }
    setCart([]); 
    getData();
    notify("Pedido enviado");
  }

  async function markDelivered(id) {
    await supabase.from("order_items").update({ is_new: false }).eq("order_id", id);
    await supabase.from("orders").update({ status: "delivered" }).eq("id", id);
    getData();
    notify("Pedido entregado");
  }

  async function closeOrder() {
    if (activeOrder.status === 'open') return notify("No puedes cobrar: hay productos pendientes en cocina", "error");
    if (activeOrder.status === 'ready') return notify("No puedes cobrar: tienes productos listos por entregar", "error");
    await supabase.from("orders").update({ status: "closed" }).eq("id", activeOrder.id);
    await supabase.from("tables").update({ status: "free" }).eq("id", selectedTable.id);
    setSelectedTable(null);
    getData();
    notify("Cuenta cobrada");
    setShowConfirm({ show: false });
  }

  if (!session) return <Login />;
  const isAdmin = session.user.email.toLowerCase().includes("admin");

  return (
    <div className="main-container" style={{ padding: "10px", fontFamily: "'Inter', sans-serif", backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      
      <style>{`
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .blink-ready { animation: blink 1s infinite; background-color: #fbbf24 !important; color: black !important; }
        
        /* AJUSTES RESPONSIVOS */
        .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .grid-main { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        .grid-tables { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; margin-bottom: 20px; }
        .grid-menu { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .table-wrapper { width: 100%; overflow-x: auto; }
        
        @media (max-width: 768px) {
          .grid-main { grid-template-columns: 1fr !important; }
          .grid-menu { grid-template-columns: 1fr !important; }
          .nav-header { flex-direction: column; gap: 10px; text-align: center; }
          .grid-stats { grid-template-columns: 1fr 1fr; }
          .hide-mobile { display: none; }
          input, button { font-size: 14px !important; }
          .section-card { padding: 15px !important; }
        }
      `}</style>

      {notification.show && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', padding: '15px 25px', borderRadius: '10px', background: notification.type === 'success' ? '#22c55e' : '#ef4444', color: 'white', zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', fontWeight: 'bold' }}>
          {notification.msg}
        </div>
      )}

      {showConfirm.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '320px', textAlign: 'center' }}>
            <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{showConfirm.msg}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowConfirm({ show: false })} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc', cursor: 'pointer' }}>No</button>
              <button onClick={showConfirm.action} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Sí</button>
            </div>
          </div>
        </div>
      )}

      <nav className="nav-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", color: "white", padding: "12px 20px", borderRadius: "12px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🍟 B-House</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: 'wrap', justifyContent: 'center' }}>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setView("admin")} style={{ background: view === "admin" ? "#3b82f6" : "transparent", color: "white", border: "1px solid white", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: '12px' }}>Monitor</button>
              <button onClick={() => setView("ajustes")} style={{ background: view === "ajustes" ? "#3b82f6" : "transparent", color: "white", border: "1px solid white", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: '12px' }}>Ventas</button>
              <button onClick={() => setView("bodega")} style={{ background: view === "bodega" ? "#3b82f6" : "transparent", color: "white", border: "1px solid white", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: '12px' }}>Bodega</button>
            </div>
          )}
          <button onClick={() => supabase.auth.signOut()} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", fontWeight: "bold", fontSize: '12px' }}>Salir</button>
        </div>
      </nav>

      {isAdmin && view === "bodega" && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div style={sectionStyle} className="section-card">
            <h3>Añadir Insumo</h3>
            <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
              <input type="text" placeholder="Nombre" value={newW.name} onChange={e => setNewW({...newW, name: e.target.value})} style={{padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: '1 1 100%'}} />
              <input type="number" placeholder="Cant." value={newW.quantity} onChange={e => setNewW({...newW, quantity: e.target.value})} style={{padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: 1}} />
              <input type="number" placeholder="Costo" value={newW.unit_cost} onChange={e => setNewW({...newW, unit_cost: e.target.value})} style={{padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: 1}} />
              <button onClick={addWarehouseItem} style={{background: '#22c55e', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', width: '100%'}}>GUARDAR</button>
            </div>
          </div>
          <div style={sectionStyle} className="section-card">
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
              <h3>Bodega</h3>
              <div style={{fontWeight: 'bold', background: '#f8fafc', padding: '5px 10px', borderRadius: '10px', fontSize: '12px'}}>Total: ${warehouse.reduce((s,i)=>s+(i.quantity*i.unit_cost),0)}</div>
            </div>
            <div className="table-wrapper">
              <table style={{ width: "100%", borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead style={{textAlign: 'left', background: '#f8fafc'}}><tr><th style={{padding: '10px'}}>Insumo</th><th>Stock</th><th className="hide-mobile">Costo</th><th>Acciones</th></tr></thead>
                <tbody>
                  {warehouse.map(item => (
                    <tr key={item.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                      <td style={{padding: '10px'}}>{item.name} {item.quantity <= item.min_stock && "⚠️"}</td>
                      <td>{item.quantity}</td>
                      <td className="hide-mobile">${item.unit_cost}</td>
                      <td><button onClick={() => setEditingWarehouse(item)} style={{background: '#3b82f6', color: '#fff', border: 'none', padding: '5px', borderRadius: '4px'}}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isAdmin && view === "admin" && (
        <div>
          <div className="grid-stats">
            <div style={cardStyle("#22c55e")}><h3>Cobrado</h3><p style={statStyle}>${closedOrders.reduce((s,o)=>s+o.total,0)}</p><button onClick={() => setShowConfirm({ show: true, msg: "¿Corte?", action: runCashCut })} style={{fontSize: '10px', padding: '5px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px'}}>CORTE</button></div>
            <div style={cardStyle("#f59e0b")}><h3>En Mesas</h3><p style={statStyle}>${orders.filter(o=>o.status!=='archived').reduce((s,o)=>s+o.total,0)}</p></div>
            <div style={cardStyle("#3b82f6")}><h3>Ocupado</h3><p style={statStyle}>{tables.filter(t=>t.status==="occupied").length}/{tables.length}</p></div>
            <div style={cardStyle("#ef4444")}><h3>Cocina</h3><p style={statStyle}>{orders.filter(o=>o.status==="open").length}</p></div>
          </div>
          <div className="grid-main">
            <div style={sectionStyle} className="section-card">
              <h3>Monitor</h3>
              {tables.filter(t=>t.status==='occupied').map(t => {
                const o = orders.find(ord=>ord.table_id===t.id && ord.status !== 'archived');
                return (
                  <div key={t.id} style={{ borderBottom: "1px solid #e2e8f0", padding: "10px 0" }}>
                    <strong>Mesa {t.number} - <span style={{color: '#22c55e'}}>${o?.total}</span></strong>
                    <div style={{fontSize: '0.8rem', color: '#64748b'}}>{o?.order_items.map((oi, i) => <span key={i}>{oi.quantity}x {oi.products?.name} </span>)}</div>
                  </div>
                );
              })}
            </div>
            <div style={sectionStyle} className="section-card"><h3 style={{color: '#ef4444'}}>Stock Bajo</h3>{products.filter(p => p.stock < 10).map(p => <div key={p.id} style={{fontSize: '0.9rem', marginBottom: '5px'}}>⚠️ {p.name}: {p.stock}</div>)}</div>
          </div>
        </div>
      )}

      {isAdmin && view === "ajustes" && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div style={sectionStyle} className="section-card">
            <h3>Nuevo Producto</h3>
            <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
              <input type="text" placeholder="Nombre" value={newP.name} onChange={e => setNewP({...newP, name: e.target.value})} style={{padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: '1 1 100%'}} />
              <input type="number" placeholder="Precio" value={newP.price} onChange={e => setNewP({...newP, price: e.target.value})} style={{padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: 1}} />
              <input type="number" placeholder="Stock" value={newP.stock} onChange={e => setNewP({...newP, stock: e.target.value})} style={{padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: 1}} />
              <button onClick={addProduct} style={{background: '#22c55e', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', width: '100%'}}>+ AÑADIR</button>
            </div>
          </div>
          <div style={sectionStyle} className="section-card">
            <h3>Inventario</h3>
            <div className="table-wrapper">
              <table style={{ width: "100%", borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead style={{textAlign: 'left', background: '#f8fafc'}}><tr><th style={{padding: '10px'}}>Producto</th><th>Stock</th><th>Acciones</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={{borderBottom: '1px solid #f1f5f9', opacity: p.is_active && p.stock > 0 ? 1 : 0.5}}>
                      <td style={{padding: '10px'}}>{p.name}<br/><small>${p.price}</small></td>
                      <td>{p.stock}</td>
                      <td>
                        <div style={{display: 'flex', gap: '5px'}}>
                          <button onClick={() => toggleProductStatus(p)} style={{border: 'none', background: p.is_active ? '#64748b' : '#22c55e', color: '#fff', borderRadius: '4px', padding: '5px', fontSize: '10px'}}>{p.is_active ? "Off" : "On"}</button>
                          <button onClick={() => { setEditingProduct(p); setEditPrice(p.price); setEditStock(p.stock); }} style={{border: 'none', background: '#3b82f6', color: '#fff', borderRadius: '4px', padding: '5px'}}>📝</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === "mesero" && (
        <div className="grid-main">
          <div style={sectionStyle} className="section-card">
            <div className="grid-tables">
              {tables.map(t => {
                const o = orders.find(ord => ord.table_id === t.id && ord.status === 'ready');
                return (
                  <button key={t.id} onClick={() => {setSelectedTable(t); setCart([]);}} className={o ? "blink-ready" : ""} style={{ padding: "10px 5px", background: selectedTable?.id === t.id ? "#22c55e" : t.status === "occupied" ? "#ef4444" : "#cbd5e1", color: "white", border: "none", borderRadius: "8px", fontWeight: 'bold', fontSize: '11px' }}>
                    M{t.number} {o ? "🔔" : ""}
                  </button>
                );
              })}
            </div>
            {selectedTable && (
              <div className="grid-menu">
                <div>
                  <h4 style={{marginTop: 0}}>Menú</h4>
                  {products.filter(p => p.is_active && p.stock > 0).map(p => (
                    <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{fontSize: '14px'}}>{p.name} <small>(${p.price})</small></span>
                      <button onClick={() => addToCart(p)} style={{background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', width: '30px', height: '30px'}}>+</button>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                  <h4 style={{marginTop: 0}}>🛒 Carrito</h4>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', background: '#fff', padding: '5px', fontSize: '13px' }}>
                      <span>{item.quantity}x {item.name}</span>
                      <button onClick={() => setCart(cart.filter(i=>i.id!==item.id))} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px' }}>x</button>
                    </div>
                  ))}
                  {cart.length > 0 && <button onClick={saveOrder} style={{ width: "100%", background: "#3b82f6", color: "white", border: "none", padding: "10px", marginTop: "10px", borderRadius: "5px", fontWeight: "bold" }}>ENVIAR</button>}
                </div>
              </div>
            )}
          </div>

          <div style={sectionStyle} className="section-card">
            <h3>Mesa {selectedTable?.number || "?"}</h3>
            {activeOrder && (
              <div>
                {activeOrder.status === 'ready' && (
                  <div style={{ background: "#fff3cd", border: "2px solid #fbbf24", padding: "10px", borderRadius: "10px", marginBottom: "15px" }}>
                    <p style={{ margin: "0 0 5px 0", fontWeight: "bold", color: "#856404", fontSize: "12px" }}>PEDIDO LISTO:</p>
                    <button onClick={() => markDelivered(activeOrder.id)} style={{ width: "100%", background: "#fbbf24", color: "black", border: "none", padding: "10px", borderRadius: "8px", fontWeight: 'bold' }}>RECOGER</button>
                  </div>
                )}
                <div style={{ marginBottom: "10px", fontSize: '13px' }}>
                  {Object.values(
                    activeOrder.order_items.reduce((acc, item) => {
                      const name = item.products?.name;
                      if (!acc[name]) acc[name] = { name, quantity: 0, price: item.price };
                      acc[name].quantity += item.quantity;
                      return acc;
                    }, {})
                  ).map((groupedItem, i) => (
                    <div key={i} style={{ padding: "2px 0" }}>
                      {groupedItem.quantity}x {groupedItem.name} - ${groupedItem.price * groupedItem.quantity}
                    </div>
                  ))}
                </div>
                <hr/><h3 style={{color: '#22c55e', margin: '10px 0'}}>Total: ${activeOrder.total}</h3>
                <button onClick={() => setShowConfirm({ show: true, msg: "¿Cobrar Mesa " + selectedTable.number + "?", action: closeOrder })} style={{ width: "100%", background: "#22c55e", color: "white", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 'bold' }}>COBRAR</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "cocina" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" }}>
          {orders.filter(o => o.status === "open").map(o => (
            <div key={o.id} style={sectionStyle} className="section-card">
              <h4 style={{borderBottom: '2px solid #3b82f6', marginTop: 0}}>Mesa {o.tables?.number}</h4>
              {o.order_items.filter(oi => oi.is_new).map((oi, i) => (
                <div key={i} style={{fontWeight: 'bold', fontSize: '14px'}}>• {oi.quantity}x {oi.products?.name}</div>
              ))}
              <button onClick={async () => { await supabase.from("orders").update({ status: "ready" }).eq("id", o.id); getData(); notify("Listo"); }} style={{ width: "100%", background: "#22c55e", color: "white", border: "none", padding: "10px", marginTop: "10px", borderRadius: '5px' }}>LISTO</button>
            </div>
          ))}
        </div>
      )}

      {editingWarehouse && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '320px' }}>
            <h3>Editar Insumo</h3>
            <input type="text" value={editingWarehouse.name} onChange={e => setEditingWarehouse({...editingWarehouse, name: e.target.value})} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
            <input type="number" value={editingWarehouse.quantity} onChange={e => setEditingWarehouse({...editingWarehouse, quantity: e.target.value})} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditingWarehouse(null)} style={{ flex: 1, padding: '10px' }}>Cerrar</button>
              <button onClick={updateWarehouseItem} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '300px' }}>
            <h3>Editar {editingProduct.name}</h3>
            <label>Precio:</label><input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
            <label>Stock:</label><input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} style={{ width: '100%', marginBottom: '20px', padding: '8px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '10px' }}>Cerrar</button>
              <button onClick={handleUpdateProduct} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <button onClick={() => setView(view === "admin" || view === "ajustes" || view === "bodega" ? "mesero" : "admin")} style={{ position: "fixed", bottom: "20px", right: "20px", width: '50px', height: '50px', borderRadius: "50%", background: "#1e293b", color: "white", border: "none", fontSize: "20px", cursor: "pointer", boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000 }}>
          {view === "admin" || view === "ajustes" || view === "bodega" ? "🪑" : "📊"}
        </button>
      )}
    </div>
  );
}

const cardStyle = (color) => ({ background: "#fff", padding: "10px", borderRadius: "15px", borderTop: `6px solid ${color}`, textAlign: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" });
const statStyle = { fontSize: "1.2rem", fontWeight: "bold", margin: "5px 0" };
const sectionStyle = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", marginBottom: "20px" };

export default App;