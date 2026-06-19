// modules/livestock/domain/animal-breed.entity.ts · read-only VO for animal_breeds (global master data).
export interface AnimalBreedProps { id: string; speciesId: string; code: string; defaultName: string; isIndigenous: boolean; originRegionId: string | null; }
export class AnimalBreed {
  private constructor(private readonly props: AnimalBreedProps) {}
  static rehydrate(p: AnimalBreedProps): AnimalBreed { return new AnimalBreed(p); }
  get id() { return this.props.id; }
  get speciesId() { return this.props.speciesId; }
  toJSON() { return { id: this.props.id, speciesId: this.props.speciesId, code: this.props.code, name: this.props.defaultName, isIndigenous: this.props.isIndigenous, originRegionId: this.props.originRegionId }; }
}
