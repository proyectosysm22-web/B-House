export const appContainerStyle = {
  padding: "15px",
  fontFamily: "'Inter', sans-serif",
  backgroundColor: "#f1f5f9",
  minHeight: "100vh",
};

export const cardStyle = (color) => ({
  background: "#fff",
  padding: "15px",
  borderRadius: "12px",
  borderLeft: `6px solid ${color}`,
  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
});

export const sectionStyle = {
  background: "#fff",
  padding: "20px",
  borderRadius: "15px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
  marginBottom: "20px",
};

export const inputStyle = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  fontSize: "14px",
  flex: 1,
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
  @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
  .blink-ready { animation: blink 1s infinite; background-color: #fbbf24 !important; color: black !important; }
  .tab-btn { padding: 10px 15px; border: none; background: none; cursor: pointer; font-weight: bold; color: #64748b; border-bottom: 3px solid transparent; transition: 0.3s; }
  .tab-btn.active { color: #3b82f6; border-bottom: 3px solid #3b82f6; }
  .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
  .main-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
  @media (max-width: 600px) { .table-btn-grid { grid-template-columns: repeat(3, 1fr) !important; } }
`;
