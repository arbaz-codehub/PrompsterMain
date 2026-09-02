import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import crypto from 'crypto';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseClient(cookies, request);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { itemId, itemType } = await request.json(); // itemType: 'WORKSHOP' or 'PRODUCT'

    if (!itemId || !itemType) {
      return new Response(JSON.stringify({ error: 'Missing itemId or itemType' }), { status: 400 });
    }

    let amount = 0;
    let customerName = user.user_metadata?.full_name || 'Customer';
    let customerEmail = user.email || 'customer@example.com';
    let customerPhone = '9999999999'; // Default fallback since phone might not be collected

    if (itemType === 'WORKSHOP') {
      // 1. Fetch workshop details
      const { data: workshop, error: workshopError } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', itemId)
        .single();

      if (workshopError || !workshop) {
        return new Response(JSON.stringify({ error: 'Workshop not found' }), { status: 404 });
      }

      amount = workshop.fee_amount;

      // 2. Check for existing registration
      const { data: existingReg } = await supabase
        .from('workshop_registrations')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('workshop_id', workshop.id)
        .maybeSingle();

      if (existingReg && existingReg.status === 'CONFIRMED') {
        return new Response(JSON.stringify({ error: 'Already registered for this workshop' }), { status: 400 });
      }

    } else if (itemType === 'PRODUCT') {
      // Implement logic for product fetching
      // For now, mock it or return error if not fully implemented
      return new Response(JSON.stringify({ error: 'Products not yet implemented' }), { status: 400 });
    }

    // 3. Generate unique order ID
    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;

    // 4. Create Order in Supabase
    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        order_id: orderId,
        user_id: user.id,
        amount: amount,
        currency: 'INR',
        item_type: itemType,
        item_id: itemId,
        status: 'PENDING'
      });

    if (orderError) throw orderError;

    // Create pending registration for workshops
    if (itemType === 'WORKSHOP') {
      // We delete any previous PENDING registration to avoid unique constraint violations
      await supabase
        .from('workshop_registrations')
        .delete()
        .match({ user_id: user.id, workshop_id: itemId, status: 'PENDING' });

      const { error: regError } = await supabase
        .from('workshop_registrations')
        .insert({
          user_id: user.id,
          workshop_id: itemId,
          order_id: orderId,
          status: 'PENDING'
        });

      if (regError) throw regError;
    }

    // 5. Call Cashfree API
    const appId = import.meta.env.CASHFREE_APP_ID;
    const secretKey = import.meta.env.CASHFREE_SECRET_KEY;
    const env = import.meta.env.CASHFREE_ENV || 'SANDBOX';
    const baseUrl = env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    const cashfreeRequest = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: user.id,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      },
      order_meta: {
        return_url: `${import.meta.env.SITE_URL || 'https://www.prompster.shop'}/api/payments/verify?order_id={order_id}`
      }
    };

    const cfResponse = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01'
      },
      body: JSON.stringify(cashfreeRequest)
    });

    if (!cfResponse.ok) {
      const errText = await cfResponse.text();
      console.error('Cashfree error:', errText);
      throw new Error('Failed to create Cashfree order');
    }

    const cfData = await cfResponse.json();

    return new Response(JSON.stringify({
      payment_session_id: cfData.payment_session_id,
      order_id: orderId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Create order error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
};
