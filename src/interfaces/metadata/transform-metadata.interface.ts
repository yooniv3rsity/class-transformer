import { TransformOptions } from '..';
import { BaseMetadata } from './base-metadata.interface';
import { TransformFnParams } from './transform-fn-params.interface';

/**
 * This object represents metadata assigned to a property via the @Transform decorator.
 */
export interface TransformMetadata extends BaseMetadata {

  /**
   * The property name this metadata belongs to on the target (property only).
   */
  propertyName: string;

  /**
   * The custom transformation function provided by the user in the @Transform decorator.
   */
  transformFn: (params: TransformFnParams) => any;

  /**
   * Options passed to the @Transform operator for this property.
   */
  options: TransformOptions;
}
