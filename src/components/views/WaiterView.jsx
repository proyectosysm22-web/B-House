import { useMemo, useState } from "react";
import { sectionStyle } from "../../styles/uiStyles";
import { getGroupedItems } from "../../utils/orderUtils";

export default function WaiterView({
  tables,
  orders,
  selectedTable,
  setSelectedTable,
  setCart,
  products,
  cart,
  addToCart,
  removeFromCart,
  saveOrder,
  activeOrder,
  markDelivered,
}) {
  const [menuTab, setMenuTab] = useState("comida");
  const menuProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.is_active &&
          product.stock > 0 &&
          (product.category || "comida") === menuTab,
      ),
    [products, menuTab],
  );

  return (
    <div className="main-grid">
      <div style={sectionStyle}>
        <h3>Seleccionar Mesa</h3>
        <div className="table-btn-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "20px" }}>
          {tables.map((t) => {
            const isReady = orders.some((ord) => ord.table_id === t.id && ord.status === "ready");
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTable(t);
                  setCart([]);
                }}
                className={isReady ? "blink-ready" : ""}
                style={{
                  padding: "15px 5px",
                  background: selectedTable?.id === t.id ? "#22c55e" : t.status === "occupied" ? "#ef4444" : "#cbd5e1",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Mesa {t.number} {isReady ? "!" : ""}
              </button>
            );
          })}
        </div>
        {selectedTable && (
          <>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
              {[
                { value: "comida", label: "Menu Disponible" },
                { value: "bebida", label: "Bebidas" },
                { value: "ceramica", label: "Ceramicas" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setMenuTab(tab.value)}
                  style={{
                    borderRadius: "999px",
                    border: menuTab === tab.value ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: menuTab === tab.value ? "#dbeafe" : "white",
                    fontWeight: "bold",
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "20px" }}>
              {menuProducts.map((p) => (
                <div key={p.id} style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{p.name} (${p.price})</span>
                  <button onClick={() => addToCart(p)} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "5px", padding: "5px 12px", fontWeight: "bold" }}>
                    +
                  </button>
                </div>
              ))}
              {menuProducts.length === 0 && (
                <div style={{ color: "#64748b", padding: "8px 2px", fontSize: "14px" }}>
                  No hay productos activos en esta categoria.
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div style={{ background: "#f8fafc", padding: "15px", borderRadius: "10px" }}>
                <h4 style={{ marginTop: 0 }}>Carrito</h4>
                {cart.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "0.9rem", alignItems: "center" }}>
                    <span>{item.quantity}x {item.name}</span>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", color: "#ef4444", fontWeight: "bold", cursor: "pointer", padding: "5px" }}>
                      X
                    </button>
                  </div>
                ))}
                <button onClick={saveOrder} style={{ width: "100%", background: "#3b82f6", color: "white", border: "none", padding: "12px", marginTop: "10px", borderRadius: "8px", fontWeight: "bold" }}>
                  ENVIAR A COCINA
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Mesa {selectedTable?.number || "--"}</h3>
        {activeOrder && (
          <div>
            {(activeOrder.status === "open" || activeOrder.status === "ready") && (
              <div style={{ marginBottom: "12px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: "8px", padding: "8px 10px", fontSize: "13px" }}>
                Aun no se ha entregado la orden completa de esta mesa.
              </div>
            )}
            {activeOrder.status === "ready" && (
              <div style={{ background: "#fff3cd", border: "2px solid #fbbf24", padding: "15px", borderRadius: "10px", marginBottom: "15px" }}>
                <p style={{ margin: "0 0 5px 0", fontWeight: "bold", color: "#856404" }}>LISTO PARA SERVIR</p>
                <div style={{ marginBottom: "10px", fontSize: "0.9rem" }}>
                  <strong>Debes llevar:</strong>
                  <br />
                  {getGroupedItems(activeOrder.order_items.filter((oi) => oi.is_new)).map((oi, idx) => (
                    <div key={idx}>- {oi.quantity}x {oi.products?.name}</div>
                  ))}
                </div>
                <button onClick={() => markDelivered(activeOrder.id)} style={{ width: "100%", background: "#fbbf24", border: "none", padding: "10px", borderRadius: "5px", fontWeight: "bold" }}>
                  MARCAR COMO ENTREGADO
                </button>
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              {getGroupedItems(activeOrder.order_items).map((oi, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold" }}>{oi.quantity}x {oi.products?.name}</div>
                    <small style={{ color: oi.is_new ? "#3b82f6" : "#64748b" }}>{oi.is_new ? "(En Cocina)" : "(Servido)"}</small>
                  </div>
                  <span style={{ fontWeight: "bold" }}>${oi.price * oi.quantity}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#22c55e", textAlign: "right", marginBottom: "15px" }}>Total: ${activeOrder.total}</div>
            <div style={{ width: "100%", background: "#0f172a", color: "white", border: "none", padding: "14px", borderRadius: "10px", fontWeight: "bold", fontSize: "1rem", textAlign: "center" }}>
              COBRO SOLO EN CAJA
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
