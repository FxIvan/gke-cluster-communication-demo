import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  brand: string;
  sku: string;
}

@Injectable()
export class ProductsService {
  private readonly products: Product[];

  constructor() {
    // Carga el JSON estático como si fuera la base de datos
    const dbPath = path.resolve(__dirname, 'products.db.json');
    this.products = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    console.log(`[Cluster B] Loaded ${this.products.length} products from static DB`);
  }

  findAll() {
    return {
      source: 'cluster-b',
      node: process.env.NODE_NAME || 'local',
      region: 'us-central1',
      totalItems: this.products.length,
      data: this.products,
      timestamp: new Date().toISOString(),
    };
  }

  findOne(id: string) {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return {
      source: 'cluster-b',
      node: process.env.NODE_NAME || 'local',
      region: 'us-central1',
      data: product,
      timestamp: new Date().toISOString(),
    };
  }

  findByCategory(category: string) {
    const filtered = this.products.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase(),
    );
    return {
      source: 'cluster-b',
      node: process.env.NODE_NAME || 'local',
      region: 'us-central1',
      category,
      totalItems: filtered.length,
      data: filtered,
      timestamp: new Date().toISOString(),
    };
  }
}
