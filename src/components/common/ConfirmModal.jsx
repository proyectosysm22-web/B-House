export default function ConfirmModal({ showConfirm, setShowConfirm }) {
  if (!showConfirm.show) return null;

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
        zIndex: 4000,
      }}
    >
      <div style={{ background: "white", padding: "25px", borderRadius: "15px", width: "320px", textAlign: "center" }}>
        <p style={{ fontWeight: "bold" }}>{showConfirm.msg}</p>
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            onClick={() => setShowConfirm({ show: false })}
            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
          >
            Cancelar
          </button>
          <button
            onClick={showConfirm.action}
            style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#3b82f6", color: "white", border: "none", fontWeight: "bold" }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
