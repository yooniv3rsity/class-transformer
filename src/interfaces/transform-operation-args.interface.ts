import { ClassConstructor } from './class-constructor.type';

export interface TransformOperationArgs {
	source?: ClassConstructor<any>,
	value: Record<string, any> | Record<string, any>[] | any,
	targetType?: Function, 
	arrayType?: Function,
	isMap?: boolean,
	level?: number,
}
