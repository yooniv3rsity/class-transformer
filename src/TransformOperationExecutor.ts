/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { RecursionStack } from './RecursionStack';
import { TransformExecutionHelper } from './TransformExecutionHelper';
import { TransformationType, StructureTypeGroup } from "./enums";
import { ArrayLikeStructure, ClassConstructor, ClassTransformOptions, ClassTransformerExternalDependencies, ObjectLikeStructure, TransformOperationArgs, TypeHelpOptions, TypeMetadata } from "./interfaces";
import { defaultMetadataStorage } from "./storage";
import { getGlobal, isPromise } from "./utils";


interface PropertyTypeInfo {
	propertyType: Function | undefined;
	structureTypeGroup: StructureTypeGroup | null;
	propertyMeta?: TypeMetadata;
	structureType?: any;
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
	
	// user executed transformation starts here
	transform(c:TransformOperationArgs): any {
		if(!c.level) c.level = 0;
		c.structureType = (c.targetType || c.source?.constructor || undefined) as any;
		if (this.options.transformationHandler) {
			return this.options.transformationHandler( c, this );
		} else {
			return this.doTransform(c);
		}
	}

	// recursive/nested transformation uses separate method
	nestedTransform(c:TransformOperationArgs): any {
		// console.log('>>> nestedTransform',c)
		if (this.options.transformationHandler) {
			return this.options.transformationHandler( c, this );
		} else {
			return this.doTransform(c);
		}
	}
	
	doTransform(c:TransformOperationArgs): any {
		const { value, targetType, isMap, structureType} = c;
		// Note: order of checks is important! multiple checks can be truthy!
		if(value === null || value === undefined) {
			return value;		
		} else if (!isMap && !structureType && TransformExecutionHelper.isPrimitiveType(targetType)) {
			return targetType!(value);
		} else if (Array.isArray(value) || value instanceof Set) {
			return this.doTransform_structure(c)
		} else if (isPromise(value) && !isMap && !structureType) {
			return new Promise((resolve, reject) => {
				value.then((data: any) =>
					resolve(this.nestedTransform({
						value:data,
						targetType,
						level: c.level! + 1
					})),
					reject
				);
			});
		} else if ((targetType === Date || value instanceof Date) && !isMap && !structureType) {
			if (value instanceof Date) return new Date(value.valueOf());
			return new Date(value);
		} else if (!!getGlobal().Buffer && (targetType === Buffer || value instanceof Buffer) && !isMap && !structureType ) {
			return Buffer.from(value);
		} else if (typeof value === "object") {
			return this.doTransform_structure(c)
		}  else {
			return value;
		}
	}

	private doTransform_structure(c:TransformOperationArgs): any {
		// console.log('doTransform_structure',c.value)
		const { value, isMap} = c;
		if (Array.isArray(value) || value instanceof Set) {
			return this.doTransform_ArrayLike( c );
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

	// called on incoming VALUE being Object or Map
	private doTransform_objectLike(c:TransformOperationArgs): any {
		c = this.doTransform_object_normalizeTargetType(c);
		
		this.recursionStack.add(c.value);
		c.value = this.ensureCorrectValueType(c.value, c.structureType);

		// @yoolabs/class-transformer modification: Pass level int to getKeys
		const keys = this.getKeys(c);
		const targetStructure = TransformExecutionHelper.createTargetStructure(c, this.transformationType);

		// returns a structure's property value or its return value in case it is a function
		const getSubValueFromStructure = (structure: ObjectLikeStructure, propKey: string, transformationType:TransformationType) => {
			let subValue: any = undefined;
			if (transformationType === TransformationType.PLAIN_TO_CLASS) {
				// no calling of constructor/function in plain to class!
				// see https://github.com/typestack/class-transformer/issues/596
				subValue = structure[propKey];
			} else {
				subValue = TransformExecutionHelper.getPropertyFromStructure(structure, propKey)
				// execute function bound to object! -> value[valueKey]()
				if (subValue instanceof Function) subValue = structure[propKey]();
			}
			return subValue;
		}
		
		// traverse over keys
		for (const incomingValueDataKey of keys) {
			if (incomingValueDataKey === "__proto__" || incomingValueDataKey === "constructor") continue;
			
			let subValue = getSubValueFromStructure(c.value, incomingValueDataKey, this.transformationType);

			// if its deserialization then type if required
			// if we uncomment this types like string[] will not work
			// if (this.transformationType === TransformationType.PLAIN_TO_CLASS && !type && subValue instanceof Object && !(subValue instanceof Date))
			//     throw new Error(`Cannot determine type for ${(targetType as any).name }.${propertyName}, did you forget to specify a @Type?`);
			
			const { propertyName, newValueKey } = TransformExecutionHelper.getTargetPropertyKeyName(incomingValueDataKey, c.targetType, this.options.ignoreDecorators || false, this.transformationType);
			const propertyTypeInfo:PropertyTypeInfo = this.doTransform_object_determinePropertyType(c, subValue, propertyName, targetStructure);
			if(propertyTypeInfo.structureType && !c.isMap) subValue = this.ensureCorrectValueType(subValue, propertyTypeInfo.structureType);

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

	// called on incoming VALUE being Array or Set
	private doTransform_ArrayLike(c:TransformOperationArgs): any {
		const newArrayLike = TransformExecutionHelper.createArrayLike(c,this.transformationType);

		const arrayValue = this.ensureCorrectValueType(c.value, c.structureType);
		// console.log('transform array', c.structureType, c.targetType, c.typeMetadata, arrayValue, newArrayLike);
		(arrayValue as any[]).forEach((subValue, index) => {
			subValue = this.ensureCorrectValueType(subValue, c.targetType as any);
			if (!this.recursionStack.has(subValue)) {
				const { propertyType, structureTypeGroup } = this.doTransform_ArrayLike_determineEntryType(c, subValue, newArrayLike);
				const transformedSubValue = this.nestedTransform({
					source: c.source ? c.source[index] : undefined,
					value: subValue,
					targetType: propertyType,
					isMap: structureTypeGroup === StructureTypeGroup.Map,
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
		const transformKey = this.transformationType === TransformationType.PLAIN_TO_CLASS ? newValueKey : incomingValueDataKey;

		if (subValue === undefined && this.options.exposeDefaultValues) {
			// Set default value if nothing provided
			newPropValue = TransformExecutionHelper.getPropertyFromStructure(targetStructure, newValueKey);
		} else {
			newPropValue = this.nestedTransform({
				source: c.source ? c.source[incomingValueDataKey] : undefined,
				value: subValue,
				targetType: propType.propertyMeta || propType.propertyType as any,
				structureType: propType.structureType,
				isMap: propType.structureTypeGroup === StructureTypeGroup.Map,
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
		const transformKey = incomingValueDataKey;

		newPropValue = this.applyCustomTransformations(c.value[transformKey], c.targetType as Function, transformKey, c.value, this.transformationType);

		// TODO: why? if nothing changes => no custom transformation was applied => use subValue isntead of c.value[transformKey] ??
		// failing tests seem to have to do with getter functions 
		newPropValue = c.value[transformKey] === newPropValue ? subValue : newPropValue;

		newPropValue = this.nestedTransform({
			source: c.source ? c.source[incomingValueDataKey] : undefined,
			value: newPropValue,
			targetType: propType.propertyMeta || propType.propertyType as any,
			structureType: propType.structureType,
			isMap: propType.structureTypeGroup === StructureTypeGroup.Map,
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

	// in case of this method, type can be anything:
	// - a StructureType like Map or Array
	// - a Primitive Type like String, Number
	// - a custom class constructor
	private ensureCorrectValueType(value:any, type: ClassConstructor<any>|Function|undefined):any {
		// if(!structureType) console.log('ensureCorrectValueType - no structureType given.',structureType, value)
		if(!type) {
			return value;
		} else if(TransformExecutionHelper.isPrimitiveType(type)) {
			return (type as Function)(value)
		}

		const typeGroup = TransformExecutionHelper.getStructureTypeGroup(type as ClassConstructor<any>);

		if(typeGroup === StructureTypeGroup.Array ||typeGroup === StructureTypeGroup.Set) {
			const validSourceValue = !value || Array.isArray(value) || (value instanceof Set);
			// console.log('ensureCorrectValueType ArrayLike', value, 'valid?', validSourceValue)
			if(!validSourceValue) return []
		} else if(typeGroup === StructureTypeGroup.Map ||typeGroup === StructureTypeGroup.Object) {
			const validSourceValue = !value || (value instanceof Map) || (typeof value === 'object');
			// console.log('ensureCorrectValueType ObjectLike', value, 'valid?', validSourceValue)
			if(!validSourceValue) return {}
		}

		return value;
	}

	// determine the targetType for a property + if the type is nested within a structure like Array/Map
	// c.targetType may be set, it can contain the type defined for the parent object.
	// only this method fetches Type Metadata and extracts the property type from it.
	// Note: one thing hard to follow is the separation of parent object and child property metadata.
	// this method USES parent type to FIND a child property's type and structure type.
	private doTransform_object_determinePropertyType(
		c: TransformOperationArgs,
		subValue: any,
		targetTypePropertyName: string,
		targetStructure: ObjectLikeStructure,
	): PropertyTypeInfo {
		
		if (!c.targetType) {
			return { propertyType:undefined, propertyMeta:undefined, structureTypeGroup:null, structureType:undefined };
		}

		const metadata:TypeMetadata = defaultMetadataStorage.findTypeMetadata( c.targetType, targetTypePropertyName );			
		let structureTypeGroup = TransformExecutionHelper.determinestructureTypeGroup(subValue, metadata)
		// must not default to c.structureType, this is the type of PARENT object!
		let structureType = TransformExecutionHelper.getStructureType(structureTypeGroup, metadata)
		let propertyType: Function|undefined = undefined;
		let propertyMeta: TypeMetadata|undefined = undefined;

		if(c.isMap) {
			// currently processing property of a Map.
			// Note: isMap is not calculated for root level, however root can never be a map or array, so no worries here.
			propertyType = c.targetType;
		} 

		if (metadata) {
			// console.log('>>>>>> metadata for '+targetTypePropertyName,metadata)
			const typeHelpOpts: TypeHelpOptions = this.createTypeHelpOptions(targetStructure, c.value, targetTypePropertyName);
			const useDiscriminator = metadata?.options?.discriminator?.property && metadata.options.discriminator.subTypes;
			
			if(useDiscriminator) {
				if (structureTypeGroup !== StructureTypeGroup.Array) {
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

			// set structureTypeGroup by Reflected or explicit Decorator
			if(metadata.reflectedType === Map) structureTypeGroup = StructureTypeGroup.Map

			if(metadata.structureType) {
				// metadata is from @TypedStructure(StructType, ()=>PropType) so we know user wants to create a <structureType> containing <propertyType> items
				structureTypeGroup = TransformExecutionHelper.getStructureTypeGroup(metadata.structureType);
				structureType = metadata.structureType;
			} else if(propertyType) {
				// when user decorates a prop with @Type(()=>Set), the type is not actually referring to the property, but is a structure with untyped content.
				const propertyTypeAsStructureType = TransformExecutionHelper.getStructureTypeGroup(propertyType as any)
				if(propertyTypeAsStructureType && propertyTypeAsStructureType !== StructureTypeGroup.Object) {
					structureType = propertyType as any;
					propertyType = undefined;
				}
			}

		} else if (this.options.targetMaps) {

			this.options.targetMaps.filter(
				(map) => map.target === c.targetType && !!map.properties[targetTypePropertyName]
			).forEach((map) => {
				// TODO: huh? why re-assign type x times in a loop?
				propertyType = map.properties[targetTypePropertyName];
			});

		} else if ( this.options.enableImplicitConversion && this.transformationType === TransformationType.PLAIN_TO_CLASS ) {

			// if we have no registererd type via the @Type() decorator then we check if we have any
			// type declarations in reflect-metadata (type declaration is emited only if some decorator is added to the property.)
			const reflectedType = (Reflect as any).getMetadata( "design:type", c.targetType.prototype, targetTypePropertyName );
			if (reflectedType) propertyType = reflectedType;

		}
				
		// console.log('Type info for prop '+targetTypePropertyName+':', { propertyType, propertyMeta, structureTypeGroup, structureType })
		return { propertyType, propertyMeta, structureTypeGroup, structureType };
	}

	private doTransform_ArrayLike_determineEntryType(
		c: TransformOperationArgs,
		subValue: any, 
		targetStructure: ArrayLikeStructure
	):PropertyTypeInfo {
		let propertyType: any = undefined;
		let structureTypeGroup: StructureTypeGroup|null = null;
		if(subValue instanceof Map) structureTypeGroup = StructureTypeGroup.Map;

		// TODO: how can targetType ever be TypeMetadata?
		if (typeof c.targetType === "function") {
			propertyType = c.targetType;
		} else if(c.targetType) {
			// console.warn(targetType)
			// throw new Error('Unexpected: can this even happen?')
			const metadata = c.targetType as TypeMetadata;
			const typeHelpOpts: TypeHelpOptions = this.createTypeHelpOptions(targetStructure, subValue, undefined);
			const useDiscriminator = metadata.options?.discriminator?.property && metadata.options.discriminator.subTypes;
	
			if(useDiscriminator) {
				propertyType = TransformExecutionHelper.findDiscriminatorType(metadata, subValue, typeHelpOpts, this.transformationType)
			} else {
				propertyType = c.targetType;
			}
		}

		return { propertyType, structureTypeGroup };
		
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
