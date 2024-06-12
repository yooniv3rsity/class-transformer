import { ClassConstructor } from './class-constructor.type';

export interface TransformOperationArgs {
	source?: ClassConstructor<any>,
	value: Record<string, any> | Record<string, any>[] | any,
	targetType?: Function, 
	structureType?: ClassConstructor<any>,
	isMap?: boolean,
	level?: number,
}
