import { sectionStyle } from "../../styles/uiStyles";
import { getGroupedItems } from "../../utils/orderUtils";

export default function KitchenView({ orders, markOrderReady }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
      {orders
        .filter((o) => o.status === "open")
        .map((o) => (
          <div key={o.id} style={{ ...sectionStyle, borderTop: "6px solid #3b82f6" }}>
            <h2 style={{ marginTop: 0 }}>Mesa {o.tables?.number}</h2>
            {getGroupedItems(o.order_items.filter((oi) => oi.is_new)).map((oi, i) => (
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
