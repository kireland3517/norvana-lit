import supabase from '../lib/supabase.js';
import { requireAdmin } from '../lib/auth.js';
import { sendReadyEmail } from '../lib/mailer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try { requireAdmin(req); } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { order_id, items, notes } = req.body;

  if (!order_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'order_id and items array required' });
  }

  try {
    // 1. Fetch existing order
    const { data: order, error: orderFetchErr } = await supabase
      .from('orders')
      .select('*, groups(name)')
      .eq('id', order_id)
      .single();
    if (orderFetchErr) throw orderFetchErr;

    if (order.status === 'paid') {
      return res.status(409).json({ error: 'Order is already marked paid' });
    }

    // 2. Update each order_item's qty_fulfilled
    await Promise.all(items.map(({ order_item_id, qty_fulfilled }) =>
      supabase
        .from('order_items')
        .update({ qty_fulfilled: Math.max(0, parseInt(qty_fulfilled, 10) || 0) })
        .eq('id', order_item_id)
    ));

    // 3. Recalculate revised_total
    const { data: updatedItems } = await supabase
      .from('order_items')
      .select('qty_fulfilled, unit_price, catalog_items(item_no, description)')
      .eq('order_id', order_id);

    const revisedTotal = updatedItems.reduce(
      (sum, i) => sum + (i.qty_fulfilled || 0) * i.unit_price,
      0
    );

    // 4. Update order status + revised_total + notes
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status: 'ready', revised_total: revisedTotal, notes: notes || null })
      .eq('id', order_id);
    if (updateErr) throw updateErr;

    // 5. Send "order ready" email
    const emailItems = updatedItems
      .filter(i => (i.qty_fulfilled || 0) > 0)
      .map(i => ({
        item_no:     i.catalog_items.item_no,
        description: i.catalog_items.description,
        qty:         i.qty_fulfilled,
        unit_price:  i.unit_price,
      }));

    try {
      await sendReadyEmail({
        to:           order.email,
        groupName:    order.groups.name,
        contactName:  order.contact_name,
        receiptNumber: order.receipt_number,
        items:        emailItems,
        revisedTotal,
        notes:        notes || null,
      });
    } catch (emailErr) {
      console.error('Ready email failed (order still updated):', emailErr.message);
    }

    return res.status(200).json({ success: true, revisedTotal });
  } catch (err) {
    console.error('mark-ready error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
