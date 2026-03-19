import { useMemo, useState } from "react";
import { sectionStyle } from "../../styles/uiStyles";

function groupedBillItems(orderItems) {
  const grouped = {};
  orderItems.forEach((item) => {
    const key = `${item.product_id}-${item.price}`;
    if (!grouped[key]) {
      grouped[key] = {
        product_id: item.product_id,
        name: item.products?.name || "Producto",
        price: item.price,
        quantity: 0,
      };
    }
    grouped[key].quantity += item.quantity;
  });
  return Object.values(grouped);
}

export default function CashierView({ tables, orders, onChargeOrder, notify }) {
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");

  const payableOrders = useMemo(
    () => orders.filter((order) => ["open", "ready", "delivered"].includes(order.status)),
    [orders],
  );

  const payableTables = useMemo(
    () =>
      tables
        .map((table) => ({
          table,
          order: payableOrders.find((order) => order.table_id === table.id),
        }))
        .filter((item) => item.order),
    [tables, payableOrders],
  );

  const selectedEntry = payableTables.find((entry) => entry.table.id === selectedTableId) || null;
  const selectedOrder = selectedEntry?.order || null;
  const billItems = selectedOrder ? groupedBillItems(selectedOrder.order_items || []) : [];

  return (
    <div className="main-grid">
      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Caja - Mesas por cobrar</h3>
        {payableTables.length === 0 && <p style={{ color: "#64748b" }}>No hay mesas pendientes por cobrar.</p>}
        <div style={{ display: "grid", gap: "10px" }}>
          {payableTables.map(({ table, order }) => (
            <button
              key={table.id}
              onClick={() => setSelectedTableId(table.id)}
              style={{
                textAlign: "left",
                background: selectedTableId === table.id ? "#dbeafe" : "white",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "12px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Mesa {table.number}</strong>
                <span
                  style={{
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "999px",
                    background: order.status === "delivered" ? "#dcfce7" : "#fef3c7",
                    color: order.status === "delivered" ? "#166534" : "#92400e",
                  }}
                >
                  {order.status === "delivered" ? "Lista para cobro" : "En proceso"}
                </span>
              </div>
              <div style={{ marginTop: "6px", color: "#334155", fontSize: "14px" }}>
                Total actual: <strong>${order.total}</strong>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Detalle de cobro</h3>
        {!selectedOrder && <p style={{ color: "#64748b" }}>Selecciona una mesa para ver el detalle.</p>}
        {selectedOrder && (
          <>
            <div style={{ marginBottom: "10px", color: "#334155" }}>
              <strong>Mesa {selectedEntry.table.number}</strong> - Atendio: {selectedOrder.waiter_email || "N/A"}
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", marginBottom: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "#f8fafc", padding: "10px", fontWeight: "bold", fontSize: "13px" }}>
                <div>Producto</div>
                <div style={{ textAlign: "right" }}>Cant.</div>
                <div style={{ textAlign: "right" }}>Valor unit.</div>
                <div style={{ textAlign: "right" }}>Subtotal</div>
              </div>
              {billItems.map((item) => (
                <div key={`${item.product_id}-${item.price}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "10px", borderTop: "1px solid #f1f5f9", fontSize: "14px" }}>
                  <div>{item.name}</div>
                  <div style={{ textAlign: "right" }}>{item.quantity}</div>
                  <div style={{ textAlign: "right" }}>${item.price}</div>
                  <div style={{ textAlign: "right", fontWeight: "bold" }}>${item.price * item.quantity}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <button
                onClick={() => setPaymentMethod("efectivo")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: paymentMethod === "efectivo" ? "2px solid #16a34a" : "1px solid #cbd5e1",
                  background: paymentMethod === "efectivo" ? "#dcfce7" : "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Efectivo
              </button>
              <button
                onClick={() => setPaymentMethod("transferencia")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: paymentMethod === "transferencia" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                  background: paymentMethod === "transferencia" ? "#dbeafe" : "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Transferencia
              </button>
            </div>

            <div style={{ fontSize: "1.7rem", fontWeight: "bold", textAlign: "right", color: "#16a34a", marginBottom: "12px" }}>
              Total: ${selectedOrder.total}
            </div>

            <button
              onClick={() => {
                if (selectedOrder.status !== "delivered") {
                  notify("Aun no se puede cobrar: el pedido no esta entregado", "error");
                  return;
                }
                onChargeOrder(selectedOrder, paymentMethod);
              }}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background: selectedOrder.status === "delivered" ? "#16a34a" : "#94a3b8",
                color: "white",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              COBRAR MESA
            </button>
          </>
        )}
      </div>
    </div>
  );
}
