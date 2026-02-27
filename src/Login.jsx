import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    // .trim() elimina espacios accidentales al inicio o final del correo
    const { data, error } = await supabase.auth.signInWithPassword({
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
      background: "#f0f2f5",
      fontFamily: "Arial, sans-serif" 
    }}>
      <form 
        onSubmit={handleLogin} 
        style={{ 
          background: "white", 
          padding: "40px", 
          borderRadius: "12px", 
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)", 
          width: "100%", 
          maxWidth: "350px" 
        }}
      >
        <h2 style={{ textAlign: "center", color: "#333", marginBottom: "10px" }}>Bienvenido</h2>
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
              border: "1px solid #ddd", 
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
              border: "1px solid #ddd", 
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
            background: "#333", 
            color: "white", 
            border: "none", 
            borderRadius: "6px", 
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