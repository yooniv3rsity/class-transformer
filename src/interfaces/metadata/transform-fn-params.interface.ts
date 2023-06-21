import { TransformOperationExecutor } from '../../TransformOperationExecutor';
import { TransformationType } from '../../enums';
import { ClassTransformOptions } from '../class-transformer-options.interface';
import { ClassTransformerExternalDependencies } from '../external-dependencies.interface';

export interface TransformFnParams {
  value: any;
  key: string;
  obj: any;
  type: TransformationType;
  options: ClassTransformOptions;
  dependencies: ClassTransformerExternalDependencies;
  executor: TransformOperationExecutor;
}
