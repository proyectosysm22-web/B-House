export const appContainerStyle = {
  padding: "15px",
  fontFamily: "'Manrope', 'Segoe UI', sans-serif",
  backgroundColor: "#f5f2ef",
  minHeight: "100vh",
  color: "#1f2937",
};

export const cardStyle = (color) => ({
  background: "#fff",
  padding: "16px",
  borderRadius: "12px",
  borderLeft: `6px solid ${color}`,
  border: "1px solid #efe4df",
  boxShadow: "0 8px 18px rgba(30, 10, 10, 0.06)",
});

export const sectionStyle = {
  background: "#fff",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #efe4df",
  boxShadow: "0 10px 24px rgba(30, 10, 10, 0.06)",
  marginBottom: "20px",
};

export const inputStyle = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d9c8c0",
  fontSize: "14px",
  flex: 1,
  color: "#1f2937",
  background: "#fffdfa",
};

export const thStyle = {
  padding: "12px",
  borderBottom: "2px solid #f1f5f9",
  color: "#64748b",
  fontSize: "0.85rem",
};

export const tdStyle = {
  padding: "12px",
  fontSize: "0.9rem",
};

export const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Oswald:wght@500;600&display=swap');
  :root {
    --brand-red: #c62828;
    --brand-red-strong: #b71c1c;
    --graphite: #1f1f1f;
    --surface: #ffffff;
    --surface-soft: #fff6f3;
    --muted: #6b7280;
    --ok: #2e7d32;
    --warn: #b7791f;
    --line: #efe4df;
  }
  * { box-sizing: border-box; }
  h1, h2, h3, h4 {
    font-family: 'Oswald', 'Segoe UI', sans-serif;
    letter-spacing: 0.3px;
  }
  @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
  .blink-ready { animation: blink 1s infinite; background-color: #f8c25d !important; color: #111827 !important; }
  .tab-btn {
    padding: 10px 15px;
    border: none;
    background: none;
    cursor: pointer;
    font-weight: 700;
    color: var(--muted);
    border-bottom: 3px solid transparent;
    transition: 0.2s;
  }
  .tab-btn.active { color: var(--brand-red); border-bottom: 3px solid var(--brand-red); }
  .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
  .main-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
  button { font-family: 'Manrope', 'Segoe UI', sans-serif; }
  input, select { font-family: 'Manrope', 'Segoe UI', sans-serif; }
  @media (max-width: 600px) { .table-btn-grid { grid-template-columns: repeat(3, 1fr) !important; } }
`;
