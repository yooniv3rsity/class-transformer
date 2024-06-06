import { ExcludeOptions } from '..';
import { BaseMetadata } from './base-metadata.interface';

/**
 * This object represents metadata assigned to a property via the @Exclude decorator.
 */
export interface ExcludeMetadata extends BaseMetadata {

  /**
   * Options passed to the @Exclude operator for this property.
   */
  options: ExcludeOptions;
}
