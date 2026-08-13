// app/shop/checkout/page.js
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CheckoutForm from './CheckoutForm';

export default async function CheckoutPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Load default address if exists
  const { data: address } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single();

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      <CheckoutForm user={user} defaultAddress={address} />
    </main>
  );
}
