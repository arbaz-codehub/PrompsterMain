import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import { Resend } from 'resend';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order_id');

  if (!orderId) {
    return redirect('/?error=missing_order_id');
  }

  const supabase = createSupabaseClient(cookies, request);

  try {
    const appId = import.meta.env.CASHFREE_APP_ID;
    const secretKey = import.meta.env.CASHFREE_SECRET_KEY;
    const env = import.meta.env.CASHFREE_ENV || 'SANDBOX';
    const baseUrl = env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    const cfResponse = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01'
      }
    });

    if (!cfResponse.ok) {
      return redirect('/?error=cashfree_verification_failed');
    }

    const cfData = await cfResponse.json();
    const orderStatus = cfData.order_status; // 'PAID', 'ACTIVE', 'EXPIRED' etc.

    // Get order from DB
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (!order) {
      return redirect('/?error=order_not_found');
    }

    if (orderStatus === 'PAID' && order.status !== 'PAID') {
      // Update order
      await supabase
        .from('orders')
        .update({ status: 'PAID' })
        .eq('order_id', orderId);

      if (order.item_type === 'WORKSHOP') {
        await supabase
          .from('workshop_registrations')
          .update({ status: 'CONFIRMED' })
          .eq('order_id', orderId);

        // Fetch workshop details to send email
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

    if (orderStatus === 'PAID') {
        // Redirect to success page or workshop page
        if (order.item_type === 'WORKSHOP') {
             // In a real app we might redirect to a nice success page.
             // We can pass a success param to trigger a toast.
             const { data: workshop } = await supabase.from('workshops').select('slug').eq('id', order.item_id).single();
             if (workshop) {
                return redirect(`/workshops/${workshop.slug}?payment=success`);
             }
        }
        return redirect('/?payment=success');
    } else {
        return redirect('/?payment=failed');
    }

  } catch (err) {
    console.error('Verify error:', err);
    return redirect('/?error=server_error');
  }
};
