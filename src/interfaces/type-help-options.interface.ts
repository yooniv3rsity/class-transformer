import { TransformOperationExecutor } from '../TransformOperationExecutor';
import { ClassTransformerExternalDependencies } from './external-dependencies.interface';
import { ObjectLikeStructure } from './object-like-structure.type';

// TODO: Document this interface. What does each property means?
export interface TypeHelpOptions {
  newObject: ObjectLikeStructure|Array<any>;
  object: Record<string, any>;
  property: string|undefined;
  dependencies: ClassTransformerExternalDependencies;
  executor: TransformOperationExecutor;
}
