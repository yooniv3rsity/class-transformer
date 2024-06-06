/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { RecursionStack } from './RecursionStack';
import { TransformExecutionHelper } from './TransformExecutionHelper';
import { TransformationType, TypedStructure } from "./enums";
import { ClassTransformOptions, ClassTransformerExternalDependencies, ObjectLikeStructure, TransformOperationArgs, TypeHelpOptions, TypeMetadata } from "./interfaces";
import { defaultMetadataStorage } from "./storage";
import { getGlobal, isPromise } from "./utils";


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
			return this.doTransform_object(c);
		}  else {
			return value;
		}
	}

	// called when transforming Object or Map
	private doTransform_object(c:TransformOperationArgs): any {
		c = this.doTransform_object_normalizeTargetType(c);
		
		this.recursionStack.add(c.value);
		
		// @yoolabs/class-transformer modification: Pass level int to getKeys
		const keys = this.getKeys(c);
		const targetStructure = TransformExecutionHelper.createTargetStructure(c, this.transformationType);
		
		// traverse over keys
		for (const incomingValueDataKey of keys) {
			if (incomingValueDataKey === "__proto__" || incomingValueDataKey === "constructor") continue;
			
			const { propertyName, newValueKey } = TransformExecutionHelper.getTargetPropertyKeyName(incomingValueDataKey, c.targetType, this.options.ignoreDecorators || false, this.transformationType);
			const subValue = this.doTransform_object_getSubValue(c.value, incomingValueDataKey);
			
			// if value is an array try to get its custom array type
			const arrayType = Array.isArray(c.value[incomingValueDataKey])
				? TransformExecutionHelper.getReflectedType(c.targetType as Function, propertyName)
				: undefined;
			
			// determine a type
			const { type, structureType } = this.doTransform_object_determinePropertyType( 
				c, subValue, propertyName, incomingValueDataKey, targetStructure 
			);
			const isSubValueMap = structureType === TypedStructure.Map;
			
			// if its deserialization then type if required
			// if we uncomment this types like string[] will not work
			// if (this.transformationType === TransformationType.PLAIN_TO_CLASS && !type && subValue instanceof Object && !(subValue instanceof Date))
				//     throw new Error(`Cannot determine type for ${(targetType as any).name }.${propertyName}, did you forget to specify a @Type?`);
			
			if (TransformExecutionHelper.checkTargetStructureForConflictingProperty( targetStructure, newValueKey, this.transformationType )) {
				continue;
			}
			
			if (!this.recursionStack.has(subValue)) {
				const transformKey = this.transformationType === TransformationType.PLAIN_TO_CLASS ? newValueKey : incomingValueDataKey;
				
				// const subValueKey = TransformationType === TransformationType.PLAIN_TO_CLASS && newKeyName ? newKeyName : key;
				const maybeSubClassSource = c.source ? c.source[incomingValueDataKey] : undefined;
				let newPropValue;
				if (this.transformationType === TransformationType.CLASS_TO_PLAIN) {
					// Get original value
					newPropValue = c.value[transformKey];
					// Apply custom transformation
					newPropValue = this.applyCustomTransformations( newPropValue, c.targetType as Function, transformKey, c.value, this.transformationType );
					// If nothing change, it means no custom transformation was applied, so use the subValue.
					newPropValue = c.value[transformKey] === newPropValue ? subValue : newPropValue;
					// Apply the default transformation
					newPropValue = this.transform( {
						source: maybeSubClassSource, 
						value: newPropValue, 
						targetType: type, 
						arrayType: arrayType, 
						isMap: isSubValueMap, 
						level: c.level! + 1 
					});
				} else {
					if (subValue === undefined && this.options.exposeDefaultValues) {
						// Set default value if nothing provided
						newPropValue = TransformExecutionHelper.getPropertyFromStructure( targetStructure, newValueKey );
					} else {
						newPropValue = this.transform( {
							source: maybeSubClassSource, 
							value: subValue, 
							targetType: type, 
							arrayType: arrayType, 
							isMap: isSubValueMap, 
							level: c.level! + 1 
						});
						newPropValue = this.applyCustomTransformations( newPropValue, c.targetType as Function, transformKey, c.value, this.transformationType );
					}
				}
				
				if (newPropValue !== undefined || this.options.exposeUnsetFields) {
					TransformExecutionHelper.addPropertyToStructure( targetStructure, newValueKey, newPropValue );
				}
			} else if (
				this.transformationType === TransformationType.CLASS_TO_CLASS
			) {
				let newPropValue = subValue;
				newPropValue = this.applyCustomTransformations( newPropValue, c.targetType as Function, incomingValueDataKey, c.value, this.transformationType);
				if (newPropValue !== undefined || this.options.exposeUnsetFields) {
					TransformExecutionHelper.addPropertyToStructure(targetStructure, newValueKey, newPropValue);
				}
			}
		}
		
		this.recursionStack.delete(c.value);
		return targetStructure;
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
	private doTransform_object_determinePropertyType(
		c: TransformOperationArgs,
		subValue: any,
		propertyName: string,
		parentDataKey: string,
		targetStructure: ObjectLikeStructure,
	) {
		let type: any = undefined;
		let structureType: TypedStructure|null = null;
		if(subValue instanceof Map) structureType = TypedStructure.Map;
		
		if (c.targetType && c.isMap) {
			// currently processing property of a Map
			type = c.targetType;
		} else if (c.targetType) {
			// currently processing property of something other than a Map
			const metadata = defaultMetadataStorage.findTypeMetadata( c.targetType as Function, propertyName );
			if (metadata) {
				const typeHelpOpts: TypeHelpOptions = this.createTypeHelpOptions(targetStructure, c.value, propertyName);
				const useDiscriminator = metadata?.options?.discriminator?.property && metadata.options.discriminator.subTypes;
				const processedValue = c.value[parentDataKey];
				
				if(useDiscriminator) {
					if (!(processedValue instanceof Array)) {
						type = TransformExecutionHelper.findDiscriminatorType(metadata, subValue, typeHelpOpts, this.transformationType)
					} else {
						type = metadata;
					}
				} else {
					type = metadata.typeFunction ? metadata.typeFunction(typeHelpOpts) : metadata.reflectedType;
				}

				if(metadata.reflectedType === Map) structureType = TypedStructure.Map
			} else if (this.options.targetMaps) {
				// try to find a type in target maps
				this.options.targetMaps.filter(
					(map) => map.target === c.targetType && !!map.properties[propertyName]
				).forEach((map) => {
					// TODO: huh? why re-assign type x times in a loop?
					type = map.properties[propertyName];
				});
			} else if ( this.options.enableImplicitConversion && this.transformationType === TransformationType.PLAIN_TO_CLASS ) {
				// if we have no registererd type via the @Type() decorator then we check if we have any
				// type declarations in reflect-metadata (type declaration is emited only if some decorator is added to the property.)
				const reflectedType = (Reflect as any).getMetadata( "design:type", (c.targetType as Function).prototype, propertyName );
				if (reflectedType) type = reflectedType;
			}
		}
		return { type, structureType };
	}

	private doTransform_ArrayLike_determineEntryType(targetType: Function | TypeMetadata | undefined, subValue: any, newValue: any[] | Set<any>) {
		if (typeof targetType === "function") {
			return targetType;
		} else if(!targetType) {
			return undefined;
		}
		
		const metadata = targetType;
		const typeHelpOpts: TypeHelpOptions = this.createTypeHelpOptions(newValue, subValue, undefined);
		const useDiscriminator = metadata?.options?.discriminator?.property && metadata.options.discriminator.subTypes;

		if(useDiscriminator) {
			return TransformExecutionHelper.findDiscriminatorType(metadata, subValue, typeHelpOpts, this.transformationType)
		} else {
			return targetType;
		}
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

	// Called when transforming Array or Set
	private doTransform_ArrayLike(c:TransformOperationArgs): any {
		const {source, targetType} = c;
		const newArrayLike = TransformExecutionHelper.createArrayLike(c,this.transformationType);

		(c.value as any[]).forEach((subValue, index) => {
			const subSource = source ? source[index] : undefined;
			if (!this.recursionStack.has(subValue)) {
				const realTargetType = this.doTransform_ArrayLike_determineEntryType(targetType, subValue, newArrayLike);
				const transformedSubValue = this.transform({
					source: subSource,
					value: subValue,
					targetType: realTargetType,
					isMap: subValue instanceof Map,
					level: c.level! + 1
				});
				TransformExecutionHelper.addPropertyToArrayLike(newArrayLike, transformedSubValue)
			} else if (this.transformationType === TransformationType.CLASS_TO_CLASS) {
				TransformExecutionHelper.addPropertyToArrayLike(newArrayLike, subValue)
			}
		});
		return newArrayLike;
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
