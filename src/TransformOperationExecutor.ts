/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { RecursionStack } from './RecursionStack';
import { TransformExecutionHelper } from './TransformExecutionHelper';
import { TransformationType } from "./enums";
import {
  ClassTransformOptions,
  ClassTransformerExternalDependencies,
  ObjectLikeStructure,
  TypeHelpOptions,
  TypeMetadata,
} from "./interfaces";
import { defaultMetadataStorage } from "./storage";
import { getGlobal, isPromise } from "./utils";

function instantiateArrayType(arrayType: Function): Array<any> | Set<any> {
  const array = new (arrayType as any)();
  if (!(array instanceof Set) && !("push" in array)) {
    return [];
  }
  return array;
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

	transform(
		source: Record<string, any> | Record<string, any>[] | any,
		value: Record<string, any> | Record<string, any>[] | any,
		targetType: Function | TypeMetadata,
		arrayType: Function,
		isMap: boolean,
		level = 0
	): any {
		if (this.options.transformationHandler) {
			return this.options.transformationHandler(
				{ source, value, targetType, arrayType, isMap, level },
				this
			);
		} else {
			return this.doTransform( source, value, targetType, arrayType, isMap, level	);
		}
	}

	doTransform(
		source: Record<string, any> | Record<string, any>[] | any,
		value: Record<string, any> | Record<string, any>[] | any,
		targetType: Function | TypeMetadata,
		arrayType: Function,
		isMap: boolean,
		level = 0
	): any {
		if (Array.isArray(value) || value instanceof Set) {
			return this.doTransform_ArrayLike( arrayType, value, source, targetType, level );
		} else if (targetType === String && !isMap) {
			if (value === null || value === undefined) return value;
			else return String(value);
		} else if (targetType === Number && !isMap) {
			if (value === null || value === undefined) return value;
			else return Number(value);
		} else if (targetType === Boolean && !isMap) {
			if (value === null || value === undefined) return value;
			else return Boolean(value);
		} else if ((targetType === Date || value instanceof Date) && !isMap) {
			if (value instanceof Date) return new Date(value.valueOf());
			if (value === null || value === undefined) return value;
			else return new Date(value);
		} else if (!!getGlobal().Buffer && !isMap &&(targetType === Buffer || value instanceof Buffer)) {
			if (value === null || value === undefined) return value;
			else return Buffer.from(value);
		} else if (isPromise(value) && !isMap) {
			return new Promise((resolve, reject) => {
				value.then((data: any) =>
					resolve(this.transform(
						undefined,
						data,
						targetType,
						undefined,
						undefined,
						level + 1
					)),
					reject
				);
			});
		} else if ( !isMap && value !== null && typeof value === "object" && typeof value.then === "function" ) {
			// Note: We should not enter this, as promise has been handled above
			// This option simply returns the Promise preventing a JS error from happening and should be an inaccessible path.
			return value; // skip promise transformation
		} else if (typeof value === "object" && value !== null) {
			return this.doTransform_object(targetType, value, source, isMap, level);
		} else {
			return value;
		}
	}

  private doTransform_object(
    targetType: Function | TypeMetadata,
    value: any,
    source: any,
    isMap: boolean,
    level: number
  ) {
    if ( !targetType && value.constructor !== Object ){
      if (!Array.isArray(value) && value.constructor === Array) {
        // Somebody attempts to convert special Array like object to Array, eg:
        // const evilObject = { '100000000': '100000000', __proto__: [] };
        // This could be used to cause Denial-of-service attack so we don't allow it.
        // See prevent-array-bomb.spec.ts for more details.
      } else {
        // We are good we can use the built-in constructor
        targetType = value.constructor;
      }
	}
    if (!targetType && source) targetType = source.constructor;

	this.recursionStack.add(value);

    // @yoolabs/class-transformer modification: Pass level int to getKeys
    const keys = this.getKeys(targetType as Function, value, isMap, level);
    const targetStructure = TransformExecutionHelper.createTargetStructure(
      source,
      isMap,
      targetType,
	  this.transformationType
    );

    // traverse over keys
    for (const key of keys) {
      if (key === "__proto__" || key === "constructor") continue;

      const valueKey = key;
      const { propertyName, newValueKey } = TransformExecutionHelper.getTargetPropertyKeyName(key, targetType, this.options.ignoreDecorators || false, this.transformationType);
      const subValue = this.doTransform_object_getSubValue(value, valueKey);

      // if value is an array try to get its custom array type
      const arrayType = Array.isArray(value[valueKey])
        ? TransformExecutionHelper.getReflectedType(targetType as Function, propertyName)
        : undefined;

      // const subValueKey = TransformationType === TransformationType.PLAIN_TO_CLASS && newKeyName ? newKeyName : key;
      const subSource = source ? source[valueKey] : undefined;

      // determine a type
	  const options: TypeHelpOptions = this.createTypeHelpOptions(targetStructure, value, propertyName);
      const { type, isSubValueMap } = this.doTransform_object_determinePropertyType( subValue, targetType, isMap, propertyName, value, valueKey, options );

      // if its deserialization then type if required
      // if we uncomment this types like string[] will not work
      // if (this.transformationType === TransformationType.PLAIN_TO_CLASS && !type && subValue instanceof Object && !(subValue instanceof Date))
      //     throw new Error(`Cannot determine type for ${(targetType as any).name }.${propertyName}, did you forget to specify a @Type?`);

      if (TransformExecutionHelper.checkTargetStructureForConflictingProperty( targetStructure, newValueKey, this.transformationType )) {
        continue;
      }

      if (!this.recursionStack.has(subValue)) {
        const transformKey =
          this.transformationType === TransformationType.PLAIN_TO_CLASS
            ? newValueKey
            : key;
			
			let newPropValue;
        if (this.transformationType === TransformationType.CLASS_TO_PLAIN) {
          // Get original value
          newPropValue = value[transformKey];
          // Apply custom transformation
          newPropValue = this.applyCustomTransformations( newPropValue, targetType as Function, transformKey, value, this.transformationType );
          // If nothing change, it means no custom transformation was applied, so use the subValue.
          newPropValue = value[transformKey] === newPropValue ? subValue : newPropValue;
          // Apply the default transformation
          newPropValue = this.transform( subSource, newPropValue, type, arrayType, isSubValueMap, level + 1 );
        } else {
          if (subValue === undefined && this.options.exposeDefaultValues) {
            // Set default value if nothing provided
            newPropValue = TransformExecutionHelper.getPropertyFromStructure( targetStructure, newValueKey );
          } else {
            newPropValue = this.transform( subSource, subValue, type, arrayType, isSubValueMap, level + 1 );
            newPropValue = this.applyCustomTransformations( newPropValue, targetType as Function, transformKey, value, this.transformationType );
          }
        }

        if (newPropValue !== undefined || this.options.exposeUnsetFields) {
			TransformExecutionHelper.addPropertyToStructure( targetStructure, newValueKey, newPropValue );
        }
      } else if (
        this.transformationType === TransformationType.CLASS_TO_CLASS
      ) {
        let newPropValue = subValue;
        newPropValue = this.applyCustomTransformations( newPropValue, targetType as Function, key, value, this.transformationType);
        if (newPropValue !== undefined || this.options.exposeUnsetFields) {
			TransformExecutionHelper.addPropertyToStructure(targetStructure, newValueKey, newPropValue);
        }
      }
    }

    this.recursionStack.delete(value);
    return targetStructure;
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

	private doTransform_object_determinePropertyType(
		subValue: any,
		targetType: Function | TypeMetadata,
		isMap: boolean,
		propertyName: string,
		value: any,
		valueKey: string,
		options:TypeHelpOptions,
	): { 
		type: any; 
		isSubValueMap: boolean 
	} {
		let type: any = undefined;
		let isSubValueMap = subValue instanceof Map;
		if (targetType && isMap) {
			type = targetType;
		} else if (targetType) {
			const metadata = defaultMetadataStorage.findTypeMetadata( targetType as Function, propertyName );
			if (metadata) {
				const newType = metadata.typeFunction ? metadata.typeFunction(options) : metadata.reflectedType;

				if ( metadata.options?.discriminator?.property && metadata.options.discriminator.subTypes ) {
					if (!(value[valueKey] instanceof Array)) {
						const discr = metadata.options.discriminator;
						if (this.transformationType === TransformationType.PLAIN_TO_CLASS) {
							type = discr.subTypes.find((subType) => {
								if (subValue instanceof Object && discr.property in subValue) {
									return subType.name === subValue[discr.property];
								}
							});
							type === undefined ? (type = newType) : (type = type.value);
							if (!metadata.options.keepDiscriminatorProperty) {
								if (subValue instanceof Object && discr.property in subValue) {
									delete subValue[discr.property];
								}
							}
						}
						if (this.transformationType === TransformationType.CLASS_TO_CLASS) {
							type = subValue.constructor;
						}
						if (this.transformationType === TransformationType.CLASS_TO_PLAIN) {
							if (subValue) {
								const match = discr.subTypes.find( (subType) => subType.value === subValue.constructor );
								subValue[discr.property] = match?.name;
							}
						}
					} else {
						type = metadata;
					}
				} else {
					type = newType;
				}
				isSubValueMap = isSubValueMap || metadata.reflectedType === Map;
			} else if (this.options.targetMaps) {
				// try to find a type in target maps
				this.options.targetMaps.filter(
					(map) => map.target === targetType && !!map.properties[propertyName]
				).forEach((map) => {
					// TODO: huh? why re-assign type x times in a loop?
					type = map.properties[propertyName];
				});
			} else if ( this.options.enableImplicitConversion && this.transformationType === TransformationType.PLAIN_TO_CLASS ) {
				// if we have no registererd type via the @Type() decorator then we check if we have any
				// type declarations in reflect-metadata (type declaration is emited only if some decorator is added to the property.)
				const reflectedType = (Reflect as any).getMetadata( "design:type", (targetType as Function).prototype, propertyName );
				if (reflectedType) type = reflectedType;
			}
		}
		return { type, isSubValueMap };
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

  private doTransform_ArrayLike(
    arrayType: Function,
    value: any[] | Set<any>,
    source: any,
    targetType: Function | TypeMetadata,
    level: number
  ) {
    const newValue =
      arrayType && this.transformationType === TransformationType.PLAIN_TO_CLASS
        ? instantiateArrayType(arrayType)
        : [];
    (value as any[]).forEach((subValue, index) => {
      const subSource = source ? source[index] : undefined;
      if (!this.recursionStack.has(subValue)) {
        let realTargetType;
        if (
          typeof targetType !== "function" &&
          targetType?.options?.discriminator?.property &&
          targetType.options.discriminator.subTypes
        ) {
          const discr = targetType.options.discriminator;
          if (this.transformationType === TransformationType.PLAIN_TO_CLASS) {
            realTargetType = discr.subTypes.find(
              (subType) => subType.name === subValue[discr.property]
            );
			const options: TypeHelpOptions = this.createTypeHelpOptions(newValue, subValue, undefined);
            const newType = targetType.typeFunction(options);
            if (realTargetType === undefined) realTargetType = newType;
            else realTargetType = realTargetType.value;

            if (!targetType.options.keepDiscriminatorProperty)
              delete subValue[discr.property];
          }

          if (this.transformationType === TransformationType.CLASS_TO_CLASS) {
            realTargetType = subValue.constructor;
          }
          if (this.transformationType === TransformationType.CLASS_TO_PLAIN) {
            const match = discr.subTypes.find(
              (subType) => subType.value === subValue.constructor
            );
            subValue[discr.property] = match?.name;
          }
        } else {
          realTargetType = targetType;
        }
        const value = this.transform(
          subSource,
          subValue,
          realTargetType,
          undefined,
          subValue instanceof Map,
          level + 1
        );

        if (newValue instanceof Set) {
          newValue.add(value);
        } else {
          newValue.push(value);
        }
      } else if (
        this.transformationType === TransformationType.CLASS_TO_CLASS
      ) {
        if (newValue instanceof Set) {
          newValue.add(subValue);
        } else {
          newValue.push(subValue);
        }
      }
    });
    return newValue;
  }

  private applyCustomTransformations(
    value: any,
    target: Function,
    key: string,
    obj: any,
    transformationType: TransformationType
  ): boolean {
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
    target: Function,
    object: Record<string, any>,
    isMap: boolean,
    level = 0
  ): string[] {
    // determine exclusion strategy
    let strategy = defaultMetadataStorage.getStrategy(target);
    if (strategy === "none") {
      // @yoolabs/class-transformer modification: If we are at level>1, check for given nestedStrategy option
      if (level > 0)
        strategy =
          this.options.nestedStrategy || this.options.strategy || "exposeAll";
      // exposeAll is default strategy
      else strategy = this.options.strategy || "exposeAll"; // exposeAll is default strategy
    }

    // get all keys that need to expose
    let keys: any[] = [];
    if (strategy === "exposeAll" || isMap) {
      if (object instanceof Map) {
        keys = Array.from(object.keys());
      } else {
        keys = Object.keys(object);
      }
    }

    if (isMap) {
      // expose & exclude do not apply for map keys only to fields
      return keys;
    }

    /**
     * If decorators are ignored but we don't want the extraneous values, then we use the
     * metadata to decide which property is needed, but doesn't apply the decorator effect.
     */
    if (
      this.options.ignoreDecorators &&
      this.options.excludeExtraneousValues &&
      target
    ) {
      keys = TransformExecutionHelper.getTargetKeysIgnoringDecorators(target, keys, this.transformationType);
    }

    if (!this.options.ignoreDecorators && target) {
		keys = TransformExecutionHelper.getTargetKeysBasedOnDecorators(target, keys, this.transformationType, this.options.excludeExtraneousValues || false);
		keys = TransformExecutionHelper.filterKeysByVersion(keys, target, this.options.version);
		keys = TransformExecutionHelper.filterKeysByGroup(keys, target, this.options.groups || []);
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
