import { ExposeOptions } from '..';
import { BaseMetadata } from './base-metadata.interface';

/**
 * This object represents metadata assigned to a property via the @Expose decorator.
 */
export interface ExposeMetadata extends BaseMetadata {

  /**
   * Options passed to the @Expose operator for this property.
   */
  options: ExposeOptions;
}
