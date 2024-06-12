import { ClassConstructor } from './class-constructor.type';
import { TypeMetadata } from './metadata';

export interface TransformOperationArgs {
	source?: ClassConstructor<any>,
	value: Record<string, any> | any,
	targetType?: Function, 
	typeMetadata?: TypeMetadata,
	structureType?: ClassConstructor<any>,
	isMap?: boolean,
	level?: number,
}
