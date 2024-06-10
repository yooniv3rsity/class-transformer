import { ClassConstructor, TypeHelpOptions, TypeOptions } from '..';
import { BaseMetadata } from './base-metadata.interface';

/**
 * This object represents metadata assigned to a property via the @Type decorator.
 */
export interface TypeMetadata extends BaseMetadata {

  /**
   * The property name this metadata belongs to on the target (property only).
   */
  propertyName: string;

  /**
   * The type guessed from assigned Reflect metadata ('design:type')
   */
  reflectedType: any;

  /**
   * type of structure, set by TypedStructure() decorator.
   * Explicit configuration to not rely on reflectedType or input value type any longer.
   */
  structureType?: ClassConstructor<any>;

  /**
   * The custom function provided by the user in the @Type decorator which
   * returns the target type for the transformation.
   */
  typeFunction: (options?: TypeHelpOptions) => Function;

  /**
   * Options passed to the @Type operator for this property.
   */
  options: TypeOptions;
}
