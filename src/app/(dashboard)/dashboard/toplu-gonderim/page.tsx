import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserWithProfile } from '@/lib/supabase/auth';
import { prisma } from '@/lib/db';
import { BulkSendPage } from '@/components/bulk-send/bulk-send-page';

export const metadata: Metadata = {
  title: 'Toplu Gönderim | SMMM Asistan',
  description: 'Beyanname ve tahakkukları mükelleflere toplu olarak gönderin',
};

// Gruplar her zaman güncel olsun - cache'i devre dışı bırak
export const dynamic = 'force-dynamic';

export default async function TopluGonderimPage() {
  const user = await getUserWithProfile();

  if (!user) {
    redirect('/login');
  }

  // Müşteri listesini çek (filtreler için)
  const customers = await prisma.customers.findMany({
    where: {
      tenantId: user.tenantId,
      status: 'active',
    },
    select: {
      id: true,
      unvan: true,
      kisaltma: true,
    },
    orderBy: {
      unvan: 'asc',
    },
  });

  // Müşteri gruplarını çek
  const groups = await prisma.customer_groups.findMany({
    where: {
      tenantId: user.tenantId,
    },
    include: {
      _count: { select: { customer_group_members: true } },
      customer_group_members: {
        select: { customerId: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const customerGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    memberCount: g._count.customer_group_members,
    members: g.customer_group_members.map((m) => ({ id: m.customerId })),
    beyannameTypes: g.beyannameTypes,
  }));

  return (
    <div className="h-[calc(100vh-5rem)] bg-white overflow-hidden -m-4 xl:-m-6">
      <BulkSendPage customers={customers} customerGroups={customerGroups} />
    </div>
  );
}
