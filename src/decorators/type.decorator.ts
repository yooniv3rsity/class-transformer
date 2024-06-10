import { defaultMetadataStorage } from '../storage';
import { ClassConstructor, TypeHelpOptions, TypeOptions } from '../interfaces';

/**
* Specifies a type of the property.
* The given TypeFunction can return a constructor. A discriminator can be given in the options.
*
* Can be applied to properties only.
*/
export function Type(
	typeFunction?: (type?: TypeHelpOptions) => Function,
	options: TypeOptions = {}
): PropertyDecorator {
	return function (target: any, propertyName: string | Symbol): void {
		const reflectedType = (Reflect as any).getMetadata(
			'design:type',
			target,
			propertyName
		);
		defaultMetadataStorage.addTypeMetadata({
			target: target.constructor,
			propertyName: propertyName as string,
			reflectedType,
			typeFunction,
			options,
		});
	};
}

/**
 * like @Type but with explicitly configurated Structure type.
 * Allows to get rid of Reflection to determine if the property contains a child object or a Map/Array/Set.
 */
export function TypedStructure(
	structureType: ClassConstructor<Map<any,any>>|ClassConstructor<Array<any>>|ClassConstructor<Set<any>>,
	typeFunction: (type?: TypeHelpOptions) => Function,
	options: TypeOptions = {}
): PropertyDecorator {
	return function (target: any, propertyName: string | Symbol): void {
		defaultMetadataStorage.addTypeMetadata({
			target: target.constructor,
			propertyName: propertyName as string,
			reflectedType: null,
			structureType,
			typeFunction,
			options,
		});
	};
}
