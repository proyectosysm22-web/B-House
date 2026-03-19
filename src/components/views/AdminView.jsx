import { cardStyle, inputStyle, sectionStyle, tdStyle, thStyle } from "../../styles/uiStyles";

export default function AdminView({
  closedOrders,
  tables,
  orders,
  adminTab,
  setAdminTab,
  totalTablesInput,
  setTotalTablesInput,
  updateTableCount,
  products,
  newP,
  setNewP,
  addProduct,
  toggleProductStatus,
  setEditingProduct,
  setEditPrice,
  setEditStock,
  warehouse,
  newW,
  setNewW,
  addWarehouseItem,
  setShowConfirm,
  runCashCut,
  searchTerm,
  setSearchTerm,
}) {
  return (
    <>
      <div className="grid-cards">
        <div style={cardStyle("#22c55e")}>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Ventas Hoy</span>
          <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>${closedOrders.reduce((s, o) => s + o.total, 0)}</div>
        </div>
        <div style={cardStyle("#3b82f6")}>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Mesas Ocupadas</span>
          <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>
            {tables.filter((t) => t.status === "occupied").length}/{tables.length}
          </div>
        </div>
        <div style={cardStyle("#ef4444")}>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>En Cocina</span>
          <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>{orders.filter((o) => o.status === "open").length}</div>
        </div>
      </div>

      <div style={{ display: "flex", background: "white", borderRadius: "10px", padding: "5px", marginBottom: "20px", overflowX: "auto" }}>
        <button className={`tab-btn ${adminTab === "monitor" ? "active" : ""}`} onClick={() => setAdminTab("monitor")}>Monitor</button>
        <button className={`tab-btn ${adminTab === "productos" ? "active" : ""}`} onClick={() => setAdminTab("productos")}>Menu/Precios</button>
        <button className={`tab-btn ${adminTab === "bodega" ? "active" : ""}`} onClick={() => setAdminTab("bodega")}>Bodega</button>
        <button className={`tab-btn ${adminTab === "historial" ? "active" : ""}`} onClick={() => setAdminTab("historial")}>Historial/Corte</button>
        <button className={`tab-btn ${adminTab === "auditoria" ? "active" : ""}`} onClick={() => setAdminTab("auditoria")}>Auditoria Global</button>
      </div>

      {adminTab === "monitor" && (
        <div className="main-grid">
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3>Monitor de Mesas</h3>
              <div style={{ textAlign: "right" }}>
                <small style={{ display: "block", color: "#64748b" }}>Control de Mesas</small>
                <input type="number" value={totalTablesInput} onChange={(e) => setTotalTablesInput(e.target.value)} style={{ ...inputStyle, width: "60px", padding: "5px" }} />
                <button onClick={updateTableCount} style={{ marginLeft: "5px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", padding: "5px 10px", fontSize: "12px" }}>Guardar</button>
              </div>
            </div>
            {tables
              .filter((t) => t.status === "occupied")
              .map((t) => {
                const o = orders.find((ord) => ord.table_id === t.id && ord.status !== "archived" && ord.status !== "closed");
                return (
                  <div key={t.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "10px 0", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <strong style={{ display: "block" }}>Mesa {t.number}</strong>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{o?.order_items.map((oi) => `${oi.quantity} ${oi.products?.name}`).join(", ")}</span>
                    </div>
                    <span style={{ fontWeight: "bold", color: "#22c55e" }}>${o?.total || 0}</span>
                  </div>
                );
              })}
          </div>
          <div style={sectionStyle}>
            <h3 style={{ color: "#ef4444" }}>Alertas Stock Bajo</h3>
            {products
              .filter((p) => p.stock < 10)
              .map((p) => (
                <div key={p.id} style={{ fontSize: "0.9rem", padding: "8px", background: "#fef2f2", marginBottom: "5px", borderRadius: "6px", borderLeft: "4px solid #ef4444" }}>
                  {p.name}: <b>{p.stock} unidades</b>
                </div>
              ))}
          </div>
        </div>
      )}

      {adminTab === "productos" && (
        <div style={sectionStyle}>
          <h3>Gestion de Menu</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px", padding: "15px", background: "#f8fafc", borderRadius: "10px" }}>
            <input type="text" placeholder="Nombre" value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} style={inputStyle} />
            <input type="number" placeholder="Precio" value={newP.price} onChange={(e) => setNewP({ ...newP, price: e.target.value })} style={{ ...inputStyle, width: "100px" }} />
            <input type="number" placeholder="Stock" value={newP.stock} onChange={(e) => setNewP({ ...newP, stock: e.target.value })} style={{ ...inputStyle, width: "100px" }} />
            <button onClick={addProduct} style={{ background: "#3b82f6", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold" }}>+ Anadir Producto</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc", textAlign: "left" }}>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={tdStyle}>${p.price}</td>
                    <td style={tdStyle}>{p.stock}</td>
                    <td style={tdStyle}>{p.is_active ? "Activo" : "Oculto"}</td>
                    <td style={tdStyle}>
                      <button onClick={() => toggleProductStatus(p)} style={{ marginRight: "5px", padding: "5px", borderRadius: "4px", border: "1px solid #ccc" }}>
                        {p.is_active ? "Ocultar" : "Mostrar"}
                      </button>
                      <button onClick={() => { setEditingProduct(p); setEditPrice(p.price); setEditStock(p.stock); }} style={{ padding: "5px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px" }}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminTab === "bodega" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3>Control de Bodega (Insumos)</h3>
            <div style={{ background: "#1e293b", color: "white", padding: "8px 15px", borderRadius: "8px", fontWeight: "bold" }}>
              Total Bodega: ${warehouse.reduce((s, i) => s + i.quantity * i.unit_cost, 0)}
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px", padding: "15px", background: "#f8fafc", borderRadius: "10px" }}>
            <input type="text" placeholder="Insumo" value={newW.name} onChange={(e) => setNewW({ ...newW, name: e.target.value })} style={inputStyle} />
            <input type="number" placeholder="Cantidad" value={newW.quantity} onChange={(e) => setNewW({ ...newW, quantity: e.target.value })} style={{ ...inputStyle, width: "100px" }} />
            <input type="number" placeholder="Costo Unit." value={newW.unit_cost} onChange={(e) => setNewW({ ...newW, unit_cost: e.target.value })} style={{ ...inputStyle, width: "100px" }} />
            <button onClick={addWarehouseItem} style={{ background: "#22c55e", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold" }}>Guardar Insumo</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc", textAlign: "left" }}>
              <tr>
                <th style={thStyle}>Insumo</th>
                <th style={thStyle}>Stock</th>
                <th style={thStyle}>Costo</th>
                <th style={thStyle}>Valor</th>
                <th style={thStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {warehouse.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>{item.quantity}</td>
                  <td style={tdStyle}>${item.unit_cost}</td>
                  <td style={tdStyle}>${item.quantity * item.unit_cost}</td>
                  <td style={tdStyle}>{item.quantity <= item.min_stock ? <span style={{ color: "red" }}>Bajo</span> : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adminTab === "historial" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3>Historial de Ventas (Turno Actual)</h3>
            <button onClick={() => setShowConfirm({ show: true, msg: "Cerrar caja y archivar ventas?", action: runCashCut })} style={{ background: "#000", color: "white", padding: "10px 15px", borderRadius: "8px", border: "none", fontWeight: "bold" }}>
              CORTE DE CAJA
            </button>
          </div>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {closedOrders.length === 0 ? <p>No hay cobros registrados en este turno.</p> : closedOrders.map((o) => (
              <div key={o.id} style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: "bold" }}>Mesa {o.tables?.number}</span>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{o.order_items.map((oi) => `${oi.quantity}x ${oi.products?.name}`).join(", ")}</div>
                </div>
                <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>${o.total}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "20px", padding: "15px", background: "#22c55e", color: "white", borderRadius: "10px", textAlign: "right" }}>
            <span style={{ fontSize: "0.9rem" }}>TOTAL TURNO ACTUAL:</span>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold" }}>${closedOrders.reduce((s, o) => s + o.total, 0)}</div>
          </div>
        </div>
      )}

      {adminTab === "auditoria" && (
        <div style={sectionStyle}>
          <h3>Auditoria (Ventas Archivadas)</h3>
          <div style={{ marginBottom: "20px" }}>
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc", textAlign: "left" }}>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Mesa</th>
                  <th style={thStyle}>Usuario</th>
                  <th style={thStyle}>Productos</th>
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter((o) => o.status === "archived" && (searchTerm === "" || o.created_at.includes(searchTerm) || o.waiter_email?.toLowerCase().includes(searchTerm.toLowerCase()) || o.order_items.some((oi) => oi.products?.name.toLowerCase().includes(searchTerm.toLowerCase()))))
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={tdStyle}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td style={tdStyle}>Mesa {o.tables?.number}</td>
                      <td style={tdStyle}><small style={{ color: "#3b82f6" }}>{o.waiter_email || "N/A"}</small></td>
                      <td style={tdStyle}><div style={{ fontSize: "0.8rem", color: "#64748b" }}>{o.order_items.map((oi) => `${oi.quantity}x ${oi.products?.name}`).join(", ")}</div></td>
                      <td style={{ ...tdStyle, fontWeight: "bold" }}>${o.total}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
