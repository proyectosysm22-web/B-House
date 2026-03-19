export function getGroupedItems(items) {
  const grouped = {};

  items.forEach((oi) => {
    const key = `${oi.product_id}-${oi.is_new}`;
    if (!grouped[key]) grouped[key] = { ...oi, quantity: 0 };
    grouped[key].quantity += oi.quantity;
  });

  return Object.values(grouped);
}
