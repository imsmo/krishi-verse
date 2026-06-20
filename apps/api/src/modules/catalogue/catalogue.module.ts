// modules/catalogue/catalogue.module.ts
// Tenant-facing catalogue: browse global categories/attributes/products + manage the
// tenant's OWN categories (enable/disable), private products, and store batches. GLOBAL
// taxonomy WRITES (categories/attributes/platform products/brands/templates) live in
// apps/admin-api (Law 11) and are intentionally not exposed here.
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { BULK_APPLIER_REGISTRY, BulkApplierRegistry } from '../../core/bulk/bulk-applier.registry';
import { ProductBulkApplier } from './bulk/product-bulk-applier';
import { CategoriesController } from './controllers/v1/categories.controller';
import { AttributesController } from './controllers/v1/attributes.controller';
import { ProductsController } from './controllers/v1/products.controller';
import { BatchesController } from './controllers/v1/batches.controller';
import { CategoryService } from './services/category.service';
import { AttributeDefinitionService } from './services/attribute-definition.service';
import { ProductService } from './services/product.service';
import { ProductBatchService } from './services/product-batch.service';
import { ProductSearchReadModel } from './read-models/product-search.read-model';
import { CategoryRepository } from './repositories/category.repository';
import { AttributeDefinitionRepository } from './repositories/attribute-definition.repository';
import { ProductRepository } from './repositories/product.repository';
import { ProductBatchRepository } from './repositories/product-batch.repository';

@Module({
  controllers: [CategoriesController, AttributesController, ProductsController, BatchesController],
  providers: [
    CategoryService, AttributeDefinitionService, ProductService, ProductBatchService, ProductSearchReadModel,
    CategoryRepository, AttributeDefinitionRepository, ProductRepository, ProductBatchRepository,
    ProductBulkApplier,
  ],
  // public surface for other modules (Law 11): services only, never repositories
  exports: [CategoryService, AttributeDefinitionService, ProductService, ProductSearchReadModel],
})
export class CatalogueModule implements OnModuleInit {
  constructor(
    @Inject(BULK_APPLIER_REGISTRY) private readonly bulkRegistry: BulkApplierRegistry,
    private readonly productApplier: ProductBulkApplier,
  ) {}
  // Plug the product CSV applier into the core bulk-import platform (import_type='products').
  onModuleInit(): void { this.bulkRegistry.register(this.productApplier); }
}
