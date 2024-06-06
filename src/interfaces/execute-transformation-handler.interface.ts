import { TransformOperationExecutor } from '../TransformOperationExecutor';
import { ClassConstructor } from './class-constructor.type';
import { TypeMetadata } from './metadata/type-metadata.interface';

interface ExecuteTransformationArguments {
  source: ClassConstructor<any>|undefined;
  value: Record<string, any> | Record<string, any>[] | any | undefined;
  targetType: Function | TypeMetadata | undefined;
  arrayType: Function | undefined;
  isMap: boolean | undefined;
  level: number;
}

export type ExecuteTransformationHandler = (
  transformArguments: ExecuteTransformationArguments,
  executor: TransformOperationExecutor
) => any;
