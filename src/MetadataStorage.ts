import {
  TypeMetadata,
  ExposeMetadata,
  ExcludeMetadata,
  TransformMetadata,
  BaseMetadata,
} from './interfaces';
import { TransformationType } from './enums';

function matchTransformationType(metadata:TransformMetadata|ExposeMetadata|ExcludeMetadata, transformationType:TransformationType):boolean {
	if (!metadata.options) return true;
	if ( metadata.options.toClassOnly === true && metadata.options.toPlainOnly === true) return true;

	if (metadata.options.toClassOnly === true) {
		return (
			transformationType === TransformationType.CLASS_TO_CLASS ||
			transformationType === TransformationType.PLAIN_TO_CLASS
		);
	}

	if (metadata.options.toPlainOnly === true) {
		return transformationType === TransformationType.CLASS_TO_PLAIN;
	}

	return true;
}

type ModelMetadataMap<T extends BaseMetadata|BaseMetadata[]> = Map<string|undefined, T>
type ModelsMetadataStorage<T extends BaseMetadata|BaseMetadata[]> = Map<Function, ModelMetadataMap<T>>

/**
 * Storage for all model metadata.
 */
export class MetadataStorage {
	// -------------------------------------------------------------------------
	// Properties
	// -------------------------------------------------------------------------

	private _typeMetadatas = new Map<Function, ModelMetadataMap<TypeMetadata>>();
	private _transformMetadatas = new Map<Function,ModelMetadataMap<TransformMetadata[]>>() as ModelsMetadataStorage<TransformMetadata[]>;
	private _exposeMetadatas = new Map<Function, ModelMetadataMap<ExposeMetadata>>();
	private _excludeMetadatas = new Map<Function, ModelMetadataMap<ExcludeMetadata>>();
	private _ancestorsMap = new Map<Function, Function[]>();

	// -------------------------------------------------------------------------
	// Adder Methods
	// -------------------------------------------------------------------------

	addTypeMetadata(metadata: TypeMetadata): void {
		if (!this._typeMetadatas.has(metadata.target)) {
		this._typeMetadatas.set(metadata.target, new Map<string, TypeMetadata>());
		}
		this._typeMetadatas.get(metadata.target)!.set(metadata.propertyName, metadata);
	}

	addTransformMetadata(metadata: TransformMetadata): void {
		if (!this._transformMetadatas.has(metadata.target)) {
			this._transformMetadatas.set( metadata.target, new Map<string, TransformMetadata[]>() );
		}
		const targetMetaMap = this._transformMetadatas.get(metadata.target);
		if (!targetMetaMap!.has(metadata.propertyName) ) targetMetaMap!.set(metadata.propertyName, []);
		targetMetaMap!.get(metadata.propertyName)!.push(metadata);
	}

	addExposeMetadata(metadata: ExposeMetadata): void {
		if (!this._exposeMetadatas.has(metadata.target)) {
			this._exposeMetadatas.set( metadata.target, new Map<string, ExposeMetadata>());
		}
		this._exposeMetadatas.get(metadata.target)!.set(metadata.propertyName as string, metadata);
	}

	addExcludeMetadata(metadata: ExcludeMetadata): void {
		if (!this._excludeMetadatas.has(metadata.target)) {
			this._excludeMetadatas.set( metadata.target, new Map<string, ExcludeMetadata>()
			);
		}
		this._excludeMetadatas.get(metadata.target)!.set(metadata.propertyName as string, metadata);
	}

  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------

	findTransformMetadatas(
		target: Function,
		propertyName: string,
		transformationType: TransformationType
	): TransformMetadata[] {
		return this.findMetadatas( this._transformMetadatas, target, propertyName ).filter(metadata => {
			return matchTransformationType(metadata,transformationType)
		});
	}

	findExcludeMetadata(target: Function, propertyName: string): ExcludeMetadata|undefined {
		return this.findMetadata<ExcludeMetadata>(this._excludeMetadatas, target, propertyName);
	}

	findExposeMetadata(target: Function, propertyName: string): ExposeMetadata|undefined {
		return this.findMetadata<ExposeMetadata>(this._exposeMetadatas, target, propertyName);
	}

	findExposeMetadataByCustomName(
		target: Function,
		name: string
	): ExposeMetadata|undefined {
		return this.getExposedMetadatas(target).find(metadata => {
			return metadata.options && metadata.options.name === name;
		});
	}

	findTypeMetadata(target: Function, propertyName: string): TypeMetadata|undefined {
		return this.findMetadata(this._typeMetadatas, target, propertyName);
	}

	getStrategy(target: Function): 'excludeAll' | 'exposeAll' | 'none' {
		const exclude = this._excludeMetadatas.get(target)?.get(undefined);
		const expose = this._exposeMetadatas.get(target)?.get(undefined);
		if ((exclude && expose) || (!exclude && !expose)) return 'none';
		return exclude ? 'excludeAll' : 'exposeAll';
	}

	getExposedMetadatas(target: Function): ExposeMetadata[] {
		return this.getMetadata(this._exposeMetadatas, target);
	}

	getExcludedMetadatas(target: Function): ExcludeMetadata[] {
		return this.getMetadata(this._excludeMetadatas, target);
	}

	getExposedProperties(
		target: Function,
		transformationType: TransformationType
	): string[] {
		return this.getExposedMetadatas(target).filter(metadata => {
			return matchTransformationType(metadata,transformationType)
		}).map(metadata => metadata.propertyName as string);
	}

	getExcludedProperties(
		target: Function,
		transformationType: TransformationType
	): string[] {
		return this.getExcludedMetadatas(target).filter(metadata => {
			return metadata.propertyName && matchTransformationType(metadata,transformationType)
		}).map(metadata => metadata.propertyName as string);
	}

	clear(): void {
		this._typeMetadatas.clear();
		this._exposeMetadatas.clear();
		this._excludeMetadatas.clear();
		this._ancestorsMap.clear();
	}

	// -------------------------------------------------------------------------
	// Private Methods
	// -------------------------------------------------------------------------

	private getMetadata<T extends BaseMetadata>(
		metadatas: ModelsMetadataStorage<T>,
		target: Function
	): T[] {
		const metadataFromTargetMap = metadatas.get(target);
		let metadataFromTarget: T[] = [];
		if (metadataFromTargetMap) {
			metadataFromTarget = Array.from(metadataFromTargetMap.values()).filter(
				meta => meta.propertyName !== undefined
			);
		}
		const metadataFromAncestors: T[] = [];
		for (const ancestor of this.getAncestors(target)) {
			const ancestorMetadataMap = metadatas.get(ancestor);
			if (ancestorMetadataMap) {
				const metadataFromAncestor = Array.from(
					ancestorMetadataMap.values()
				).filter(meta => meta.propertyName !== undefined);
				metadataFromAncestors.push(...metadataFromAncestor);
			}
		}
		return metadataFromAncestors.concat(metadataFromTarget || []);
	}

	private findMetadata<T extends BaseMetadata>(
		metadatas: ModelsMetadataStorage<T>,
		target: Function,
		propertyName: string
	): T|undefined {
		const metadataFromTargetMap = metadatas.get(target);
		if (metadataFromTargetMap) {
			const metadataFromTarget = metadataFromTargetMap.get(propertyName);
			if (metadataFromTarget) {
				return metadataFromTarget;
			}
		}
		for (const ancestor of this.getAncestors(target)) {
			const ancestorMetadataMap = metadatas.get(ancestor);
			if (ancestorMetadataMap) {
				const ancestorResult = ancestorMetadataMap.get(propertyName);
				if (ancestorResult) {
					return ancestorResult;
				}
			}
		}
		return undefined;
	}

	private findMetadatas<T extends TransformMetadata>(
		metadatas: ModelsMetadataStorage<T[]>,
		target: Function,
		propertyName: string
	): T[] {
		const metadataFromTargetMap = metadatas.get(target) as ModelMetadataMap<TransformMetadata[]>;
		let metadataFromTarget: T[] = [];
		if (metadataFromTargetMap && metadataFromTargetMap.has(propertyName)) {
			metadataFromTarget = metadataFromTargetMap.get(propertyName) as T[];
		}
		const metadataFromAncestorsTarget: T[] = [];
		for (const ancestor of this.getAncestors(target)) {
			const ancestorMetadataMap = metadatas.get(ancestor);
			if (ancestorMetadataMap) {
				if (ancestorMetadataMap.has(propertyName)) {
					const ancestorMeta = ancestorMetadataMap.get(propertyName) as T[];
					metadataFromAncestorsTarget.push(...ancestorMeta);
				}
			}
		}
		return metadataFromAncestorsTarget
			.slice()
			.reverse()
			.concat((metadataFromTarget || []).slice().reverse());
	}
	
	private getAncestors(target: Function): Function[] {
		if (!target) return [];
		if (!this._ancestorsMap.has(target)) {
			const ancestors: Function[] = [];
			for (
				let baseClass = Object.getPrototypeOf(target.prototype.constructor);
				typeof baseClass.prototype !== 'undefined';
				baseClass = Object.getPrototypeOf(baseClass.prototype.constructor)
			) {
				ancestors.push(baseClass);
			}
			this._ancestorsMap.set(target, ancestors);
		}
		return this._ancestorsMap.get(target) as Function[];
	}
}
