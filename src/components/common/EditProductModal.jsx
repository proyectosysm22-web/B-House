import { inputStyle } from "../../styles/uiStyles";

export default function EditProductModal({
  editingProduct,
  editPrice,
  setEditPrice,
  editStock,
  setEditStock,
  setEditingProduct,
  handleUpdateProduct,
}) {
  if (!editingProduct) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 3000,
      }}
    >
      <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "300px" }}>
        <h3 style={{ marginTop: 0 }}>Editar {editingProduct.name}</h3>
        <label style={{ fontSize: "0.8rem" }}>Precio:</label>
        <input
          type="number"
          value={editPrice}
          onChange={(e) => setEditPrice(e.target.value)}
          style={{ ...inputStyle, width: "100%", marginBottom: "10px" }}
        />
        <label style={{ fontSize: "0.8rem" }}>Stock:</label>
        <input
          type="number"
          value={editStock}
          onChange={(e) => setEditStock(e.target.value)}
          style={{ ...inputStyle, width: "100%", marginBottom: "20px" }}
        />
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}>
            Cerrar
          </button>
          <button onClick={handleUpdateProduct} style={{ flex: 1, padding: "10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "5px" }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
