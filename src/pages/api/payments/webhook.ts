import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import crypto from 'crypto';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    
    if (!signature || !timestamp) {
      return new Response('Missing signature', { status: 400 });
    }

    const secretKey = import.meta.env.CASHFREE_SECRET_KEY;
    if (!secretKey) throw new Error('CASHFREE_SECRET_KEY is missing');

    // Verify signature
    const expectedData = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(expectedData)
      .digest('base64');

    if (expectedSignature !== signature) {
      return new Response('Invalid signature', { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    
    if (payload.type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const orderId = payload.data.order.order_id;
      const paymentStatus = payload.data.payment.payment_status; // Should be 'SUCCESS'

      if (paymentStatus === 'SUCCESS') {
        const supabase = createSupabaseClient(cookies, request);

        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('order_id', orderId)
          .single();

        if (order && order.status !== 'PAID') {
          await supabase.from('orders').update({ status: 'PAID' }).eq('order_id', orderId);

          if (order.item_type === 'WORKSHOP') {
            await supabase.from('workshop_registrations').update({ status: 'CONFIRMED' }).eq('order_id', orderId);

            // Send Email
            const { data: workshop } = await supabase.from('workshops').select('*').eq('id', order.item_id).single();
            const { data: userProfile } = await supabase.from('user_profiles').select('email, full_name').eq('id', order.user_id).single();

            if (workshop && userProfile && userProfile.email) {
              const resendApiKey = import.meta.env.RESEND_API_KEY;
              if (resendApiKey) {
                const resend = new Resend(resendApiKey);
                await resend.emails.send({
                  from: 'Prompster <noreply@prompster.art>',
                  to: userProfile.email,
                  subject: `Registration Confirmed: ${workshop.title}`,
                  html: `
                    <h2>Hi ${userProfile.full_name || 'there'},</h2>
                    <p>Your payment was successful and your registration for the workshop <strong>${workshop.title}</strong> is confirmed!</p>
                    <p><strong>Date & Time:</strong> ${new Date(workshop.scheduled_date).toLocaleString()}</p>
                    <p><strong>Format:</strong> ${workshop.format}</p>
                    <div style="margin: 20px 0; padding: 15px; background: #f4f4f5; border-radius: 8px;">
                      <p style="margin:0;"><strong>Joining Link / Venue Details:</strong></p>
                      <p style="margin-top:5px;">${workshop.invite_link_or_venue}</p>
                    </div>
                    <p>See you there!</p>
                    <p>- The Prompster Team</p>
                  `
                });
              }
            }
          }
        }
      }
    } else if (payload.type === 'PAYMENT_FAILED_WEBHOOK') {
        const orderId = payload.data.order.order_id;
        const supabase = createSupabaseClient(cookies, request);
        
        const { data: order } = await supabase.from('orders').select('*').eq('order_id', orderId).single();
        if (order && order.status === 'PENDING') {
             await supabase.from('orders').update({ status: 'FAILED' }).eq('order_id', orderId);
             if (order.item_type === 'WORKSHOP') {
                await supabase.from('workshop_registrations').update({ status: 'CANCELLED' }).eq('order_id', orderId);
             }
        }
    }

    return new Response('Webhook received', { status: 200 });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(error.message, { status: 500 });
  }
};
