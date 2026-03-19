import { supabase } from "../supabaseClient";

async function must(result, fallbackMessage) {
  if (result.error) throw new Error(result.error.message || fallbackMessage);
  return result.data;
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
        .select("*, tables(number), order_items(id, product_id, quantity, price, is_new, products(name))")
        .in("status", ["open", "ready", "delivered", "archived"]),
      supabase
        .from("orders")
        .select("*, tables(number), order_items(quantity, price, products(name))")
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
      await must(await supabase.from("tables").delete().in("id", toDelete.map((table) => table.id)), "No se pudieron eliminar mesas");
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
    await must(
      await supabase.from("products").insert([
        {
          name: payload.name,
          price: parseFloat(payload.price || 0),
          stock: parseInt(payload.stock || 0, 10),
          is_active: true,
        },
      ]),
      "No se pudo crear el producto",
    );
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

    if (!orderId) {
      const created = await must(
        await supabase
          .from("orders")
          .insert([
            {
              total: cartTotal,
              table_id: selectedTable.id,
              status: "open",
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
      await must(
        await supabase
          .from("orders")
          .update({
            total: (activeOrder.total || 0) + cartTotal,
            status: "open",
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

  async closeOrder(orderId, tableId, paymentMethod) {
    let updateOrderResult = await supabase
      .from("orders")
      .update({
        status: "closed",
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateOrderResult.error && updateOrderResult.error.message?.toLowerCase().includes("column")) {
      updateOrderResult = await supabase.from("orders").update({ status: "closed" }).eq("id", orderId);
    }

    await must(updateOrderResult, "No se pudo cerrar el pedido");
    await must(
      await supabase.from("tables").update({ status: "free" }).eq("id", tableId),
      "No se pudo liberar la mesa",
    );
  },
};
