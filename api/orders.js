import supabase from '../lib/supabase.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try { requireAdmin(req); } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { cycle_id, status } = req.query;

  try {
    // Fetch all cycles for the selector dropdowns
    const { data: cycles } = await supabase
      .from('cycles')
      .select('id, label, start_date, end_date, meeting_date')
      .order('meeting_date', { ascending: false });

    // Build orders query
    let query = supabase
      .from('orders')
      .select(`
        id, contact_name, email, phone, submitted_at, status,
        receipt_number, revised_total, notes, cycle_id,
        groups(id, name),
        cycles(id, label),
        order_items(
          id, qty_ordered, qty_fulfilled, unit_price,
          catalog_items(id, item_no, description, subcategory, price)
        )
      `)
      .order('submitted_at', { ascending: false });

    if (cycle_id) query = query.eq('cycle_id', cycle_id);
    if (status)   query = query.eq('status', status);

    const { data: orders, error } = await query;
    if (error) throw error;

    return res.status(200).json({ orders, cycles });
  } catch (err) {
    console.error('orders error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
