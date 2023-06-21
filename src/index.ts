import { ClassTransformer } from './ClassTransformer';
import {
  ClassConstructor,
  ClassTransformOptions,
  ClassTransformerExternalDependencies,
} from './interfaces';

export { ClassTransformer } from './ClassTransformer';
export { TransformOperationExecutor } from './TransformOperationExecutor';

export { getGlobal } from './utils';
export { defaultMetadataStorage } from './storage';

export * from './decorators';
export * from './enums';
export * from './interfaces';

const classTransformer = new ClassTransformer();

/**
 * Converts class (constructor) object to plain (literal) object. Also works with arrays.
 *
 * @deprecated Function name changed, use the `instanceToPlain` method instead.
 */
export function classToPlain<T>(
  object: T,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any>;
export function classToPlain<T>(
  object: T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any>[];
export function classToPlain<T>(
  object: T | T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any> | Record<string, any>[] {
  return classTransformer.instanceToPlain(object, options, dependencies);
}

/**
 * Converts class (constructor) object to plain (literal) object. Also works with arrays.
 */
export function instanceToPlain<T>(
  object: T,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any>;
export function instanceToPlain<T>(
  object: T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any>[];
export function instanceToPlain<T>(
  object: T | T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any> | Record<string, any>[] {
  return classTransformer.instanceToPlain(object, options, dependencies);
}

/**
 * Converts class (constructor) object to plain (literal) object.
 * Uses given plain object as source object (it means fills given plain object with data from class object).
 * Also works with arrays.
 *
 * @deprecated This function is being removed.
 */
export function classToPlainFromExist<T>(
  object: T,
  plainObject: Record<string, any>,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any>;
export function classToPlainFromExist<T>(
  object: T,
  plainObjects: Record<string, any>[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any>[];
export function classToPlainFromExist<T>(
  object: T,
  plainObject: Record<string, any> | Record<string, any>[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): Record<string, any> | Record<string, any>[] {
  return classTransformer.classToPlainFromExist(
    object,
    plainObject,
    options,
    dependencies
  );
}

/**
 * Converts plain (literal) object to class (constructor) object. Also works with arrays.
 *
 * @deprecated Function name changed, use the `plainToInstance` method instead.
 */
export function plainToClass<T, V>(
  cls: ClassConstructor<T>,
  plain: V[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T[];
export function plainToClass<T, V>(
  cls: ClassConstructor<T>,
  plain: V,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T;
export function plainToClass<T, V>(
  cls: ClassConstructor<T>,
  plain: V | V[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T | T[] {
  return classTransformer.plainToInstance(
    cls,
    plain as any,
    options,
    dependencies
  );
}

/**
 * Converts plain (literal) object to class (constructor) object. Also works with arrays.
 */
export function plainToInstance<T, V>(
  cls: ClassConstructor<T>,
  plain: V[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T[];
export function plainToInstance<T, V>(
  cls: ClassConstructor<T>,
  plain: V,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T;
export function plainToInstance<T, V>(
  cls: ClassConstructor<T>,
  plain: V | V[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T | T[] {
  return classTransformer.plainToInstance(
    cls,
    plain as any,
    options,
    dependencies
  );
}

/**
 * Converts plain (literal) object to class (constructor) object.
 * Uses given object as source object (it means fills given object with data from plain object).
 *  Also works with arrays.
 *
 * @deprecated This function is being removed. The current implementation is incorrect as it modifies the source object.
 */
export function plainToClassFromExist<T, V>(
  clsObject: T[],
  plain: V[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T[];
export function plainToClassFromExist<T, V>(
  clsObject: T,
  plain: V,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T;
export function plainToClassFromExist<T, V>(
  clsObject: T,
  plain: V | V[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T | T[] {
  return classTransformer.plainToClassFromExist(
    clsObject,
    plain,
    options,
    dependencies
  );
}

/**
 * Converts class (constructor) object to new class (constructor) object. Also works with arrays.
 */
export function instanceToInstance<T>(
  object: T,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T;
export function instanceToInstance<T>(
  object: T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T[];
export function instanceToInstance<T>(
  object: T | T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T | T[] {
  return classTransformer.instanceToInstance(object, options, dependencies);
}

/**
 * Converts class (constructor) object to plain (literal) object.
 * Uses given plain object as source object (it means fills given plain object with data from class object).
 * Also works with arrays.
 *
 * @deprecated This function is being removed. The current implementation is incorrect as it modifies the source object.
 */
export function classToClassFromExist<T>(
  object: T,
  fromObject: T,
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T;
export function classToClassFromExist<T>(
  object: T,
  fromObjects: T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T[];
export function classToClassFromExist<T>(
  object: T,
  fromObject: T | T[],
  options?: ClassTransformOptions,
  dependencies?: ClassTransformerExternalDependencies
): T | T[] {
  return classTransformer.classToClassFromExist(
    object,
    fromObject,
    options,
    dependencies
  );
}

/**
 * Serializes given object to a JSON string.
 *
 * @deprecated This function is being removed. Please use
 * ```
 * JSON.stringify(instanceToPlain(object, options))
 * ```
 */
export function serialize<T>(
  object: T,
  options?: ClassTransformOptions
): string;
export function serialize<T>(
  object: T[],
  options?: ClassTransformOptions
): string;
export function serialize<T>(
  object: T | T[],
  options?: ClassTransformOptions
): string {
  return classTransformer.serialize(object, options);
}

/**
 * Deserializes given JSON string to a object of the given class.
 *
 * @deprecated This function is being removed. Please use the following instead:
 * ```
 * instanceToClass(cls, JSON.parse(json), options)
 * ```
 */
export function deserialize<T>(
  cls: ClassConstructor<T>,
  json: string,
  options?: ClassTransformOptions
): T {
  return classTransformer.deserialize(cls, json, options);
}

/**
 * Deserializes given JSON string to an array of objects of the given class.
 *
 * @deprecated This function is being removed. Please use the following instead:
 * ```
 * JSON.parse(json).map(value => instanceToClass(cls, value, options))
 * ```
 *
 */
export function deserializeArray<T>(
  cls: ClassConstructor<T>,
  json: string,
  options?: ClassTransformOptions
): T[] {
  return classTransformer.deserializeArray(cls, json, options);
}
