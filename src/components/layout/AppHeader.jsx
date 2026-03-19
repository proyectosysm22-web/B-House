export default function AppHeader({ view, onSignOut }) {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#1e293b",
        color: "white",
        padding: "12px 20px",
        borderRadius: "12px",
        marginBottom: "20px",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
        {view === "admin" ? "Admin Panel" : view === "cocina" ? "Cocina" : "Servicio"}
      </h2>
      <button
        onClick={onSignOut}
        style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold" }}
      >
        Salir
      </button>
    </nav>
  );
}
