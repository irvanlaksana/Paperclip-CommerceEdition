import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Product } from '@paperclip/shared';
import { DataStoreService } from '../storage/data-store.service.js';
import { newId, type Storable } from '../storage/data-store.js';

export interface ProductRecord extends Storable, Product {}

/** Demo catalog seeded into an empty store so the UI has something to pick. */
const DEMO_PRODUCTS: Array<Omit<Product, 'id'>> = [
  {
    name: 'Premium Wireless Earbuds Pro',
    description:
      'TWS dengan Hybrid Active Noise Cancelling, total baterai 40 jam bersama case, Bluetooth 5.3 low latency, driver 13mm, IPX5 tahan keringat, dan fast charge 10 menit untuk 2 jam pemakaian.',
    price: 499000,
    currency: 'IDR',
    sku: 'EARBUD-PRO-01',
    category: 'Audio',
    tags: ['tws', 'anc', 'audio', 'bluetooth'],
    attributes: {
      Baterai: '40 jam (dengan case)',
      Konektivitas: 'Bluetooth 5.3',
      Ketahanan: 'IPX5',
      Garansi: '12 bulan resmi',
    },
  },
  {
    name: 'Mechanical Keyboard RGB 75%',
    description:
      'Keyboard mekanikal layout 75% dengan gasket mount, hot-swappable 3/5 pin, keycap PBT double shot, koneksi triple mode (USB-C, 2.4GHz, Bluetooth), dan busa peredam 5 lapis.',
    price: 899000,
    currency: 'IDR',
    sku: 'KB-RGB-75',
    category: 'Aksesoris Komputer',
    tags: ['keyboard', 'mechanical', 'gaming', 'rgb'],
    attributes: {
      Layout: '75% (82 key)',
      Switch: 'Hot-swappable',
      Koneksi: 'Triple mode',
      Garansi: '12 bulan',
    },
  },
  {
    name: 'Ergonomic Office Chair Mesh Pro',
    description:
      'Kursi kerja ergonomis dengan sandaran mesh breathable, lumbar support adjustable, headrest 2D, armrest 3D, dan gas lift class-4 tahan beban 150 kg.',
    price: 2350000,
    currency: 'IDR',
    sku: 'CHAIR-ERGO-02',
    category: 'Furnitur Kantor',
    tags: ['kursi', 'ergonomis', 'kantor', 'wfh'],
    attributes: {
      Material: 'Mesh + aluminium base',
      'Beban maksimal': '150 kg',
      Fitur: 'Recline 90-135 derajat',
      Garansi: '24 bulan',
    },
  },
];

@Injectable()
export class ProductService implements OnModuleInit {
  private readonly logger = new Logger(ProductService.name);
  private readonly collection = 'products' as const;

  constructor(private readonly store: DataStoreService) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.store.list<ProductRecord>(this.collection);
    if (existing.length > 0) return;
    for (const product of DEMO_PRODUCTS) {
      await this.store.insert<ProductRecord>(this.collection, {
        ...product,
        id: newId('prod'),
      } as ProductRecord);
    }
    this.logger.log(`Seeded ${DEMO_PRODUCTS.length} produk demo ke katalog.`);
  }

  async list(): Promise<ProductRecord[]> {
    return this.store.list<ProductRecord>(this.collection);
  }

  async get(id: string): Promise<ProductRecord> {
    const all = await this.store.list<ProductRecord>(this.collection);
    const found = all.find((p) => p.id === id || p.sku === id);
    if (!found) throw new NotFoundException(`Produk "${id}" tidak ditemukan.`);
    return found;
  }

  async create(input: Omit<Product, 'id'> & { id?: string }): Promise<ProductRecord> {
    return this.store.insert<ProductRecord>(this.collection, {
      ...input,
      id: input.id ?? newId('prod'),
    } as ProductRecord);
  }

  async update(id: string, patch: Partial<Product>): Promise<ProductRecord> {
    const current = await this.get(id);
    const next = { ...current, ...patch, id: current.id } as ProductRecord;
    return (await this.store.update<ProductRecord>(this.collection, id, next)) ?? next;
  }

  async remove(id: string): Promise<boolean> {
    return this.store.remove(this.collection, id);
  }
}
