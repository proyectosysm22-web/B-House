import { useState } from "react";
import { dataService } from "./services/dataService";
import logoMark from "./assets/branding/logo-mark.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    // .trim() elimina espacios accidentales al inicio o final del correo
    const { data, error } = await dataService.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      // Si el error es por confirmación, te lo dirá aquí
      alert("Error al entrar: " + error.message);
      console.log("Detalle del error:", error);
    } else {
      console.log("Sesión iniciada con éxito:", data.user.email);
    }
    
    setLoading(false);
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      background: "radial-gradient(circle at top, #fff8f5 0%, #f4ece8 55%, #efe3de 100%)",
      fontFamily: "'Manrope', 'Segoe UI', sans-serif"
    }}>
      <form
        onSubmit={handleLogin}
        style={{
          background: "white",
          border: "1px solid #ead8d0",
          padding: "40px",
          borderRadius: "14px",
          boxShadow: "0 18px 40px rgba(60, 25, 25, 0.15)",
          width: "100%",
          maxWidth: "350px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
          <img src={logoMark} alt="Logo Banderillas" style={{ width: "96px", height: "96px", objectFit: "contain", opacity: 0.40 }} />
        </div>
        <h2 style={{ textAlign: "center", color: "#1f1f1f", marginBottom: "10px", fontFamily: "'Oswald', sans-serif", letterSpacing: "0.4px" }}>Bienvenido</h2>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "30px" }}>Ingresa a tu cuenta de Banderillas</p>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "#333", fontWeight: "bold" }}>Correo Electrónico</label>
          <input 
            type="email" 
            placeholder="" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ 
              width: "100%", 
              padding: "12px", 
              border: "1px solid #d8c6bf",
              borderRadius: "6px", 
              boxSizing: "border-box",
              fontSize: "16px" 
            }}
            required 
          />
        </div>

        <div style={{ marginBottom: "25px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "#333", fontWeight: "bold" }}>Contraseña</label>
          <input 
            type="password" 
            placeholder="" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ 
              width: "100%", 
              padding: "12px", 
              border: "1px solid #d8c6bf",
              borderRadius: "6px", 
              boxSizing: "border-box",
              fontSize: "16px" 
            }}
            required 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: "100%", 
            padding: "12px", 
            background: "#c62828",
            color: "white", 
            border: "1px solid #d85c5c",
            borderRadius: "8px", 
            cursor: loading ? "not-allowed" : "pointer", 
            fontSize: "16px",
            fontWeight: "bold",
            transition: "background 0.3s"
          }}
        >
          {loading ? "Verificando..." : "Iniciar Sesión"}
        </button>

        <p style={{ marginTop: "20px", fontSize: "12px", color: "#999", textAlign: "center" }}>
          Sonriele a la vida, con una banderilla.
        </p>
      </form>
    </div>
  );
}
