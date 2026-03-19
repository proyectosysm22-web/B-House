import { useMemo, useState } from "react";
import { cardStyle, inputStyle, sectionStyle, tdStyle, thStyle } from "../../styles/uiStyles";

function normalizeCategory(rawCategory) {
  const value = String(rawCategory || "comida").toLowerCase().trim();
  if (value === "bebida" || value === "bebidas") return "bebida";
  if (value === "ceramica" || value === "ceramicas") return "ceramica";
  return "comida";
}

function money(value) {
  return Number(value || 0).toLocaleString("es-CO");
}

function csvExport(rows) {
  const headers = ["Fecha", "Estado", "Mesa", "Mesero", "Caja", "Pago", "Factura", "Categorias", "Total", "Productos"];
  const lines = rows.map((row) => {
    const products = row.items.map((item) => `${item.quantity}x ${item.products?.name || "Producto"}`).join(" | ");
    return [new Date(row.created_at).toLocaleString(), row.status, row.table_number, row.waiter_email, row.cashier_email, row.payment_method, row.invoice_number, row.categories.join(", "), row.total, products];
  });
  const csv = [headers, ...lines]
    .map((line) => line.map((field) => `"${String(field ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function mergeRows(orders, closedOrders, invoices) {
  const invoiceByOrder = new Map((invoices || []).map((i) => [i.order_id, i]));
  return [...orders, ...closedOrders].map((order) => {
    const invoice = invoiceByOrder.get(order.id);
    const items = order.order_items || [];
    const categories = [...new Set(items.map((item) => normalizeCategory(item.products?.category)))];
    return {
      id: order.id,
      created_at: order.created_at,
      status: order.status || "N/A",
      table_number: order.tables?.number || "-",
      waiter_email: order.waiter_email || "N/A",
      cashier_email: invoice?.cashier_email || "N/A",
      payment_method: invoice?.payment_method || order.payment_method || "N/A",
      invoice_number: invoice?.invoice_number || "N/A",
      total: Number(order.total || 0),
      items,
      categories,
      ready_at: order.ready_at,
      delivered_at: order.delivered_at,
      paid_at: order.paid_at || invoice?.issued_at,
    };
  });
}

export default function AuditGlobalView({ orders, closedOrders, invoices }) {
  const [status, setStatus] = useState("todos");
  const [payment, setPayment] = useState("todos");
  const [category, setCategory] = useState("todos");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => mergeRows(orders, closedOrders, invoices), [orders, closedOrders, invoices]);

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    const text = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        const rowDate = new Date(row.created_at);
        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
        if (status !== "todos" && row.status !== status) return false;
        if (payment !== "todos" && row.payment_method !== payment) return false;
        if (category !== "todos" && !row.categories.includes(category)) return false;
        if (!text) return true;
        const products = row.items.map((item) => item.products?.name || "").join(" ").toLowerCase();
        const composite = `${row.waiter_email} ${row.cashier_email} ${row.invoice_number} ${row.payment_method} ${products}`.toLowerCase();
        return composite.includes(text);
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [rows, status, payment, category, search, fromDate, toDate]);

  const kpi = useMemo(() => {
    const total = filtered.reduce((sum, row) => sum + row.total, 0);
    const avg = filtered.length ? total / filtered.length : 0;
    return { total, count: filtered.length, avg };
  }, [filtered]);

  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Auditoria Global</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "10px" }}>
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} style={inputStyle} />
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} style={inputStyle} />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="todos">Estado: Todos</option>
            <option value="open">Open</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
          <select value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="todos">Pago: Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="N/A">Sin registro</option>
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="todos">Categoria: Todas</option>
            <option value="comida">Comida</option>
            <option value="bebida">Bebida</option>
            <option value="ceramica">Ceramica</option>
          </select>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar texto..." style={inputStyle} />
        </div>
        <button onClick={() => csvExport(filtered)} style={{ border: "none", background: "#0f172a", color: "white", padding: "8px 12px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
          Exportar CSV
        </button>
      </div>

      <div className="grid-cards">
        <div style={cardStyle("#16a34a")}><span style={{ fontSize: "0.8rem", color: "#64748b" }}>Ventas</span><div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>${money(kpi.total)}</div></div>
        <div style={cardStyle("#2563eb")}><span style={{ fontSize: "0.8rem", color: "#64748b" }}>Ordenes</span><div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>{kpi.count}</div></div>
        <div style={cardStyle("#7c3aed")}><span style={{ fontSize: "0.8rem", color: "#64748b" }}>Ticket Promedio</span><div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>${money(kpi.avg)}</div></div>
      </div>

      <div style={sectionStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc", textAlign: "left" }}>
              <tr>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Mesa</th>
                <th style={thStyle}>Mesero</th>
                <th style={thStyle}>Caja</th>
                <th style={thStyle}>Pago</th>
                <th style={thStyle}>Factura</th>
                <th style={thStyle}>Total</th>
                <th style={thStyle}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={`${row.id}-${row.status}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{new Date(row.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>{row.status}</td>
                  <td style={tdStyle}>Mesa {row.table_number}</td>
                  <td style={tdStyle}>{row.waiter_email}</td>
                  <td style={tdStyle}>{row.cashier_email}</td>
                  <td style={tdStyle}>{row.payment_method}</td>
                  <td style={tdStyle}>{row.invoice_number}</td>
                  <td style={{ ...tdStyle, fontWeight: "bold" }}>${money(row.total)}</td>
                  <td style={tdStyle}>
                    <button onClick={() => setSelected(row)} style={{ border: "1px solid #cbd5e1", borderRadius: "6px", background: "white", padding: "4px 8px", cursor: "pointer" }}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && <tr><td style={tdStyle} colSpan={9}>No hay registros con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
          <small style={{ color: "#64748b" }}>Pagina {currentPage} de {totalPages} | Registros: {filtered.length}</small>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} style={{ border: "1px solid #cbd5e1", borderRadius: "6px", background: "white", padding: "6px 10px", cursor: "pointer" }}>Anterior</button>
            <button onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} style={{ border: "1px solid #cbd5e1", borderRadius: "6px", background: "white", padding: "6px 10px", cursor: "pointer" }}>Siguiente</button>
          </div>
        </div>
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3500 }}>
          <div style={{ background: "white", width: "min(850px, 95vw)", maxHeight: "90vh", overflowY: "auto", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ margin: 0 }}>Detalle Orden - Mesa {selected.table_number}</h3>
              <button onClick={() => setSelected(null)} style={{ border: "1px solid #cbd5e1", borderRadius: "6px", background: "white", padding: "6px 10px", cursor: "pointer" }}>Cerrar</button>
            </div>
            <div style={{ display: "grid", gap: "6px", marginBottom: "12px", fontSize: "14px" }}>
              <div><strong>Orden:</strong> {selected.id}</div>
              <div><strong>Factura:</strong> {selected.invoice_number}</div>
              <div><strong>Mesero:</strong> {selected.waiter_email}</div>
              <div><strong>Caja:</strong> {selected.cashier_email}</div>
              <div><strong>Creada:</strong> {selected.created_at ? new Date(selected.created_at).toLocaleString() : "N/A"}</div>
              <div><strong>Lista Cocina:</strong> {selected.ready_at ? new Date(selected.ready_at).toLocaleString() : "N/A"}</div>
              <div><strong>Entregada:</strong> {selected.delivered_at ? new Date(selected.delivered_at).toLocaleString() : "N/A"}</div>
              <div><strong>Cobrada:</strong> {selected.paid_at ? new Date(selected.paid_at).toLocaleString() : "N/A"}</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc", textAlign: "left" }}>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Categoria</th>
                  <th style={thStyle}>Cantidad</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, idx) => (
                  <tr key={`${selected.id}-${idx}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={tdStyle}>{item.products?.name || "Producto"}</td>
                    <td style={tdStyle}>{normalizeCategory(item.products?.category)}</td>
                    <td style={tdStyle}>{item.quantity}</td>
                    <td style={tdStyle}>${money(item.price)}</td>
                    <td style={tdStyle}>${money(Number(item.quantity || 0) * Number(item.price || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
