import { useEffect, useState } from "react";
import Login from "./Login";
import NotificationToast from "./components/common/NotificationToast";
import ConfirmModal from "./components/common/ConfirmModal";
import EditProductModal from "./components/common/EditProductModal";
import AppHeader from "./components/layout/AppHeader";
import AdminView from "./components/views/AdminView";
import WaiterView from "./components/views/WaiterView";
import KitchenView from "./components/views/KitchenView";
import { appContainerStyle, globalCss } from "./styles/uiStyles";
import { dataService } from "./services/dataService";

function App() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("mesero");
  const [adminTab, setAdminTab] = useState("monitor");
  const [closedOrders, setClosedOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [warehouse, setWarehouse] = useState([]);
  const [newW, setNewW] = useState({ name: "", quantity: "", unit_cost: "", min_stock: "" });
  const [totalTablesInput, setTotalTablesInput] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [notification, setNotification] = useState({ show: false, msg: "", type: "success" });
  const [showConfirm, setShowConfirm] = useState({ show: false, action: null, msg: "" });
  const [newP, setNewP] = useState({ name: "", price: "", stock: "" });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    dataService.auth.getSession().then(({ data: { session: nextSession } }) => setSession(nextSession));
    const { data: listener } = dataService.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session) return;
    const email = session.user.email.toLowerCase();
    if (email.includes("admin")) setView("admin");
    else if (email.includes("cocina")) setView("cocina");
    else setView("mesero");
    getData();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const unsubscribe = dataService.subscribeToChanges(() => getData());
    return () => unsubscribe?.();
  }, [session]);

  useEffect(() => {
    if (selectedTable && selectedTable.status === "occupied") {
      const order = orders.find((o) => o.table_id === selectedTable.id && o.status !== "closed" && o.status !== "archived");
      setActiveOrder(order);
    } else {
      setActiveOrder(null);
    }
  }, [selectedTable, orders]);

  async function getData() {
    const snapshot = await dataService.getSnapshot();
    setProducts(snapshot.products || []);
    setTables(snapshot.tables || []);
    setOrders(snapshot.orders || []);
    setClosedOrders(snapshot.closedOrders || []);
    setWarehouse(snapshot.warehouse || []);
    setTotalTablesInput(String(snapshot.tables?.length || 0));
  }

  function notify(msg, type = "success") {
    setNotification({ show: true, msg, type });
    setTimeout(() => setNotification({ show: false, msg: "", type: "success" }), 3000);
  }

  async function updateTableCount() {
    const newCount = parseInt(totalTablesInput, 10);
    if (Number.isNaN(newCount) || newCount < 0) return notify("Numero no valido", "error");
    try {
      await dataService.setTableCount(newCount);
      await getData();
      notify("Mesas actualizadas");
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function runCashCut() {
    if (closedOrders.length === 0) {
      notify("No hay ventas para realizar el corte", "error");
      setShowConfirm({ show: false });
      return;
    }
    await dataService.archiveClosedOrders();
    await getData();
    notify("Corte de caja guardado exitosamente");
    setShowConfirm({ show: false });
  }

  async function addWarehouseItem() {
    if (!newW.name || !newW.quantity) return notify("Faltan datos", "error");
    await dataService.addWarehouseItem(newW);
    setNewW({ name: "", quantity: "", unit_cost: "", min_stock: "" });
    await getData();
  }

  async function addProduct() {
    if (!newP.name || !newP.price) return notify("Faltan datos", "error");
    await dataService.addProduct(newP);
    setNewP({ name: "", price: "", stock: "" });
    await getData();
  }

  async function toggleProductStatus(product) {
    await dataService.toggleProductStatus(product);
    await getData();
  }

  async function handleUpdateProduct() {
    await dataService.updateProduct(editingProduct.id, { price: editPrice, stock: editStock });
    setEditingProduct(null);
    await getData();
  }

  function addToCart(product) {
    const item = cart.find((i) => i.id === product.id);
    if (item && item.quantity + 1 > product.stock) return notify("Sin stock", "error");
    if (item) setCart(cart.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    else setCart([...cart, { ...product, quantity: 1 }]);
  }

  function removeFromCart(productId) {
    setCart(cart.filter((item) => item.id !== productId));
  }

  async function saveOrder() {
    if (cart.length === 0) return notify("El carrito esta vacio", "error");
    if (!selectedTable) return notify("Selecciona una mesa", "error");

    try {
      const userEmail = session?.user?.email || "usuario@restaurante.com";
      await dataService.saveOrder({ activeOrder, selectedTable, cart, userEmail });
      setCart([]);
      await getData();
      notify("Pedido enviado a cocina");
    } catch (error) {
      notify("Error al guardar: " + error.message, "error");
    }
  }

  async function markDelivered(id) {
    await dataService.markDelivered(id);
    await getData();
    notify("Productos entregados");
  }

  async function markOrderReady(id) {
    await dataService.markOrderReady(id);
    await getData();
    notify("Orden terminada");
  }

  async function closeOrder() {
    if (!activeOrder || !selectedTable) return;
    if (activeOrder.status === "open" || activeOrder.status === "ready") {
      return notify("No se puede cobrar: aun hay productos por entregar", "error");
    }
    await dataService.closeOrder(activeOrder.id, selectedTable.id);
    setSelectedTable(null);
    setShowConfirm({ show: false });
    await getData();
    notify("Cuenta cobrada");
  }

  if (!session) return <Login />;
  const isAdmin = session.user.email.toLowerCase().includes("admin");

  return (
    <div style={appContainerStyle}>
      <style>{globalCss}</style>

      <NotificationToast notification={notification} />
      <ConfirmModal showConfirm={showConfirm} setShowConfirm={setShowConfirm} />

      <AppHeader view={view} onSignOut={() => dataService.auth.signOut()} />

      {view === "admin" && (
        <AdminView
          closedOrders={closedOrders}
          tables={tables}
          orders={orders}
          adminTab={adminTab}
          setAdminTab={setAdminTab}
          totalTablesInput={totalTablesInput}
          setTotalTablesInput={setTotalTablesInput}
          updateTableCount={updateTableCount}
          products={products}
          newP={newP}
          setNewP={setNewP}
          addProduct={addProduct}
          toggleProductStatus={toggleProductStatus}
          setEditingProduct={setEditingProduct}
          setEditPrice={setEditPrice}
          setEditStock={setEditStock}
          warehouse={warehouse}
          newW={newW}
          setNewW={setNewW}
          addWarehouseItem={addWarehouseItem}
          setShowConfirm={setShowConfirm}
          runCashCut={runCashCut}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      )}

      {view === "mesero" && (
        <WaiterView
          tables={tables}
          orders={orders}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          setCart={setCart}
          products={products}
          cart={cart}
          addToCart={addToCart}
          removeFromCart={removeFromCart}
          saveOrder={saveOrder}
          activeOrder={activeOrder}
          markDelivered={markDelivered}
          notify={notify}
          setShowConfirm={setShowConfirm}
          closeOrder={closeOrder}
        />
      )}

      {view === "cocina" && <KitchenView orders={orders} markOrderReady={markOrderReady} />}

      <EditProductModal
        editingProduct={editingProduct}
        editPrice={editPrice}
        setEditPrice={setEditPrice}
        editStock={editStock}
        setEditStock={setEditStock}
        setEditingProduct={setEditingProduct}
        handleUpdateProduct={handleUpdateProduct}
      />

      {isAdmin && (
        <button
          onClick={() => setView(view === "admin" ? "mesero" : "admin")}
          style={{
            position: "fixed",
            bottom: "25px",
            right: "25px",
            width: "65px",
            height: "65px",
            borderRadius: "50%",
            background: "#1e293b",
            color: "white",
            border: "none",
            fontSize: "28px",
            cursor: "pointer",
            boxShadow: "0 6px 15px rgba(0,0,0,0.4)",
            zIndex: 100,
          }}
        >
          {view === "admin" ? "M" : "A"}
        </button>
      )}
    </div>
  );
}

export default App;
