import supabase from '../lib/supabase.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .order('subcategory')
      .order('sort_order');

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    try { requireAdmin(req); } catch (e) {
      return res.status(e.status || 401).json({ error: e.message });
    }

    const { action, item, id, active } = req.body;

    if (action === 'upsert') {
      if (!item || !item.item_no || !item.description || item.price == null || !item.subcategory) {
        return res.status(400).json({ error: 'Missing required item fields' });
      }

      const validSubcats = ['Books', 'Pamphlets', 'Keytags', 'Medallions', 'Special Orders'];
      if (!validSubcats.includes(item.subcategory)) {
        return res.status(400).json({ error: 'Invalid subcategory' });
      }

      const payload = {
        item_no:     item.item_no.toUpperCase(),
        description: item.description,
        price:       parseFloat(item.price),
        subcategory: item.subcategory,
        active:      item.active !== false,
        sort_order:  item.sort_order || 0,
      };

      let result;
      if (item.id) {
        // Update existing
        const { data, error } = await supabase
          .from('catalog_items')
          .update(payload)
          .eq('id', item.id)
          .select()
          .single();
        if (error) return res.status(500).json({ error: error.message });
        result = data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('catalog_items')
          .insert(payload)
          .select()
          .single();
        if (error) return res.status(500).json({ error: error.message });
        result = data;
      }

      return res.status(200).json(result);
    }

    if (action === 'toggle') {
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { data, error } = await supabase
        .from('catalog_items')
        .update({ active })
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
