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
import { BrandsController } from './controllers/v1/brands.controller';
import { AttributeTemplatesController } from './controllers/v1/attribute-templates.controller';
import { ProductsController } from './controllers/v1/products.controller';
import { BatchesController } from './controllers/v1/batches.controller';
import { CategoryService } from './services/category.service';
import { AttributeDefinitionService } from './services/attribute-definition.service';
import { AttributeOptionService } from './services/attribute-option.service';
import { AttributeTemplateService } from './services/attribute-template.service';
import { CategoryAttributeService } from './services/category-attribute.service';
import { BrandService } from './services/brand.service';
import { ProductService } from './services/product.service';
import { ProductBatchService } from './services/product-batch.service';
import { ProductSearchReadModel } from './read-models/product-search.read-model';
import { CategoryRepository } from './repositories/category.repository';
import { AttributeDefinitionRepository } from './repositories/attribute-definition.repository';
import { AttributeOptionRepository } from './repositories/attribute-option.repository';
import { AttributeTemplateRepository } from './repositories/attribute-template.repository';
import { CategoryAttributeRepository } from './repositories/category-attribute.repository';
import { BrandRepository } from './repositories/brand.repository';
import { ProductRepository } from './repositories/product.repository';
import { ProductBatchRepository } from './repositories/product-batch.repository';

@Module({
  controllers: [CategoriesController, AttributesController, BrandsController, AttributeTemplatesController, ProductsController, BatchesController],
  providers: [
    CategoryService, AttributeDefinitionService, AttributeOptionService, AttributeTemplateService, CategoryAttributeService, BrandService,
    ProductService, ProductBatchService, ProductSearchReadModel,
    CategoryRepository, AttributeDefinitionRepository, AttributeOptionRepository, AttributeTemplateRepository, CategoryAttributeRepository, BrandRepository,
    ProductRepository, ProductBatchRepository,
    ProductBulkApplier,
  ],
  // public surface for other modules (Law 11): services only, never repositories
  exports: [CategoryService, AttributeDefinitionService, AttributeOptionService, AttributeTemplateService, CategoryAttributeService, BrandService, ProductService, ProductSearchReadModel],
})
export class CatalogueModule implements OnModuleInit {
  constructor(
    @Inject(BULK_APPLIER_REGISTRY) private readonly bulkRegistry: BulkApplierRegistry,
    private readonly productApplier: ProductBulkApplier,
  ) {}
  // Plug the product CSV applier into the core bulk-import platform (import_type='products').
  onModuleInit(): void { this.bulkRegistry.register(this.productApplier); }
}
