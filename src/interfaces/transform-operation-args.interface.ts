import { ClassConstructor } from './class-constructor.type';
import { TypeMetadata } from './metadata';

export interface TransformOperationArgs {
	source?: ClassConstructor<any>,
	value: Record<string, any> | Record<string, any>[] | any,
	targetType?: Function | TypeMetadata,
	arrayType?: Function,
	isMap?: boolean,
	level?: number,
}
