export default function NotificationToast({ notification }) {
  if (!notification.show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        padding: "15px 25px",
        borderRadius: "10px",
        background: notification.type === "success" ? "#22c55e" : "#ef4444",
        color: "white",
        zIndex: 9999,
        fontWeight: "bold",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {notification.msg}
    </div>
  );
}
