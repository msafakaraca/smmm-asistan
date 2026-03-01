import { redirect } from 'next/navigation';

/**
 * Eski /dashboard/kontrol route'u
 * Artık /dashboard/kontrol-cizelgesi'ne yönlendiriyor.
 */
export default function KontrolRedirectPage() {
    redirect('/dashboard/kontrol-cizelgesi');
}
