import { supabase } from "../supabaseClient";

async function must(result, fallbackMessage) {
  if (result.error) throw new Error(result.error.message || fallbackMessage);
  return result.data;
}

function normalizeCategory(rawCategory) {
  const value = String(rawCategory || "comida").toLowerCase().trim();
  if (value === "bebida" || value === "bebidas") return "bebida";
  if (value === "ceramica" || value === "ceramicas") return "ceramica";
  return "comida";
}

export const dataService = {
  auth: supabase.auth,

  subscribeToChanges(onChange) {
    const channel = supabase
      .channel("realtime-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "*" }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async getSnapshot() {
    const [p, t, o, co, w] = await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("tables").select("*").order("number", { ascending: true }),
      supabase
        .from("orders")
        .select("*, tables(number), order_items(id, product_id, quantity, price, is_new, products(name, category))")
        .in("status", ["open", "ready", "delivered", "archived"]),
      supabase
        .from("orders")
        .select("*, tables(number), order_items(quantity, price, products(name, category))")
        .eq("status", "closed"),
      supabase.from("warehouse").select("*").order("name", { ascending: true }),
    ]);

    return {
      products: await must(p, "No se pudo cargar productos"),
      tables: await must(t, "No se pudo cargar mesas"),
      orders: await must(o, "No se pudo cargar pedidos"),
      closedOrders: await must(co, "No se pudo cargar pedidos cerrados"),
      warehouse: await must(w, "No se pudo cargar bodega"),
    };
  },

  async setTableCount(newCount) {
    const tables = await must(
      await supabase.from("tables").select("*").order("number", { ascending: true }),
      "No se pudo cargar mesas",
    );

    const existingNumbers = new Set(tables.map((table) => table.number));
    const toAdd = [];
    for (let number = 1; number <= newCount; number += 1) {
      if (!existingNumbers.has(number)) {
        toAdd.push({ number, status: "free" });
      }
    }
    if (toAdd.length > 0) {
      await must(await supabase.from("tables").insert(toAdd), "No se pudieron crear mesas");
    }

    const toDelete = tables.filter((table) => table.number > newCount);
    if (toDelete.length > 0) {
      const occupied = toDelete.some((table) => table.status === "occupied");
      if (occupied) throw new Error("No puedes eliminar mesas ocupadas");

      const tableIdsToDelete = toDelete.map((table) => table.id);
      const relatedOrders = await must(
        await supabase.from("orders").select("id, table_id").in("table_id", tableIdsToDelete),
        "No se pudo validar historial de mesas",
      );

      const tablesWithHistory = new Set(relatedOrders.map((order) => order.table_id));
      if (tablesWithHistory.size > 0) {
        const blockedNumbers = toDelete
          .filter((table) => tablesWithHistory.has(table.id))
          .map((table) => table.number)
          .sort((a, b) => a - b);

        throw new Error(
          `No se pueden eliminar mesas con historial de pedidos: ${blockedNumbers.join(", ")}.`,
        );
      }

      await must(
        await supabase.from("tables").delete().in("id", tableIdsToDelete),
        "No se pudieron eliminar mesas",
      );
    }
  },

  async archiveClosedOrders() {
    await must(
      await supabase.from("orders").update({ status: "archived" }).eq("status", "closed"),
      "No se pudo archivar el corte",
    );
  },

  async addWarehouseItem(payload) {
    await must(
      await supabase.from("warehouse").insert([
        {
          name: payload.name,
          quantity: parseInt(payload.quantity || 0, 10),
          unit_cost: parseFloat(payload.unit_cost || 0),
          min_stock: parseInt(payload.min_stock || 0, 10),
        },
      ]),
      "No se pudo guardar el insumo",
    );
  },

  async addProduct(payload) {
    let result = await supabase.from("products").insert([
      {
        name: payload.name,
        price: parseFloat(payload.price || 0),
        stock: parseInt(payload.stock || 0, 10),
        category: payload.category || "comida",
        is_active: true,
      },
    ]);

    if (result.error && result.error.message?.toLowerCase().includes("category")) {
      throw new Error(
        "Falta la columna category en products. Ejecuta la migracion SQL para categorias.",
      );
    }

    await must(result, "No se pudo crear el producto");
  },

  async toggleProductStatus(product) {
    await must(
      await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id),
      "No se pudo actualizar estado del producto",
    );
  },

  async updateProduct(id, payload) {
    await must(
      await supabase
        .from("products")
        .update({ price: parseFloat(payload.price), stock: parseInt(payload.stock, 10) })
        .eq("id", id),
      "No se pudo actualizar el producto",
    );
  },

  async saveOrder({ activeOrder, selectedTable, cart, userEmail }) {
    let orderId = activeOrder?.id;
    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartHasFood = cart.some((item) => normalizeCategory(item.category) === "comida");

    if (!orderId) {
      const created = await must(
        await supabase
          .from("orders")
          .insert([
            {
              total: cartTotal,
              table_id: selectedTable.id,
              status: cartHasFood ? "open" : "ready",
              waiter_email: userEmail,
            },
          ])
          .select()
          .single(),
        "No se pudo crear el pedido",
      );
      orderId = created.id;

      await must(
        await supabase.from("tables").update({ status: "occupied" }).eq("id", selectedTable.id),
        "No se pudo actualizar la mesa",
      );
    } else {
      const nextStatus =
        activeOrder?.status === "open" ? "open" : cartHasFood ? "open" : "ready";

      await must(
        await supabase
          .from("orders")
          .update({
            total: (activeOrder.total || 0) + cartTotal,
            status: nextStatus,
            waiter_email: userEmail,
          })
          .eq("id", orderId),
        "No se pudo actualizar el pedido",
      );
    }

    for (const item of cart) {
      await must(
        await supabase.from("order_items").insert([
          {
            order_id: orderId,
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            is_new: true,
          },
        ]),
        "No se pudo guardar item del pedido",
      );

      await must(
        await supabase
          .from("products")
          .update({ stock: item.stock - item.quantity })
          .eq("id", item.id),
        "No se pudo actualizar stock",
      );
    }

    return { status: cartHasFood ? "open" : "ready" };
  },

  async markDelivered(orderId) {
    await must(
      await supabase.from("order_items").update({ is_new: false }).eq("order_id", orderId),
      "No se pudieron marcar items como entregados",
    );
    await must(
      await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId),
      "No se pudo actualizar estado del pedido",
    );
  },

  async markOrderReady(orderId) {
    await must(
      await supabase.from("orders").update({ status: "ready" }).eq("id", orderId),
      "No se pudo marcar pedido listo",
    );
  },

  async nextInvoiceNumber() {
    const latest = await must(
      await supabase.from("invoices").select("invoice_number").order("created_at", { ascending: false }).limit(1),
      "No se pudo consultar consecutivo de factura",
    );

    const current = latest?.[0]?.invoice_number || "FAC-000000";
    const currentNumber = parseInt((current.split("-")[1] || "0"), 10);
    const nextNumber = currentNumber + 1;
    return `FAC-${String(nextNumber).padStart(6, "0")}`;
  },

  async chargeOrderWithInvoice({ order, tableNumber, paymentMethod, cashierEmail }) {
    const invoiceNumber = await dataService.nextInvoiceNumber();
    const subtotal = order.order_items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = order.total;

    const invoice = await must(
      await supabase
        .from("invoices")
        .insert([
          {
            invoice_number: invoiceNumber,
            order_id: order.id,
            table_id: order.table_id,
            table_number: tableNumber,
            waiter_email: order.waiter_email || null,
            cashier_email: cashierEmail || null,
            payment_method: paymentMethod,
            subtotal,
            tax: 0,
            total,
            status: "issued",
            issued_at: new Date().toISOString(),
          },
        ])
        .select()
        .single(),
      "No se pudo crear la factura",
    );

    const invoiceItems = order.order_items.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      product_name: item.products?.name || "Producto",
      category: item.products?.category || "comida",
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
    }));

    await must(
      await supabase.from("invoice_items").insert(invoiceItems),
      "No se pudo guardar detalle de factura",
    );

    let updateOrderResult = await supabase
      .from("orders")
      .update({
        status: "closed",
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateOrderResult.error && updateOrderResult.error.message?.toLowerCase().includes("column")) {
      updateOrderResult = await supabase.from("orders").update({ status: "closed" }).eq("id", order.id);
    }

    await must(updateOrderResult, "No se pudo cerrar el pedido");
    await must(
      await supabase.from("tables").update({ status: "free" }).eq("id", order.table_id),
      "No se pudo liberar la mesa",
    );

    return {
      ...invoice,
      items: invoiceItems,
    };
  },
};
