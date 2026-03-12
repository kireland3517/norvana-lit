import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'NORVANA Lit Committee <norvanalit12@gmail.com>';

function formatMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

function itemsTableHtml(items) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${it.item_no}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${it.description}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.qty}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatMoney(it.unit_price)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatMoney(it.qty * it.unit_price)}</td>
    </tr>`).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #cbd5e1;">Item #</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #cbd5e1;">Description</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #cbd5e1;">Qty</th>
          <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #cbd5e1;">Unit Price</th>
          <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #cbd5e1;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function baseLayout(title, bodyContent) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#1a3a5c;padding:24px 32px;">
      <div style="color:#c9a84c;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">NORVANA Literature Committee</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;">${title}</div>
    </div>
    <div style="padding:28px 32px;">
      ${bodyContent}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;">
      NORVANA Literature Committee · This is an automated message.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Confirmation email to group contact after order submission.
 */
export async function sendConfirmationEmail({ to, groupName, contactName, receiptNumber, items, orderTotal, cycleLabel }) {
  const html = baseLayout('Order Received', `
    <p style="color:#334155;margin-bottom:20px;">Hi ${contactName},</p>
    <p style="color:#334155;margin-bottom:20px;">
      Your literature order for <strong>${groupName}</strong> has been received.
      The Literature Chair will review it and contact you when your order is ready for pickup at the area meeting.
    </p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px;">Receipt Number</div>
      <div style="font-size:18px;font-weight:700;color:#1a3a5c;font-family:monospace;">${receiptNumber}</div>
      <div style="font-size:13px;color:#64748b;margin-top:8px;">Cycle: ${cycleLabel}</div>
    </div>
    ${itemsTableHtml(items)}
    <div style="text-align:right;margin-top:16px;font-size:16px;font-weight:700;color:#1a3a5c;">
      Order Total: ${formatMoney(orderTotal)}
    </div>
    <p style="color:#64748b;font-size:13px;margin-top:24px;">
      Note: Quantities may be adjusted by the Lit Chair based on available stock.
      You will receive a follow-up email when your order is ready with a final total due at pickup.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Order Received — ${receiptNumber} (${groupName})`,
    html,
  });
}

/**
 * Alert email to Lit Chair when a new order is submitted.
 */
export async function sendAlertEmail({ groupName, contactName, email, phone, receiptNumber, items, orderTotal, cycleLabel }) {
  const html = baseLayout('New Order Submitted', `
    <p style="color:#334155;margin-bottom:20px;">A new literature order has been submitted.</p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table style="font-size:14px;color:#334155;width:100%;">
        <tr><td style="padding:3px 0;color:#64748b;width:120px;">Receipt #</td><td><strong style="font-family:monospace;">${receiptNumber}</strong></td></tr>
        <tr><td style="padding:3px 0;color:#64748b;">Group</td><td><strong>${groupName}</strong></td></tr>
        <tr><td style="padding:3px 0;color:#64748b;">Contact</td><td>${contactName}</td></tr>
        <tr><td style="padding:3px 0;color:#64748b;">Email</td><td>${email}</td></tr>
        ${phone ? `<tr><td style="padding:3px 0;color:#64748b;">Phone</td><td>${phone}</td></tr>` : ''}
        <tr><td style="padding:3px 0;color:#64748b;">Cycle</td><td>${cycleLabel}</td></tr>
      </table>
    </div>
    ${itemsTableHtml(items)}
    <div style="text-align:right;margin-top:16px;font-size:16px;font-weight:700;color:#1a3a5c;">
      Order Total: ${formatMoney(orderTotal)}
    </div>
  `);

  await resend.emails.send({
    from: FROM,
    to: process.env.LIT_CHAIR_EMAIL,
    subject: `New Order — ${receiptNumber} (${groupName})`,
    html,
  });
}

/**
 * "Order Ready" email to group contact after Lit Chair marks order fulfilled.
 */
export async function sendReadyEmail({ to, groupName, contactName, receiptNumber, items, revisedTotal, notes }) {
  const html = baseLayout('Your Order is Ready for Pickup', `
    <p style="color:#334155;margin-bottom:20px;">Hi ${contactName},</p>
    <p style="color:#334155;margin-bottom:20px;">
      Your literature order for <strong>${groupName}</strong> is ready for pickup at the next area service meeting.
      Please bring the amount below.
    </p>
    <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#065f46;margin-bottom:4px;">Receipt Number</div>
      <div style="font-size:18px;font-weight:700;color:#065f46;font-family:monospace;">${receiptNumber}</div>
    </div>
    ${itemsTableHtml(items)}
    <div style="text-align:right;margin-top:16px;font-size:20px;font-weight:700;color:#065f46;">
      Amount Due at Pickup: ${formatMoney(revisedTotal)}
    </div>
    ${notes ? `<div style="margin-top:20px;padding:14px 18px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569;"><strong>Note from Lit Chair:</strong> ${notes}</div>` : ''}
    <p style="color:#64748b;font-size:13px;margin-top:24px;">
      Please bring exact change or a check payable to NORVANA if possible.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Order Ready for Pickup — ${receiptNumber} (${groupName})`,
    html,
  });
}
