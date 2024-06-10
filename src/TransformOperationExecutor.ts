/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { RecursionStack } from './RecursionStack';
import { TransformExecutionHelper } from './TransformExecutionHelper';
import { TransformationType, TypedStructure } from "./enums";
import { ClassTransformOptions, ClassTransformerExternalDependencies, ObjectLikeStructure, TransformOperationArgs, TypeHelpOptions, TypeMetadata } from "./interfaces";
import { defaultMetadataStorage } from "./storage";
import { getGlobal, isPromise } from "./utils";


interface PropertyTypeInfo {
	propertyType: Function | undefined;
	propertyMeta: TypeMetadata | undefined;
	structureType: TypedStructure | null;
	arrayType: any;
}

export class TransformOperationExecutor {
	// -------------------------------------------------------------------------
	// Private Properties
	// -------------------------------------------------------------------------
	
	private recursionStack = new RecursionStack(this.options.enableCircularCheck||false);
	private dependencies: ClassTransformerExternalDependencies;
	
	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------
	
	constructor(
		private transformationType: TransformationType,
		private options: ClassTransformOptions
	) {
		this.dependencies = options.dependencies || {};
	}
	
	// -------------------------------------------------------------------------
	// Public Methods
	// -------------------------------------------------------------------------
	
	transform(c:TransformOperationArgs): any {
		if(!c.level) c.level = 0;
		if (this.options.transformationHandler) {
			return this.options.transformationHandler( c, this );
		} else {
			return this.doTransform(c);
		}
	}
	
	doTransform(c:TransformOperationArgs): any {
		const { value, targetType, isMap} = c;
		// Note: order of checks is important! multiple checks can be truthy!
		if(value === null || value === undefined) {
			return value;		
		} else if (!isMap && (targetType === String || targetType === Number || targetType === Boolean || targetType === BigInt)) {
			return targetType(value);
		} else if (Array.isArray(value) || value instanceof Set) {
			return this.doTransform_ArrayLike( c );
		} else if (isPromise(value) && !isMap) {
			return new Promise((resolve, reject) => {
				value.then((data: any) =>
					resolve(this.transform({
						value:data,
						targetType,
						level: c.level! + 1
					})),
					reject
				);
			});
		} else if ((targetType === Date || value instanceof Date) && !isMap) {
			if (value instanceof Date) return new Date(value.valueOf());
			return new Date(value);
		} else if (!!getGlobal().Buffer && (targetType === Buffer || value instanceof Buffer) && !isMap ) {
			return Buffer.from(value);
		} else if (typeof value === "object") {
			if ( !isMap && typeof value.then === "function" ) {
				// Note: Never happens because promises have already been handled above.
				// This option simply returns the Promise preventing a JS error from happening and should be an inaccessible path.
				return value; // skip promise transformation
			}
			return this.doTransform_objectLike(c);
		}  else {
			return value;
		}
	}

	// called when transforming Object or Map
	private doTransform_objectLike(c:TransformOperationArgs): any {
		c = this.doTransform_object_normalizeTargetType(c);
		
		this.recursionStack.add(c.value);
		
		// @yoolabs/class-transformer modification: Pass level int to getKeys
		const keys = this.getKeys(c);
		const targetStructure = TransformExecutionHelper.createTargetStructure(c, this.transformationType);
		
		// traverse over keys
		for (const incomingValueDataKey of keys) {
			if (incomingValueDataKey === "__proto__" || incomingValueDataKey === "constructor") continue;
			
			const subValue = this.doTransform_object_getSubValue(c.value, incomingValueDataKey);
			
			// if its deserialization then type if required
			// if we uncomment this types like string[] will not work
			// if (this.transformationType === TransformationType.PLAIN_TO_CLASS && !type && subValue instanceof Object && !(subValue instanceof Date))
			//     throw new Error(`Cannot determine type for ${(targetType as any).name }.${propertyName}, did you forget to specify a @Type?`);
			
			const { propertyName, newValueKey } = TransformExecutionHelper.getTargetPropertyKeyName(incomingValueDataKey, c.targetType, this.options.ignoreDecorators || false, this.transformationType);
			const propertyTypeInfo:PropertyTypeInfo = this.doTransform_object_determinePropertyType(c, subValue, propertyName, incomingValueDataKey, targetStructure);

			if (TransformExecutionHelper.checkTargetStructureForConflictingProperty( targetStructure, newValueKey, this.transformationType )) {
				continue;
			}
			
			if (!this.recursionStack.has(subValue)) {
				if (this.transformationType === TransformationType.CLASS_TO_PLAIN) {
					this.transformProperty_toPlain(incomingValueDataKey, c, subValue, targetStructure, propertyTypeInfo, newValueKey);
				} else {
					this.transformProperty_toInstance(incomingValueDataKey, c, subValue, targetStructure, propertyTypeInfo, newValueKey);
				}
			} else if (this.transformationType === TransformationType.CLASS_TO_CLASS) {
				this.transformProperty_recursiveToInstance(subValue, c, incomingValueDataKey, targetStructure, newValueKey);
			}
		}
		
		this.recursionStack.delete(c.value);
		return targetStructure;
	}

	// Called when transforming Array or Set
	private doTransform_ArrayLike(c:TransformOperationArgs): any {
		const newArrayLike = TransformExecutionHelper.createArrayLike(c,this.transformationType);

		(c.value as any[]).forEach((subValue, index) => {
			if (!this.recursionStack.has(subValue)) {
				const { entryType, structureType } = this.doTransform_ArrayLike_determineEntryType(c.targetType, subValue, newArrayLike);
				const transformedSubValue = this.transform({
					source: c.source ? c.source[index] : undefined,
					value: subValue,
					targetType: entryType,
					isMap: structureType === TypedStructure.Map,
					level: c.level! + 1
				});
				TransformExecutionHelper.addPropertyToArrayLike(newArrayLike, transformedSubValue)
			} else if (this.transformationType === TransformationType.CLASS_TO_CLASS) {
				TransformExecutionHelper.addPropertyToArrayLike(newArrayLike, subValue)
			}
		});
		return newArrayLike;
	}

	private transformProperty_recursiveToInstance(
		subValue: any, c: TransformOperationArgs, incomingValueDataKey: string, 
		targetStructure: ObjectLikeStructure, newValueKey: string
	) {
		let newPropValue = subValue;
		newPropValue = this.applyCustomTransformations(newPropValue, c.targetType as Function, incomingValueDataKey, c.value, this.transformationType);
		if (newPropValue !== undefined || this.options.exposeUnsetFields) {
			TransformExecutionHelper.addPropertyToStructure(targetStructure, newValueKey, newPropValue);
		}
	}

	private transformProperty_toInstance(
		incomingValueDataKey: string, c: TransformOperationArgs, subValue: any, 
		targetStructure: ObjectLikeStructure, propType:PropertyTypeInfo, newValueKey:string
	) {
		let newPropValue:any;
		const { propertyMeta, propertyType, structureType, arrayType } = propType;

		const transformKey = this.transformationType === TransformationType.PLAIN_TO_CLASS ? newValueKey : incomingValueDataKey;

		if (subValue === undefined && this.options.exposeDefaultValues) {
			// Set default value if nothing provided
			newPropValue = TransformExecutionHelper.getPropertyFromStructure(targetStructure, newValueKey);
		} else {
			newPropValue = this.transform({
				source: c.source ? c.source[incomingValueDataKey] : undefined,
				value: subValue,
				targetType: propertyMeta || propertyType as any,
				arrayType: arrayType,
				isMap: structureType === TypedStructure.Map,
				level: c.level! + 1
			});
			newPropValue = this.applyCustomTransformations(newPropValue, c.targetType as Function, transformKey, c.value, this.transformationType);
		}

		if (newPropValue !== undefined || this.options.exposeUnsetFields) {
			TransformExecutionHelper.addPropertyToStructure( targetStructure, newValueKey, newPropValue );
		}
}

	private transformProperty_toPlain(
		incomingValueDataKey: string, c: TransformOperationArgs, subValue: any, 
		targetStructure: ObjectLikeStructure, propType:PropertyTypeInfo, newValueKey:string
	) {
		let newPropValue:any;
		const { propertyMeta, propertyType, structureType, arrayType } = propType;
		const transformKey = incomingValueDataKey;

		newPropValue = this.applyCustomTransformations(c.value[transformKey], c.targetType as Function, transformKey, c.value, this.transformationType);

		// TODO: why? if nothing changes => no custom transformation was applied => use subValue isntead of c.value[transformKey] ??
		// failing tests seem to have to do with getter functions 
		newPropValue = c.value[transformKey] === newPropValue ? subValue : newPropValue;

		newPropValue = this.transform({
			source: c.source ? c.source[incomingValueDataKey] : undefined,
			value: newPropValue,
			targetType: propertyMeta || propertyType as any,
			arrayType: arrayType,
			isMap: structureType === TypedStructure.Map,
			level: c.level! + 1
		});

		if (newPropValue !== undefined || this.options.exposeUnsetFields) {
			TransformExecutionHelper.addPropertyToStructure( targetStructure, newValueKey, newPropValue );
		}
}

	private doTransform_object_normalizeTargetType(c: TransformOperationArgs):TransformOperationArgs {
		let targetType = c.targetType;
		if (!targetType && c.value.constructor !== Object) {
			if (!Array.isArray(c.value) && c.value.constructor === Array) {
				// Somebody attempts to convert special Array like object to Array, eg:
				// const evilObject = { '100000000': '100000000', __proto__: [] };
				// This could be used to cause Denial-of-service attack so we don't allow it.
				// See prevent-array-bomb.spec.ts for more details.
			} else {
				// We are good we can use the built-in constructor
				targetType = c.value.constructor;
			}
		}
		if (!targetType && c.source) targetType = c.source.constructor;
		return {
			...c,
			targetType
		};
	}

	// TODO: find out how this subValue is actually being used/useful
	private doTransform_object_getSubValue(value: any, valueKey: string) {
		let subValue: any = undefined;
		if (this.transformationType === TransformationType.PLAIN_TO_CLASS) {
			/**
			* This section is added for the following report:
			* https://github.com/typestack/class-transformer/issues/596
			*
			* We should not call functions or constructors when transforming to class.
			*/
			subValue = value[valueKey];
		} else {
			if (value instanceof Map) {
				subValue = value.get(valueKey);
			} else if (value[valueKey] instanceof Function) {
				subValue = value[valueKey]();
			} else {
				subValue = value[valueKey];
			}
		}
		return subValue;
	}

	// determine the targetType for a property + if the type is nested within a structure like Array/Map
	// c.targetType may be set, it can contain the type defined for the parent object.
	// only this method fetches Type Metadata and extracts the property type from it.
	// Note: one thing hard to follow is the separation of parent object and child property metadata.
	// this method USES parent type to FIND a child property's type and structure type.
	private doTransform_object_determinePropertyType(
		c: TransformOperationArgs,
		subValue: any,
		propertyName: string,
		parentDataKey: string,
		targetStructure: ObjectLikeStructure,
	): PropertyTypeInfo {
		let propertyType: Function|undefined = undefined;
		let propertyMeta: TypeMetadata|undefined = undefined;
		let structureType: TypedStructure|null = null;
		let arrayType:any = undefined;

		// TODO: this seems unrealiable. we should not set expected structure type based on the incoming value.
		const propValueContainsArray = Array.isArray(c.value[parentDataKey]);
		const propValueContainsMap = subValue instanceof Map;
			
		// TODO: this seems unrealiable. we should not set expected structure type based on the incoming value.
		// possibly this makes nested maps work, because if c.isMap is true, stuff will be skipped
		// interestingly, no tests fail when commenting this out.
		// if(subValue instanceof Map) structureType = TypedStructure.Map;
		
		if (c.targetType) {
			const metadata = defaultMetadataStorage.findTypeMetadata( c.targetType, propertyName );
			if(propValueContainsArray) {
				// if value is an array try to get its custom array type
				// Note: In case of arrays, a custom prop named arrayType will be passed in TransformOperationArgs.
				// it contains the reflected type as stored in type Metadata object.
				if(metadata?.reflectedType) arrayType = metadata.reflectedType;
			}
			if(c.isMap) {
				// currently processing property of a Map.
				// Note: isMap is not calculated for root level, however root can never be a map or array, so no worries here.
				propertyType = c.targetType;
			} else {
				// currently processing property of something other than a Map
				if (metadata) {
					const typeHelpOpts: TypeHelpOptions = this.createTypeHelpOptions(targetStructure, c.value, propertyName);
					const useDiscriminator = metadata?.options?.discriminator?.property && metadata.options.discriminator.subTypes;
					const processedValue = c.value[parentDataKey];
					
					if(useDiscriminator) {
						if (!(processedValue instanceof Array)) {
							propertyType = TransformExecutionHelper.findDiscriminatorType(metadata, subValue, typeHelpOpts, this.transformationType)
						} else {
							propertyMeta = metadata;
						}
					} else if(metadata.typeFunction) {
						propertyType = metadata.typeFunction(typeHelpOpts);
					} else {
						// TODO: is this smart? we dont want type to be Map, Array or anything alike.
						propertyType = metadata.reflectedType
					}

					// set structureType by Reflected or explicit Decorator
					if(metadata.reflectedType === Map) {
						structureType = TypedStructure.Map
					}

				} else if (this.options.targetMaps) {
					// try to find a type in target maps
					this.options.targetMaps.filter(
						(map) => map.target === c.targetType && !!map.properties[propertyName]
					).forEach((map) => {
						// TODO: huh? why re-assign type x times in a loop?
						propertyType = map.properties[propertyName];
					});
				} else if ( this.options.enableImplicitConversion && this.transformationType === TransformationType.PLAIN_TO_CLASS ) {
					// if we have no registererd type via the @Type() decorator then we check if we have any
					// type declarations in reflect-metadata (type declaration is emited only if some decorator is added to the property.)
					const reflectedType = (Reflect as any).getMetadata( "design:type", c.targetType.prototype, propertyName );
					if (reflectedType) propertyType = reflectedType;
				}
			}
		}
		return { propertyType, propertyMeta, structureType, arrayType };
	}

	private doTransform_ArrayLike_determineEntryType(targetType: Function | TypeMetadata | undefined, subValue: any, newValue: any[] | Set<any>) {
		let entryType: any = undefined;
		let structureType: TypedStructure|null = null;
		if(subValue instanceof Map) structureType = TypedStructure.Map;

		// TODO: how can targetType ever be TypeMetadata?
		if (typeof targetType === "function") {
			entryType = targetType;
		} else if(targetType) {
			// console.warn(targetType)
			// throw new Error('Unexpected: can this even happen?')
			const metadata = targetType;
			const typeHelpOpts: TypeHelpOptions = this.createTypeHelpOptions(newValue, subValue, undefined);
			const useDiscriminator = metadata.options?.discriminator?.property && metadata.options.discriminator.subTypes;
	
			if(useDiscriminator) {
				entryType = TransformExecutionHelper.findDiscriminatorType(metadata, subValue, typeHelpOpts, this.transformationType)
			} else {
				entryType = targetType;
			}
		}

		return { entryType, structureType };
		
	}


	private createTypeHelpOptions(newObject: ObjectLikeStructure|Array<any>, propertyValue: Record<string, any>, propertyName: string|undefined): TypeHelpOptions {
		return {
			newObject: newObject,
			object: propertyValue,
			property: propertyName,
			dependencies: this.dependencies,
			executor: this,
		};
	}


	private applyCustomTransformations( value: any, target: Function, key: string, obj: any, transformationType: TransformationType	): boolean {
		let metadatas = defaultMetadataStorage.findTransformMetadatas(
			target,
			key,
			this.transformationType
		);
		
		// apply versioning options
		if (this.options.version !== undefined) {
			metadatas = metadatas.filter((metadata) => {
				if (!metadata.options) return true;
				return TransformExecutionHelper.checkVersion( metadata.options.since, metadata.options.until, this.options.version as number);
			});
		}
		
		// apply grouping options
		if (this.options.groups && this.options.groups.length) {
			metadatas = metadatas.filter((metadata) => {
				if (!metadata.options) return true;
				return TransformExecutionHelper.checkGroups(metadata.options.groups, this.options.groups || []);
			});
		} else {
			metadatas = metadatas.filter((metadata) => {
				const hasGroups = metadata?.options?.groups?.length > 0;
				return !hasGroups;
			});
		}
		
		metadatas.forEach((metadata) => {
			value = metadata.transformFn({
				value,
				key,
				obj,
				type: transformationType,
				options: this.options,
				dependencies: this.dependencies,
				executor: this,
			});
		});
		
		return value;
	}

	private getKeys(
		c:TransformOperationArgs
	): string[] {
		// determine exclusion strategy
		let strategy = defaultMetadataStorage.getStrategy(c.targetType);
		if (strategy === "none") {
			// @yoolabs/class-transformer modification: If we are at level>1, check for given nestedStrategy option
			if (c.level! > 0) strategy = this.options.nestedStrategy || this.options.strategy || "exposeAll";
			else strategy = this.options.strategy || "exposeAll"; // exposeAll is default strategy
		}
		
		// get all keys that need to expose
		let keys: any[] = [];
		if (strategy === "exposeAll" || c.isMap) {
			if (c.value instanceof Map) keys = Array.from(c.value.keys());
			else keys = Object.keys(c.value);
		}
		
		// expose & exclude do not apply for map keys only to fields
		if (c.isMap) return keys;

		// TODO: it seems unclear if this safely is a function at this point
		const targetType = c.targetType as Function;
		
		/**
		* If decorators are ignored but we don't want the extraneous values, then we use the
		* metadata to decide which property is needed, but doesn't apply the decorator effect.
		*/
		if (this.options.ignoreDecorators && this.options.excludeExtraneousValues && targetType) {
			keys = TransformExecutionHelper.getTargetKeysIgnoringDecorators(targetType, keys, this.transformationType);
		}
		
		if (!this.options.ignoreDecorators && targetType) {
			keys = TransformExecutionHelper.getTargetKeysBasedOnDecorators(targetType, keys, this.transformationType, this.options.excludeExtraneousValues || false);
			keys = TransformExecutionHelper.filterKeysByVersion(keys, targetType, this.options.version);
			keys = TransformExecutionHelper.filterKeysByGroup(keys, targetType, this.options.groups || []);
		}
		
		// exclude prefixed properties
		keys = TransformExecutionHelper.filterExcludedKeys(keys, this.options.excludePrefixes);
		
		// make sure we have unique keys
		keys = keys.filter((key, index, self) => {
			return self.indexOf(key) === index;
		});
		
		return keys;
	}




}
