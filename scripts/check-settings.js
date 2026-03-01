const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenants = await prisma.tenants.findMany({
    select: { id: true, name: true, gibSettings: true, captchaKey: true }
  });

  console.log('\n=== TENANT AYARLARI ===\n');

  tenants.forEach(t => {
    const settings = t.gibSettings || {};
    console.log('Tenant:', t.name);
    console.log('  ID:', t.id);
    console.log('  gibSettings.gibCode:', settings.gibCode || '(yok)');
    console.log('  gibSettings.gibPassword:', settings.gibPassword ? 'VAR' : '(yok)');
    console.log('  gibSettings.captchaKey:', settings.captchaKey || '(yok)');
    console.log('  captchaKey (column):', t.captchaKey || '(yok)');
    console.log('');
  });

  console.log('=== ENV CAPTCHA KEY ===');
  console.log('  CAPTCHA_API_KEY:', process.env.CAPTCHA_API_KEY || '(yok)');
  console.log('  TWOCAPTCHA_API_KEY:', process.env.TWOCAPTCHA_API_KEY || '(yok)');

  await prisma.$disconnect();
}

check().catch(console.error);
