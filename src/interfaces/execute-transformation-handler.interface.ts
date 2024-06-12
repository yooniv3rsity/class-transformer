import { TransformOperationExecutor } from '../TransformOperationExecutor';
import { TransformOperationArgs } from './transform-operation-args.interface';


export type ExecuteTransformationHandler = (
  transformArguments: TransformOperationArgs,
  executor: TransformOperationExecutor
) => any;
