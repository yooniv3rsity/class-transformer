import { TransformOperationExecutor } from '../TransformOperationExecutor';
import { TypeMetadata } from './metadata/type-metadata.interface';

interface ExecuteTransformationArguments {
  source: Record<string, any> | Record<string, any>[] | any;
  value: Record<string, any> | Record<string, any>[] | any;
  targetType: Function | TypeMetadata;
  arrayType: Function;
  isMap: boolean;
  level: number;
}

export type ExecuteTransformationHandler = (
  transformArguments: ExecuteTransformationArguments,
  executor: TransformOperationExecutor
) => any;
