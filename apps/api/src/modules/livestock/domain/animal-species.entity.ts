// modules/livestock/domain/animal-species.entity.ts · read-only VO for animal_species (global master data).
export interface AnimalSpeciesProps { id: string; code: string; defaultName: string; isActive: boolean; }
export class AnimalSpecies {
  private constructor(private readonly props: AnimalSpeciesProps) {}
  static rehydrate(p: AnimalSpeciesProps): AnimalSpecies { return new AnimalSpecies(p); }
  get id() { return this.props.id; }
  toJSON() { return { id: this.props.id, code: this.props.code, name: this.props.defaultName, isActive: this.props.isActive }; }
}
