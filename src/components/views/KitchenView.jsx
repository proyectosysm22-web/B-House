import { sectionStyle } from "../../styles/uiStyles";
import { getGroupedItems } from "../../utils/orderUtils";

function normalizeCategory(rawCategory) {
  const value = String(rawCategory || "comida").toLowerCase().trim();
  if (value === "bebida" || value === "bebidas") return "bebida";
  if (value === "ceramica" || value === "ceramicas") return "ceramica";
  return "comida";
}

export default function KitchenView({ orders, markOrderReady }) {
  const kitchenOrders = orders.filter((order) => {
    if (order.status !== "open") return false;
    return order.order_items?.some(
      (item) => item.is_new && normalizeCategory(item.products?.category) === "comida",
    );
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
      {kitchenOrders.length === 0 && (
        <div style={{ ...sectionStyle }}>
          <h3 style={{ marginTop: 0 }}>Sin pendientes de cocina</h3>
          <p style={{ color: "#64748b", marginBottom: 0 }}>
            Solo aparecen pedidos con productos de comida pendientes.
          </p>
        </div>
      )}
      {kitchenOrders.map((o) => (
          <div key={o.id} style={{ ...sectionStyle, borderTop: "6px solid #3b82f6" }}>
            <h2 style={{ marginTop: 0 }}>Mesa {o.tables?.number}</h2>
            {getGroupedItems(
              o.order_items.filter(
                (oi) => oi.is_new && normalizeCategory(oi.products?.category) === "comida",
              ),
            ).map((oi, i) => (
              <div key={i} style={{ fontSize: "1.2rem", padding: "5px 0", borderBottom: "1px dashed #eee" }}>
                <b>{oi.quantity}x</b> {oi.products?.name}
              </div>
            ))}
            <button onClick={() => markOrderReady(o.id)} style={{ width: "100%", background: "#22c55e", color: "white", border: "none", padding: "15px", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", marginTop: "10px" }}>
              ORDEN LISTA
            </button>
          </div>
        ))}
    </div>
  );
}
