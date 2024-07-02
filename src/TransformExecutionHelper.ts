import { TransformationType, StructureTypeGroup } from './enums';
import { ClassConstructor, ObjectLikeStructure, TransformOperationArgs, TypeHelpOptions, TypeMetadata } from './interfaces';
import { defaultMetadataStorage } from './storage';

/* eslint-disable @typescript-eslint/no-namespace */
export namespace TransformExecutionHelper {

	export function determinestructureTypeGroup(value:any, metadata:TypeMetadata): StructureTypeGroup | null {
		// TODO: unrealiable. we should not set expected structure type based on the incoming value.
		// possibly this makes nested maps work, because if c.isMap is true, stuff will be skipped
		// interestingly, no tests fail when commenting this out.
		if(value instanceof Map) return StructureTypeGroup.Map;
		else if (Array.isArray(value)) return StructureTypeGroup.Array;
		return null;
	}

	export function getStructureType(structureTypeGroup:StructureTypeGroup|null, metadata:TypeMetadata): ClassConstructor<any>|null {
		if(structureTypeGroup === StructureTypeGroup.Map) {
			return Map;
		} else if(structureTypeGroup === StructureTypeGroup.Set) {
			return Set;
		} else if(structureTypeGroup === StructureTypeGroup.Object) {
			return Object;
		} else if(structureTypeGroup === StructureTypeGroup.Array) {
			// if value is an array try to get its custom array type
			// Note: In case of arrays, a custom prop named structureType will be passed in TransformOperationArgs.
			if(metadata?.reflectedType) return metadata.reflectedType;
			else return Array;
		}
		return null;
	}

	export function getStructureTypeGroup(structureType:ClassConstructor<any>):StructureTypeGroup|null {
		if(structureType === Array || structureType.prototype instanceof Array) return StructureTypeGroup.Array
		if(structureType === Set || structureType.prototype instanceof Set) return StructureTypeGroup.Set
		if(structureType === Map || structureType.prototype instanceof Map) return StructureTypeGroup.Map
		if(structureType === Object || structureType.prototype instanceof Object) return StructureTypeGroup.Object
		return null;
	}

	export function createTargetStructure( c:TransformOperationArgs, transformationType: TransformationType ): ObjectLikeStructure {
		const {source, isMap, targetType} = c;
		let targetStructure: ObjectLikeStructure = source ? source : {};
		  
		if ( !source && transformationType !== TransformationType.CLASS_TO_PLAIN) {
			if (isMap) {
				targetStructure = new Map();
			} else if (targetType) {
				targetStructure = es2022Fix(new (targetType as any)());
			} else {
				targetStructure = {};
			}
		}
		return targetStructure;
	}

	// es2022 introduces a new behavior resulting in behavior change.
	// all class props will be initialized to undefined instead of being "not defined at all"
	// this helper will remove these props to ensure explicit property exposure continues to work.
	// the fix introduces a minimal behavior change on its own:
	// when initializing a property to undefined manually ( ctor: this.myProp = undefined ),
	// it will be deleted (which makes no difference in 99% of cases). 
	// All property initializers !== undefined will work correctly.
	// https://github.com/typestack/class-transformer/issues/1216
	function es2022Fix<T extends object>(instance:T):T {
		for (const key of Object.keys(instance)) {
			if(instance[key] === undefined) delete instance[key];
		}
		return instance
	}

	export function isPrimitiveType(type:Function|undefined) {
		return (type === String || type === Number || type === Boolean || type === BigInt)
	}
	
	export function addPropertyToStructure( targetStructure: ObjectLikeStructure, newValueKey: string, newPropValue: any) {
		if (targetStructure instanceof Map) {
		  targetStructure.set(newValueKey, newPropValue);
		} else {
		  targetStructure[newValueKey] = newPropValue;
		}
	}

	export function createArrayLike(c:TransformOperationArgs, transformationType: TransformationType): Array<any> | Set<any> {
		const structureType = c.structureType;
		if(structureType && transformationType === TransformationType.PLAIN_TO_CLASS) {
			const array = new (structureType as any)();
			// fallback in case an incompatible constructor was set
			if (!(array instanceof Set) && !(Array.isArray(array))) return [];
			return array;
		} else {
			return []
		}
	}
	
	export function addPropertyToArrayLike( arrayLike: Array<any>|Set<any>, value: any) {
		if (arrayLike instanceof Set) {
			arrayLike.add(value);
		} else {
			arrayLike.push(value);
		}
	}

	export function getPropertyFromStructure( targetStructure: ObjectLikeStructure, key: string	): any {
		if (targetStructure instanceof Map) return targetStructure.get(key);
		else return targetStructure[key];
	}

	export function checkTargetStructureForConflictingProperty(
		targetStructure: Record<string, any> | Map<string, any>,
		newValueKey: string,
		transformationType: TransformationType
	) {
		// if targetStructure has a function named like the current property, then skip it
		if ( targetStructure.constructor.prototype && !(targetStructure instanceof Map)	) {
			const descriptor = Object.getOwnPropertyDescriptor(
				targetStructure.constructor.prototype,
				newValueKey
			);
			if (transformationType !== TransformationType.CLASS_TO_PLAIN &&
				((descriptor && !descriptor.set) ||
				targetStructure[newValueKey] instanceof Function)
			) {
				return true;
			}
		}
		return false;
	}
	
 	 // TODO: find out what propertyName + newValueKey actually does
	export function getTargetPropertyKeyName(
		originalKey: string,
		targetType: Function | TypeMetadata | undefined,
		ignoreDecorators: boolean,
		transformationType:TransformationType
	): { propertyName: string; newValueKey: string } {
		let newValueKey = originalKey;
		let propertyName = originalKey;

		if (!ignoreDecorators && targetType) {
			if (transformationType === TransformationType.PLAIN_TO_CLASS) {
				const exposeMetadata =
				defaultMetadataStorage.findExposeMetadataByCustomName(
					targetType as Function,
					originalKey
				);
				if (exposeMetadata) {
				propertyName = exposeMetadata.propertyName;
				newValueKey = exposeMetadata.propertyName;
				}
			} else if (
				transformationType === TransformationType.CLASS_TO_PLAIN ||
				transformationType === TransformationType.CLASS_TO_CLASS
			) {
				const exposeMetadata = defaultMetadataStorage.findExposeMetadata(
				targetType as Function,
				originalKey
				);
				if (exposeMetadata?.options?.name) {
				newValueKey = exposeMetadata.options.name;
				}
			}
		}

		return { propertyName, newValueKey };
	}

	export function checkGroups(requestedGroups: string[], definedGroups: string[]): boolean {
		if (!requestedGroups) return true;
		return definedGroups.some((optionGroup) => requestedGroups.includes(optionGroup));
	}

	
	export function filterKeysByVersion(keys: any[], target: Function, version:number|undefined) {
		if (version !== undefined) {
			keys = keys.filter((key) => {
				const exposeMetadata = defaultMetadataStorage.findExposeMetadata(
					target,
					key
				);
				if (!exposeMetadata || !exposeMetadata.options) return true;

				return checkVersion( exposeMetadata.options.since, exposeMetadata.options.until, version);
			});
		}
		return keys;
	}

	export function checkVersion(since: number, until: number, version:number): boolean {
		let decision = true;
		if (decision && since) decision = version >= since;
		if (decision && until) decision = version < until;
		return decision;
	}
	
	export function filterKeysByGroup(keys: any[], target: Function, groups:string[]) {
		if (groups.length) {
			keys = keys.filter((key) => {
				const exposeMetadata = defaultMetadataStorage.findExposeMetadata(
					target,
					key
				);
				if (!exposeMetadata || !exposeMetadata.options) return true;
				return checkGroups(exposeMetadata.options.groups, groups || []);
			});
		} else {
			keys = keys.filter((key) => {
				const exposeMetadata = defaultMetadataStorage.findExposeMetadata(
					target,
					key
				);
				const metaGroupsCount = exposeMetadata?.options?.groups?.length
				return !metaGroupsCount;
			});
		}
		return keys;
	}

	export function getTargetKeysIgnoringDecorators(target: Function, keys: any[], transformationType:TransformationType) {
		const exposedProperties = defaultMetadataStorage.getExposedProperties(target,transformationType	);
		const excludedProperties = defaultMetadataStorage.getExcludedProperties( target, transformationType	);
		return [...exposedProperties, ...excludedProperties];
	}

	export function getTargetKeysBasedOnDecorators(target: Function, keys: any[], transformationType:TransformationType, excludeExtraneousValues:boolean) {
		let exposedProperties = defaultMetadataStorage.getExposedProperties( target, transformationType);
		if (transformationType === TransformationType.PLAIN_TO_CLASS) {
			exposedProperties = exposedProperties.map((key) => {
				const exposeMetadata = defaultMetadataStorage.findExposeMetadata( target, key );
				if (exposeMetadata?.options?.name) return exposeMetadata.options.name;
				else return key;
			});
		}
		if (excludeExtraneousValues) {
			keys = exposedProperties;
		} else {
			keys = keys.concat(exposedProperties);
		}
	
		// exclude excluded properties
		const excludedProperties = defaultMetadataStorage.getExcludedProperties( target, transformationType );
		if (excludedProperties.length > 0) {
			keys = keys.filter((key) => {
				return !excludedProperties.includes(key);
			});
		}
	
		return keys;
	}
	
	export function filterExcludedKeys(keys: any[], excludePrefixes:string[]|undefined) {
		if (excludePrefixes?.length) {
			keys = keys.filter((key) =>
				excludePrefixes.every((prefix) => {
					return key.substr(0, prefix.length) !== prefix;
				})
			);
		}
		return keys;
	}

	// in original class-transformer, there were separate algorithms for object prop discriminator and array entry discriminator.
	// based on tests, it seems that merging them both to an unified version works fine.
	export function findDiscriminatorType(metadata:TypeMetadata, subValue:any, typeHelpOpts: TypeHelpOptions, transformationType:TransformationType) {
		const discr = metadata.options.discriminator!;
		const newType = metadata.typeFunction ? metadata.typeFunction(typeHelpOpts) : metadata.reflectedType;
		if (transformationType === TransformationType.PLAIN_TO_CLASS) {
			let realTargetType: any = discr.subTypes.find((subType) => {
				// Note: this additional check was not present for ArrayLike with discriminator. May cause issues
				if (subValue instanceof Object && discr.property in subValue) {
					return subType.name === subValue[discr.property];
				}
			});
			if (realTargetType === undefined) realTargetType = newType;
			else realTargetType = realTargetType.value;

			if (!metadata.options.keepDiscriminatorProperty) {
				// Note: this additional check was not present for ArrayLike with discriminator. May cause issues
				if (subValue instanceof Object && discr.property in subValue) {
					delete subValue[discr.property];
				}
			}
			return realTargetType;
		}
		if (transformationType === TransformationType.CLASS_TO_CLASS) {
			return subValue.constructor;
		}
		if (transformationType === TransformationType.CLASS_TO_PLAIN) {
			if (subValue) {
				// TODO: this looks like a crude way to process data at the same time
				const match = discr.subTypes.find((subType) => subType.value === subValue.constructor);
				subValue[discr.property] = match?.name;
			}
			return undefined; // Note: was not present for property diuscriminator solver
		}
	}

}