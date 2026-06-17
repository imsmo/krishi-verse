// modules/catalogue/domain/category.entity.ts · read model for a global taxonomy node.
// Categories are PLATFORM master data (Law 6) — managed in admin-api, read here. The
// ltree `path` + `depth` give the 5-level tree; commerceKind/requires* drive listing rules.
export interface CategoryProps {
  id: string; parentId: string | null; code: string; defaultName: string; path: string; depth: number;
  commerceKind: string; requiresLicense: boolean; requiresCertificate: boolean; minAge: number | null;
  isActive: boolean; sortOrder: number;
}
export class Category {
  constructor(readonly props: CategoryProps) {}
  get id() { return this.props.id; }
  get isActive() { return this.props.isActive; }
}
