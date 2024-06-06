import { TransformationType } from './enums';
import { ObjectLikeStructure, TransformOperationArgs, TypeMetadata } from './interfaces';
import { defaultMetadataStorage } from './storage';

/* eslint-disable @typescript-eslint/no-namespace */
export namespace TransformExecutionHelper {
	export function getReflectedType( target: Function, propertyName: string ): Function | undefined {
		if (!target) return undefined;
		const meta = defaultMetadataStorage.findTypeMetadata(target, propertyName);
		return meta ? meta.reflectedType : undefined;
	}

	export function createTargetStructure( c:TransformOperationArgs, transformationType: TransformationType ): ObjectLikeStructure {
		const {source, isMap, targetType} = c;
		let targetStructure: ObjectLikeStructure = source ? source : {};
		  
		if (
		  !source &&
		  transformationType !== TransformationType.CLASS_TO_PLAIN
		) {
			if (isMap) {
				targetStructure = new Map();
			} else if (targetType) {
				targetStructure = new (targetType as any)();
			} else {
				targetStructure = {};
			}
		}
		return targetStructure;
	}
	
	export function addPropertyToStructure( targetStructure: ObjectLikeStructure, newValueKey: string, newPropValue: any) {
		if (targetStructure instanceof Map) {
		  targetStructure.set(newValueKey, newPropValue);
		} else {
		  targetStructure[newValueKey] = newPropValue;
		}
	}

	export function createArrayLike(c:TransformOperationArgs, transformationType: TransformationType): Array<any> | Set<any> {
		const {arrayType} = c;
		if(arrayType && transformationType === TransformationType.PLAIN_TO_CLASS) {
			const array = new (arrayType as any)();
			// fallback in case an incompatible constructor was set
			if (!(array instanceof Set) && !(Array.isArray(array))) {
				return [];
			}
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

}