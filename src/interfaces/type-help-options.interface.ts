import { TransformOperationExecutor } from '../TransformOperationExecutor';
import { ClassTransformerExternalDependencies } from './external-dependencies.interface';

// TODO: Document this interface. What does each property means?
export interface TypeHelpOptions {
  newObject: any;
  object: Record<string, any>;
  property: string;
  dependencies: ClassTransformerExternalDependencies;
  executor: TransformOperationExecutor;
}
