import { TransformOperationExecutor } from './TransformOperationExecutor';
import { defaultOptions } from './constants/default-options.constant';
import { TransformationType } from './enums';
import {
  ClassConstructor,
  ClassTransformOptions,
  ClassTransformerExternalDependencies,
} from './interfaces';

export class ClassTransformer {
  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------

  /**
   * Converts class (constructor) object to plain (literal) object. Also works with arrays.
   */
  instanceToPlain<T extends Record<string, any>>(
    object: T,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): Record<string, any>;
  instanceToPlain<T extends Record<string, any>>(
    object: T[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): Record<string, any>[];
  instanceToPlain<T extends Record<string, any>>(
    object: T | T[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): Record<string, any> | Record<string, any>[] {
    const executor = new TransformOperationExecutor(
      TransformationType.CLASS_TO_PLAIN,
      {
        ...defaultOptions,
        ...options,
      },
      dependencies
    );
    return executor.transform(
      undefined,
      object,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * Converts class (constructor) object to plain (literal) object.
   * Uses given plain object as source object (it means fills given plain object with data from class object).
   * Also works with arrays.
   */
  classToPlainFromExist<T extends Record<string, any>, P>(
    object: T,
    plainObject: P,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T;
  classToPlainFromExist<T extends Record<string, any>, P>(
    object: T,
    plainObjects: P[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T[];
  classToPlainFromExist<T extends Record<string, any>, P>(
    object: T,
    plainObject: P | P[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T | T[] {
    const executor = new TransformOperationExecutor(
      TransformationType.CLASS_TO_PLAIN,
      {
        ...defaultOptions,
        ...options,
      },
      dependencies
    );
    return executor.transform(
      plainObject,
      object,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * Converts plain (literal) object to class (constructor) object. Also works with arrays.
   */
  plainToInstance<T extends Record<string, any>, V extends Array<any>>(
    cls: ClassConstructor<T>,
    plain: V,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T[];
  plainToInstance<T extends Record<string, any>, V>(
    cls: ClassConstructor<T>,
    plain: V,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T;
  plainToInstance<T extends Record<string, any>, V>(
    cls: ClassConstructor<T>,
    plain: V | V[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T | T[] {
    const executor = new TransformOperationExecutor(
      TransformationType.PLAIN_TO_CLASS,
      {
        ...defaultOptions,
        ...options,
      },
      dependencies
    );
    return executor.transform(
      undefined,
      plain,
      cls,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * Converts plain (literal) object to class (constructor) object.
   * Uses given object as source object (it means fills given object with data from plain object).
   * Also works with arrays.
   */
  plainToClassFromExist<T extends Record<string, any>, V extends Array<any>>(
    clsObject: T,
    plain: V,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T;
  plainToClassFromExist<T extends Record<string, any>, V>(
    clsObject: T,
    plain: V,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T[];
  plainToClassFromExist<T extends Record<string, any>, V>(
    clsObject: T,
    plain: V | V[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T | T[] {
    const executor = new TransformOperationExecutor(
      TransformationType.PLAIN_TO_CLASS,
      {
        ...defaultOptions,
        ...options,
      },
      dependencies
    );
    return executor.transform(
      clsObject,
      plain,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * Converts class (constructor) object to new class (constructor) object. Also works with arrays.
   */
  instanceToInstance<T>(
    object: T,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T;
  instanceToInstance<T>(
    object: T[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T[];
  instanceToInstance<T>(
    object: T | T[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T | T[] {
    const executor = new TransformOperationExecutor(
      TransformationType.CLASS_TO_CLASS,
      {
        ...defaultOptions,
        ...options,
      },
      dependencies
    );
    return executor.transform(
      undefined,
      object,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * Converts class (constructor) object to plain (literal) object.
   * Uses given plain object as source object (it means fills given plain object with data from class object).
   * Also works with arrays.
   */
  classToClassFromExist<T>(
    object: T,
    fromObject: T,
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T;
  classToClassFromExist<T>(
    object: T,
    fromObjects: T[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T[];
  classToClassFromExist<T>(
    object: T,
    fromObject: T | T[],
    options?: ClassTransformOptions,
    dependencies?: ClassTransformerExternalDependencies
  ): T | T[] {
    const executor = new TransformOperationExecutor(
      TransformationType.CLASS_TO_CLASS,
      {
        ...defaultOptions,
        ...options,
      },
      dependencies
    );
    return executor.transform(
      fromObject,
      object,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * Serializes given object to a JSON string.
   */
  serialize<T>(object: T, options?: ClassTransformOptions): string;
  serialize<T>(object: T[], options?: ClassTransformOptions): string;
  serialize<T>(object: T | T[], options?: ClassTransformOptions): string {
    return JSON.stringify(this.instanceToPlain(object, options));
  }

  /**
   * Deserializes given JSON string to a object of the given class.
   */
  deserialize<T>(
    cls: ClassConstructor<T>,
    json: string,
    options?: ClassTransformOptions
  ): T {
    const jsonObject: T = JSON.parse(json);
    return this.plainToInstance(cls, jsonObject, options);
  }

  /**
   * Deserializes given JSON string to an array of objects of the given class.
   */
  deserializeArray<T>(
    cls: ClassConstructor<T>,
    json: string,
    options?: ClassTransformOptions
  ): T[] {
    const jsonObject: any[] = JSON.parse(json);
    return this.plainToInstance(cls, jsonObject, options);
  }
}
