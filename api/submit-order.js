import supabase from '../lib/supabase.js';
import { getCurrentCycle } from '../lib/cycle.js';
import { sendConfirmationEmail, sendAlertEmail } from '../lib/mailer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { group_id, contact_name, email, phone, items } = req.body;

  // Validate
  if (!group_id || !contact_name || !email) {
    return res.status(400).json({ error: 'group_id, contact_name, and email are required' });
  }
  const validItems = (items || []).filter(i => i.qty_ordered > 0);
  if (validItems.length === 0) {
    return res.status(400).json({ error: 'At least one item with quantity > 0 is required' });
  }

  try {
    // 1. Determine current cycle and upsert it
    const cycleData = getCurrentCycle();
    const { data: cycle, error: cycleErr } = await supabase
      .from('cycles')
      .upsert(cycleData, { onConflict: 'meeting_date' })
      .select()
      .single();
    if (cycleErr) throw cycleErr;

    // 2. Generate receipt number: NORVANA-YYYYMM-NNN
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('cycle_id', cycle.id);
    const seq = String((count || 0) + 1).padStart(3, '0');
    const yyyymm = cycleData.meeting_date.slice(0, 7).replace('-', '');
    const receiptNumber = `NORVANA-${yyyymm}-${seq}`;

    // 3. Insert order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        group_id,
        contact_name,
        email,
        phone: phone || null,
        cycle_id: cycle.id,
        receipt_number: receiptNumber,
        status: 'pending',
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    // 4. Bulk insert order items
    const orderItemsPayload = validItems.map(i => ({
      order_id:   order.id,
      item_id:    i.item_id,
      qty_ordered: i.qty_ordered,
      unit_price:  i.unit_price,
    }));
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);
    if (itemsErr) throw itemsErr;

    // 5. Fetch group name for emails
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', group_id)
      .single();

    // 6. Fetch catalog item details for email
    const itemIds = validItems.map(i => i.item_id);
    const { data: catalogItems } = await supabase
      .from('catalog_items')
      .select('id, item_no, description')
      .in('id', itemIds);

    const catalogMap = Object.fromEntries(catalogItems.map(c => [c.id, c]));
    const emailItems = validItems.map(i => ({
      item_no:    catalogMap[i.item_id]?.item_no || '',
      description: catalogMap[i.item_id]?.description || '',
      qty:         i.qty_ordered,
      unit_price:  i.unit_price,
    }));
    const orderTotal = emailItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0);

    // 7. Send emails (non-blocking failures)
    try {
      await Promise.all([
        sendConfirmationEmail({
          to:            email,
          groupName:     group.name,
          contactName:   contact_name,
          receiptNumber,
          items:         emailItems,
          orderTotal,
          cycleLabel:    cycle.label,
        }),
        sendAlertEmail({
          groupName:     group.name,
          contactName:   contact_name,
          email,
          phone,
          receiptNumber,
          items:         emailItems,
          orderTotal,
          cycleLabel:    cycle.label,
        }),
      ]);
    } catch (emailErr) {
      console.error('Email send failed (order still saved):', emailErr.message);
    }

    return res.status(200).json({ success: true, orderId: order.id, receiptNumber });
  } catch (err) {
    console.error('submit-order error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
