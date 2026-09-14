import 'dotenv/config';
import { createPrismaClient } from '../src/client.js';

/**
 * Seeds a demo company plus one AI provider per type that has credentials in
 * the environment. Safe to re-run: providers are matched by (type, name).
 */
async function main() {
  const prisma = await createPrismaClient();

  const company = await prisma.company.upsert({
    where: { id: 'company_demo' },
    update: {},
    create: {
      id: 'company_demo',
      name: 'Demo Commerce Co.',
      industry: 'Consumer Electronics',
    },
  });

  const products = [
    {
      id: 'product_earbuds',
      name: 'Premium Wireless Earbuds Pro',
      description: 'Hybrid ANC, baterai 40 jam, Bluetooth 5.3, IPX5.',
      price: 499000,
      sku: 'EARBUD-PRO-01',
      category: 'Audio',
      tags: ['tws', 'anc', 'audio'],
    },
    {
      id: 'product_keyboard',
      name: 'Mechanical Keyboard RGB 75%',
      description: 'Hot-swappable, gasket mount, keycap PBT double shot.',
      price: 899000,
      sku: 'KB-RGB-75',
      category: 'Aksesoris Komputer',
      tags: ['keyboard', 'mechanical', 'gaming'],
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: { ...product, companyId: company.id },
    });
  }

  console.log(`Seeded company "${company.name}" with ${products.length} products.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
