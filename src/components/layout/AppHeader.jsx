export default function AppHeader({ view, onSignOut }) {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "linear-gradient(90deg, #1f1f1f 0%, #2f2f2f 100%)",
        color: "white",
        padding: "12px 20px",
        borderRadius: "12px",
        marginBottom: "20px",
        boxShadow: "0 10px 22px rgba(20,20,20,0.25)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.2rem", letterSpacing: "0.4px" }}>
        {view === "admin"
          ? "Admin Panel"
          : view === "cocina"
            ? "Cocina"
            : view === "caja"
              ? "Caja"
              : "Servicio"}
      </h2>
      <button
        onClick={onSignOut}
        style={{
          background: "#c62828",
          color: "white",
          border: "1px solid #e66a6a",
          padding: "8px 13px",
          borderRadius: "8px",
          fontWeight: "bold",
        }}
      >
        Salir
      </button>
    </nav>
  );
}
