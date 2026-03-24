import { useMemo, useState } from "react";
import { sectionStyle } from "../../styles/uiStyles";
import logoMark from "../../assets/branding/logo-mark.png";

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
  const [lastInvoice, setLastInvoice] = useState(null);
  const [cashReceived, setCashReceived] = useState("");

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
  const orderTotal = Number(selectedOrder?.total || 0);
  const parsedCashReceived = Number(cashReceived || 0);
  const hasCashValue = cashReceived.trim() !== "";
  const cashChange = Math.max(parsedCashReceived - orderTotal, 0);
  const cashShortfall = paymentMethod === "efectivo" && hasCashValue ? Math.max(orderTotal - parsedCashReceived, 0) : 0;

  function printInvoice(invoice) {
    const issueDate = new Date(invoice.issued_at).toLocaleString();
    const itemRows = invoice.items
      .map(
        (item) =>
          `<tr><td>${item.product_name}</td><td style="text-align:right">${item.quantity}</td><td style="text-align:right">$${item.unit_price}</td><td style="text-align:right">$${item.line_total}</td></tr>`,
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Factura ${invoice.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111; position: relative; }
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              width: 320px;
              transform: translate(-50%, -50%);
              opacity: 0.08;
              z-index: 0;
              pointer-events: none;
            }
            .content { position: relative; z-index: 1; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
            .muted { color: #444; font-size: 12px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; font-size: 12px; }
            th { text-align: left; background: #f5f5f5; }
            .total { text-align: right; margin-top: 10px; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <img class="watermark" src="${logoMark}" alt="logo" />
          <div class="content">
            <div class="title">Factura ${invoice.invoice_number}</div>
            <div class="muted">Fecha: ${issueDate}</div>
            <div class="muted">Mesa: ${invoice.table_number || "-"} | Metodo de pago: ${invoice.payment_method}</div>
            <div class="muted">Mesero: ${invoice.waiter_email || "N/A"} | Caja: ${invoice.cashier_email || "N/A"}</div>
            <table>
              <thead>
                <tr><th>Producto</th><th style="text-align:right">Cant</th><th style="text-align:right">Valor</th><th style="text-align:right">Subtotal</th></tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
            <div class="total">TOTAL: $${invoice.total}</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

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
                background: selectedTableId === table.id ? "#fff1f1" : "white",
                border: "1px solid #d7c7c0",
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
                    background: order.status === "delivered" ? "#ffe5e5" : "#fef3c7",
                    color: order.status === "delivered" ? "#9f1d1d" : "#92400e",
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
                  border: paymentMethod === "efectivo" ? "2px solid #c62828" : "1px solid #d7c7c0",
                  background: paymentMethod === "efectivo" ? "#fff1f1" : "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Efectivo
              </button>
              <button
                onClick={() => {
                  setPaymentMethod("transferencia");
                  setCashReceived("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: paymentMethod === "transferencia" ? "2px solid #1f1f1f" : "1px solid #d7c7c0",
                  background: paymentMethod === "transferencia" ? "#f2f2f2" : "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Transferencia
              </button>
            </div>

            {paymentMethod === "efectivo" && (
              <div
                style={{
                  border: "1px solid #f3d2d2",
                  borderRadius: "10px",
                  background: "#fff7f7",
                  padding: "12px",
                  marginBottom: "14px",
                }}
              >
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px", color: "#7f1d1d" }}>
                  Valor del billete
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  placeholder="Ej: 50000"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d7c7c0",
                    fontSize: "15px",
                    boxSizing: "border-box",
                    marginBottom: "10px",
                  }}
                />

                <div style={{ display: "grid", gap: "4px", color: "#334155", fontSize: "14px" }}>
                  <div>Total a cobrar: <strong>${orderTotal}</strong></div>
                  <div>
                    Cambio: <strong style={{ color: "#166534" }}>${cashChange}</strong>
                  </div>
                  {cashShortfall > 0 && (
                    <div style={{ color: "#b91c1c", fontWeight: "bold" }}>
                      Faltan ${cashShortfall} para completar el pago.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ fontSize: "1.7rem", fontWeight: "bold", textAlign: "right", color: "#c62828", marginBottom: "12px" }}>
              Total: ${selectedOrder.total}
            </div>

            <button
              onClick={async () => {
                if (selectedOrder.status !== "delivered") {
                  notify("Aun no se puede cobrar: el pedido no esta entregado", "error");
                  return;
                }
                if (paymentMethod === "efectivo") {
                  if (!hasCashValue) {
                    notify("Ingresa el valor del billete recibido", "error");
                    return;
                  }
                  if (parsedCashReceived < orderTotal) {
                    notify("El valor recibido no cubre el total a cobrar", "error");
                    return;
                  }
                }
                const invoice = await onChargeOrder(selectedOrder, paymentMethod);
                if (invoice) {
                  setLastInvoice(invoice);
                  setSelectedTableId(null);
                  setCashReceived("");
                }
              }}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background: selectedOrder.status === "delivered" ? "#c62828" : "#9ca3af",
                color: "white",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              COBRAR Y FACTURAR
            </button>
          </>
        )}
      </div>

      {lastInvoice && (
        <div style={{ ...sectionStyle, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0 }}>Factura generada: {lastInvoice.invoice_number}</h3>
              <div style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>
                Mesa {lastInvoice.table_number || "-"} | Total ${lastInvoice.total} | {lastInvoice.payment_method}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => printInvoice(lastInvoice)} style={{ border: "none", borderRadius: "8px", padding: "10px 12px", background: "#1f1f1f", color: "white", fontWeight: "bold", cursor: "pointer" }}>
                Imprimir factura
              </button>
              <button onClick={() => setLastInvoice(null)} style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px 12px", background: "white", fontWeight: "bold", cursor: "pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
